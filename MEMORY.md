# KYC Onboarding Agent, Main Memory (read this first)

This is the index for the whole project. It stays short on purpose.
Each line points to a detailed file you open only when that topic is the task.
Last updated: 2026-06-25 (repo restructured to the 4-phase layout; agent + trust layer shipped, deploy pending).

---

## START HERE (resume protocol for a fresh session)
For accuracy, start a NEW session for each chunk of work rather than continuing a long one. The files
are the source of truth, not chat history. To rebuild context, read these in order:
1. This file (MEMORY.md), top to bottom.
2. SPEC.md (the locked thesis, rules, and plan).
3. The specific file for the active task only (a phase README or a deliverable).
Do not trust recall over the files. Re-open the file before relying on a fact. Writing style: no en or
em dashes, plain human voice. Project is on GitHub: Mxjoshi/kyc-onboarding-agent.
Push after every committed chunk so the GitHub copy stays current.

---

## The project in one line
An agentic KYC/AML onboarding assistant for UAE banking: it checks a newcomer against the bank's
policy (RAG), returns a cited proceed / request-documents / escalate decision, refuses when the policy
is silent, escalates risk to a human, and grades every answer with a visible trust layer. The
onboarding companion to the Newcomer Credit Decisioning Copilot capstone (same persona, same regulator).

## The hard rules
- Synthetic or public data only. Never real customer or company documents.
- The decision stays deterministic where it matters; the LLM explains and decides within the policy,
  it does not invent rules, fees, thresholds, or sections.
- If time runs low, cut UI polish, never the eval harness.
- No em dashes in code comments or output copy.

## The 4 phases (each = one folder)
1. Scope & Research (01-scope-and-research): the research, the one problem, the core idea.
2. Design (02-design): PRD, data schema, AI-feature + retrieval design.
3. Build & AI Integration (03-build): the grounded agent + trust layer + seven-screen console (app/).
4. Evaluate & Ship (04-evaluate-and-ship): eval harness, discrimination test, RCA, demo guide.

## Status
**Agent, trust layer, and full console BUILT, TYPE-CLEAN, AND UNIT-TESTED.** Verified end-to-end on
localhost (retrieve -> decide -> grade). The remaining step is the **live deployment** (Render
blueprint at the repo root, rootDir 03-build/app). See 04-evaluate-and-ship/README.md.

## Pointers
- The runnable app: 03-build/app/ (its own README, tests, deploy config).
- Deploy: render.yaml (root) + 03-build/deliverables/deploy-notes.md.
- Reference/shared source material: 00-reference/ (kept local, gitignored).
