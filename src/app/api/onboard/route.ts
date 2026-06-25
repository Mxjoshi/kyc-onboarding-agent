// API route: run the onboarding agent + the trust-layer judge for a chosen customer.
// POST { customer: id, breakIt?: boolean }
// Builds the case facts from the customer's real documents and screening result.

import { answerCase } from "../../../lib/onboarding.mjs";
import { judge, RUBRIC } from "../../../lib/judge.mjs";
import { addRecord } from "../../../lib/store.mjs";
import customersData from "../../../data/customers.json";
import policyIndex from "../../../data/policy-index.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Resolve a citation like "Section 4.2" to the full text of its policy section (e.g. "Section 4. ...").
function resolveSource(citationSection: string): string {
  const m = citationSection.match(/(\d+)/);
  if (!m) return "";
  const n = m[1];
  const chunk = (policyIndex as { section: string; text: string }[]).find((c) => new RegExp(`^Section ${n}\\.`).test(c.section));
  return chunk ? chunk.text : "";
}

export async function POST(request: Request) {
  const { customer, breakIt } = await request.json();
  const c = customersData.customers.find((x) => x.id === customer);
  if (!c) return Response.json({ error: "unknown customer" }, { status: 400 });

  // Build the case facts from the customer's actual file.
  const documents_provided = c.documents
    .filter((d) => d.type !== "Screening result")
    .map((d) => d.type);
  const facts = {
    category: c.category,
    employment_status: c.employment_status,
    documents_provided,
    sanctions_hit: c.screening.sanctions_hit,
    pep_flag: c.screening.pep_flag,
  };

  const caseDescription =
    `Customer: ${c.name} (${c.category}, ${c.employment_status}). Documents provided: ${documents_provided.join(", ")}. ` +
    `Sanctions match: ${facts.sanctions_hit}. PEP: ${facts.pep_flag}.`;

  // Stream the real pipeline steps (retrieving -> deciding -> grading -> done) as newline JSON.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const { decision, retrieved_sections } = await answerCase(facts, {
          breakIt: !!breakIt,
          onStep: (s: string) => send({ step: s }),
        });
        send({ step: "grading" });
        const grade = await judge({ caseDescription, answer: decision, availableSections: retrieved_sections });
        const citations = (decision.citations || []).map((cit: { claim: string; section: string }) => ({
          ...cit,
          source_text: resolveSource(cit.section),
        }));
        const record = addRecord({
          customer: c.id, name: c.name, applied_for: c.applied_for, intends: c.intends,
          recommendation: decision.recommendation, confidence: decision.confidence,
          score: grade.score, rca_tag: grade.rca_tag, all_passed: grade.all_passed, breakIt: !!breakIt,
        });
        send({
          step: "done",
          result: { case_id: record.case_id, ts: record.ts, customer: c.id, name: c.name, breakIt: !!breakIt, decision, citations, retrieved_sections, eval: grade, rubric: RUBRIC },
        });
      } catch (e) {
        send({ step: "error", error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
}
