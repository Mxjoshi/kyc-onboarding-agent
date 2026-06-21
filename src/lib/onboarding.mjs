// The grounded onboarding agent.
// Steps: (1) retrieve the relevant policy sections for a customer's case,
// (2) ask Claude to decide proceed / request_documents / escalate using ONLY those
// sections, citing each claim, refusing to guess when the policy does not cover it.
// Embeddings run locally (transformers.js); generation uses Claude (Anthropic API).

import Anthropic from "@anthropic-ai/sdk";
import { pipeline, env } from "@xenova/transformers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Resolve from the app root (cwd is the app dir for both the scripts and Next.js dev).
const INDEX_PATH = join(process.cwd(), "src", "data", "policy-index.json");
env.allowLocalModels = false;

const MODEL = "claude-opus-4-8";

// Lazy singletons so we load the model and index once.
let _index = null;
let _embedder = null;

function getIndex() {
  if (!_index) _index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  return _index;
}
async function getEmbedder() {
  if (!_embedder) _embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return _embedder;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// Score every chunk against the query, best first.
export async function scoreAll(query) {
  const index = getIndex();
  const embed = await getEmbedder();
  const out = await embed(query, { pooling: "mean", normalize: true });
  const qv = Array.from(out.data);
  return index
    .map((chunk) => ({ ...chunk, score: dot(qv, chunk.embedding) }))
    .sort((a, b) => b.score - a.score);
}

// Retrieve the top-k policy sections by meaning for a query.
export async function retrieve(query, k = 5) {
  return (await scoreAll(query)).slice(0, k);
}

// Turn the structured case facts into the query + a readable case summary.
function describeCase(caseFacts) {
  const docs = caseFacts.documents_provided.join(", ") || "none";
  const flags = [];
  if (caseFacts.sanctions_hit) flags.push("sanctions screening returned a positive match");
  if (caseFacts.pep_flag) flags.push("flagged as a politically exposed person (PEP)");
  const flagText = flags.length ? flags.join("; ") : "no sanctions match, not a PEP";
  const employment = caseFacts.employment_status ? `Employment status: ${caseFacts.employment_status}. ` : "";
  return (
    `Customer category: ${caseFacts.category}. ` +
    employment +
    `Documents provided: ${docs}. ` +
    `Screening: ${flagText}.`
  );
}

// Build the retrieval query for a case. Exported so the in-app RAG view can show the SAME
// retrieval the real decision uses (not a different, demo-only query).
export function buildCaseQuery(caseFacts) {
  const summary = describeCase(caseFacts);
  return (
    `Onboarding decision. ${summary} ` +
    `Required documents, identity verification, AML risk and sanctions screening, escalation, decision outcomes.`
  );
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    recommendation: { type: "string", enum: ["proceed", "request_documents", "escalate"] },
    summary: { type: "string" },
    key_points: { type: "array", items: { type: "string" } },
    answer_text: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: { claim: { type: "string" }, section: { type: "string" } },
        required: ["claim", "section"],
        additionalProperties: false,
      },
    },
    missing_documents: { type: "array", items: { type: "string" } },
    escalation_reason: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["recommendation", "summary", "key_points", "answer_text", "citations", "missing_documents", "escalation_reason", "confidence"],
  additionalProperties: false,
};

const SYSTEM = `You are a KYC and AML onboarding assistant for Acme Bank UAE.
Decide whether to onboard a new customer using ONLY the policy sections provided to you.
Rules:
- Base every statement on the provided policy. After each claim, cite the exact section.
- Choose exactly one recommendation: proceed, request_documents, or escalate.
- If a required document is missing, choose request_documents and list what is missing.
- If any escalation trigger applies (sanctions match, PEP, mismatched identity, or the policy
  does not clearly cover the situation), choose escalate. Never proceed in those cases.
- If the provided policy does not contain the answer, say so plainly in answer_text and escalate
  rather than guessing. Do not invent rules, fees, thresholds, or sections.
- Only cite sections that appear in the provided policy text.

Make the output easy to glance at:
- summary: one sentence stating the outcome and the single main reason.
- key_points: 2 to 4 short bullet phrases (not sentences), each ending with the cited section in
  parentheses, e.g. "Proof of UAE address not provided (Section 4.2)". These are what an officer scans.
- answer_text: the fuller reasoning for those who want detail.`;

// Run the agent on one case. Returns the structured decision plus the cited sections used.
// opts.breakIt = true injects BAD retrieval (the least relevant sections) to demo the
// trust layer catching a failure on screen.
export async function answerCase(caseFacts, opts = {}) {
  const summary = describeCase(caseFacts);
  opts.onStep?.("retrieving");
  const all = await scoreAll(buildCaseQuery(caseFacts));
  const retrieved = opts.breakIt ? all.slice(-4) : all.slice(0, 7);
  const policyText = retrieved
    .map((c) => `[${c.section}]\n${c.text}`)
    .join("\n\n");

  opts.onStep?.("deciding");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `CUSTOMER CASE:\n${summary}\n\n` +
          `POLICY SECTIONS (the only source you may use):\n\n${policyText}\n\n` +
          `Decide the onboarding outcome and cite the sections you used.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const decision = JSON.parse(text);
  return { decision, retrieved_sections: retrieved.map((c) => c.section) };
}

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    answered: { type: "boolean" },
    answer_text: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: { claim: { type: "string" }, section: { type: "string" } },
        required: ["claim", "section"],
        additionalProperties: false,
      },
    },
    refusal_reason: { type: "string" },
  },
  required: ["answered", "answer_text", "citations", "refusal_reason"],
  additionalProperties: false,
};

// Answer a free-text policy question, or refuse if the policy does not cover it.
// Used to demonstrate honest refusal on the deliberate policy gap.
export async function answerQuestion(question) {
  const retrieved = await retrieve(question, 5);
  const policyText = retrieved.map((c) => `[${c.section}]\n${c.text}`).join("\n\n");

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system:
      `You are a KYC and AML onboarding assistant for Acme Bank UAE. Answer ONLY from the ` +
      `provided policy sections, citing the exact section for each claim. If the provided policy ` +
      `does not contain the answer, set answered to false, say plainly that the policy does not ` +
      `cover this and the case should be escalated to a human, and do NOT guess or invent a rule.`,
    output_config: { format: { type: "json_schema", schema: QUESTION_SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `QUESTION: ${question}\n\n` +
          `POLICY SECTIONS (the only source you may use):\n\n${policyText}\n\n` +
          `Answer the question, or refuse if the policy does not cover it.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return { result: JSON.parse(text), retrieved_sections: retrieved.map((c) => c.section) };
}
