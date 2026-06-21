// API route: show RAG retrieval working, in the app (the search half of the pipeline).
// POST { customer: id } -> builds the SAME case query the real decision uses, scores every
// policy section by meaning, and returns them ranked. The top K are the ones actually sent to
// the agent; the rest are dropped. This makes "retrieval-augmented generation" visible.
import { scoreAll, buildCaseQuery } from "../../../lib/onboarding.mjs";
import customersData from "../../../data/customers.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOP_K = 7; // how many sections the agent receives (matches answerCase)

export async function POST(request: Request) {
  const { customer } = await request.json();
  const c = customersData.customers.find((x) => x.id === customer);
  if (!c) return Response.json({ error: "unknown customer" }, { status: 400 });

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

  const query = buildCaseQuery(facts);
  const ranked = await scoreAll(query); // every section, best match first

  const sections = ranked.map((s: any, i: number) => ({
    rank: i + 1,
    section: s.section,
    score: s.score,                    // cosine similarity, 0..1, higher = closer in meaning
    used: i < TOP_K,                   // the top K are sent to the agent
    preview: String(s.text).replace(/\s+/g, " ").slice(0, 180),
    text: String(s.text),              // full section text (revealed when a dot is clicked)
  }));

  return Response.json({
    customer: c.id,
    name: c.name,
    query,
    top_k: TOP_K,
    total: sections.length,
    sections,
  });
}
