// The trust layer: a rubric + an LLM judge.
// The judge reads the FULL policy, the case, and the agent's answer, then grades the
// answer against each yes/no rubric check and, when something fails, tags the root cause.
// Score and failed-checks are computed in code (not trusted to the model) for reliability.

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL } from "./config.mjs";

const POLICY_PATH = join(process.cwd(), "data", "policy", "acme-bank-kyc-aml-policy.md");

// The rubric: the yes/no checks every answer must pass.
export const RUBRIC = [
  {
    id: "grounded_citations",
    question:
      "Is every factual claim in the answer supported by a policy section that is cited, and does the cited section actually say it?",
  },
  {
    id: "honest_refusal",
    question:
      "If the policy does not cover the case, does the answer refuse or escalate instead of guessing? And does it avoid refusing when the policy clearly does cover it?",
  },
  {
    id: "no_hallucination",
    question:
      "Does the answer avoid inventing any rule, fee, threshold, document, or section that is not in the policy?",
  },
  {
    id: "correct_action",
    question:
      "Does the recommendation follow the policy: proceed only if all required documents are present and risk is low/medium; request_documents if a required document is missing; escalate if any trigger (sanctions match, PEP, identity mismatch, or an uncovered situation) applies, and never auto-proceed when a trigger applies?",
  },
];

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    per_check: {
      type: "array",
      items: {
        type: "object",
        properties: {
          check_id: { type: "string", enum: RUBRIC.map((c) => c.id) },
          passed: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["check_id", "passed", "reason"],
        additionalProperties: false,
      },
    },
    rca_tag: {
      type: "string",
      enum: ["bad_retrieval", "bad_generation", "ambiguous_input", "none"],
    },
  },
  required: ["per_check", "rca_tag"],
  additionalProperties: false,
};

const SYSTEM = `You are a strict, skeptical compliance reviewer grading a KYC onboarding assistant.
Grade the assistant's answer against each rubric check using ONLY the bank policy provided.
Be adversarial: if a claim is not clearly supported by the cited section, mark that check failed.
For rca_tag, when any check fails, classify the root cause:
- bad_retrieval: the policy section needed to answer correctly was NOT among the sections the assistant was given (when that list is provided below), so it could not have used it.
- bad_generation: the needed section WAS available to the assistant but it misused, contradicted, ignored it, or invented content.
- ambiguous_input: the case itself was unclear, so the answer could not be graded fairly.
- none: only when every check passed.`;

let _policy = null;
function policyText() {
  if (!_policy) _policy = readFileSync(POLICY_PATH, "utf8");
  return _policy;
}

// Grade one answer. `answer` is the agent's structured output (recommendation, answer_text, citations).
// `availableSections` (optional) is the list of section labels the agent was actually given,
// used to distinguish bad_retrieval from bad_generation.
export async function judge({ caseDescription, answer, availableSections = null }) {
  const client = new Anthropic();
  const rubricText = RUBRIC.map((c) => `- ${c.id}: ${c.question}`).join("\n");
  const availableText = availableSections
    ? `\nSECTIONS THE ASSISTANT WAS GIVEN (it could only use these):\n${availableSections.join(", ")}\n`
    : "";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `BANK POLICY (the only source of truth):\n\n${policyText()}\n\n` +
          `CASE:\n${caseDescription}\n${availableText}\n` +
          `ASSISTANT'S ANSWER (to grade):\n${JSON.stringify(answer, null, 2)}\n\n` +
          `RUBRIC CHECKS:\n${rubricText}\n\n` +
          `Grade each check (pass/fail with a one-line reason) and set rca_tag.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const graded = JSON.parse(text);

  // Compute score and failed list in code, not from the model.
  const failed = graded.per_check.filter((c) => !c.passed).map((c) => c.check_id);
  const score = (graded.per_check.length - failed.length) / graded.per_check.length;
  return {
    per_check: graded.per_check,
    failed_checks: failed,
    score,
    rca_tag: failed.length === 0 ? "none" : graded.rca_tag,
    all_passed: failed.length === 0,
  };
}
