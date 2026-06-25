// Deterministic unit tests for the decisions store — the audit-log spine.
// No API key or network needed; runs in milliseconds via `npm test`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { addRecord, listRecords, setRecordStatus, reopenRecord, clearRecords } from "../src/lib/store.mjs";

beforeEach(() => clearRecords());

test("addRecord assigns sequential, zero-padded ACME case ids", () => {
  const a = addRecord({ name: "First" });
  const b = addRecord({ name: "Second" });
  assert.equal(a.case_id, "ACME-0001");
  assert.equal(b.case_id, "ACME-0002");
});

test("addRecord stores newest-first and stamps an ISO timestamp", () => {
  addRecord({ name: "First" });
  addRecord({ name: "Second" });
  const recs = listRecords();
  assert.equal(recs.length, 2);
  assert.equal(recs[0].name, "Second"); // unshift => newest first
  assert.ok(!Number.isNaN(Date.parse(recs[0].ts)));
});

test("setRecordStatus records the officer action and trims the note", () => {
  const rec = addRecord({ name: "Case" });
  const updated = setRecordStatus(rec.case_id, "approved", "  looks good  ");
  assert.equal(updated.officer_status, "approved");
  assert.equal(updated.officer_note, "looks good");
  assert.equal(updated.officer, "R. Al Mansoori");
  assert.ok(updated.officer_ts);
});

test("reopenRecord clears the officer decision so the case returns to the queue", () => {
  const rec = addRecord({ name: "Case" });
  setRecordStatus(rec.case_id, "declined", "missing docs");
  const reopened = reopenRecord(rec.case_id);
  assert.equal(reopened.officer_status, undefined);
  assert.equal(reopened.officer_note, undefined);
  assert.equal(reopened.officer, undefined);
});

test("clearRecords empties the store and resets the sequence", () => {
  addRecord({ name: "Case" });
  clearRecords();
  assert.equal(listRecords().length, 0);
  assert.equal(addRecord({ name: "Fresh" }).case_id, "ACME-0001");
});
