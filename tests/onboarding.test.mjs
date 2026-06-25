// Deterministic tests for the pure query-building logic the RAG view and the real
// decision share. No API key or network needed (no Anthropic call is made here).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCaseQuery } from "../src/lib/onboarding.mjs";

const baseFacts = {
  category: "Retail",
  employment_status: "Salaried",
  documents_provided: ["Passport", "Proof of address"],
  sanctions_hit: false,
  pep_flag: false,
};

test("buildCaseQuery reflects the case facts so retrieval matches the real decision", () => {
  const q = buildCaseQuery(baseFacts);
  assert.match(q, /Retail/);
  assert.match(q, /Salaried/);
  assert.match(q, /Passport/);
  assert.match(q, /Proof of address/);
  // The screening summary should say there is no match / not a PEP when both flags are false.
  assert.match(q, /no sanctions match, not a PEP/);
});

test("buildCaseQuery surfaces sanctions and PEP flags when set", () => {
  const q = buildCaseQuery({ ...baseFacts, sanctions_hit: true, pep_flag: true });
  assert.match(q, /sanctions screening returned a positive match/);
  assert.match(q, /politically exposed person \(PEP\)/);
});

test("buildCaseQuery handles a customer with no documents", () => {
  const q = buildCaseQuery({ ...baseFacts, documents_provided: [] });
  assert.match(q, /Documents provided: none/);
});
