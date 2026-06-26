# KYC Onboarding Agent (Acme Bank UAE)

An agentic KYC/AML onboarding assistant for UAE banking that decides whether to onboard a newcomer,
and explains the decision so a compliance officer can defend it. The output is a proceed, request
documents, or escalate recommendation, with every claim cited to the exact policy section, and a human
makes the final call.

Built solo as the onboarding companion to the Newcomer Credit Decisioning Copilot capstone, two stages
of one newcomer journey (this onboards the customer, the capstone decides their credit). Goal: a
working, evaluated MVP.

**Watch:** a 90-second animated [pitch film](04-evaluate-and-ship/pitch-film/) walks through the whole
product, from the newcomer at the door to the trust layer catching a bad answer on screen.

> **The gap we fill:** the UAE is about 88% expat, and a new arrival has no local credit history and a
> thin document file. Onboarding them is high stakes and mostly manual, and a wrong call is a
> compliance risk. This agent makes each decision grounded, cited, and auditable, in line with the
> CBUAE's expectations for trustworthy AI in finance, so an officer gets a fast, consistent,
> defensible call instead of a slow manual review.

> Synthetic data only. "Acme Bank UAE" is fictional. No real customers or company documents.

## How the product works
The officer picks a newcomer's case (their profile, documents, and screening result). The agent
retrieves the few relevant sections of the bank's KYC/AML policy by meaning (RAG), then asks Claude to
decide using only those sections, citing each claim. If the policy does not cover the case it refuses
and escalates instead of guessing, and any sanctions match, PEP, or uncovered case is routed to a
human, never auto-approved. The output is proceed, request documents, or escalate.

Around the decision sits the trust layer: a second, independent Claude call grades every answer
against a rubric, scores it, and tags the cause of any failure (bad retrieval vs bad generation). A
built-in discrimination test feeds the judge deliberately broken answers and proves it catches them.
The part we feature is the grounded, cited decision and the visible trust layer.

## What a decision looks like
Take Omar Khan, a resident newcomer, salaried, applying for a current account, who has provided a
passport, Emirates ID, residence visa, salary certificate, and tenancy contract, with no sanctions
match and not a PEP. The tool returns:

- **Recommendation:** proceed. **Confidence:** high. **Trust score:** all checks passed.
- **Why:** all required identity and address documents are present, there are no AML flags, and each
  claim is cited to the policy section it rests on.
- The officer reads that cited rationale, can defend it, and makes the final call.

A weaker case comes back differently: a missing required document returns request documents with the
exact documents named, and a sanctions or PEP hit, or a case the policy does not cover, returns
escalate, routed to a human with the trigger named.

## Run it
The app is a Next.js console in [`03-build/app/`](03-build/app/). You need **Node.js 20+** and an
**Anthropic API key** (from [console.anthropic.com](https://console.anthropic.com); only the decision
and judge steps call the model, retrieval runs locally).

From a fresh clone:

```bash
cd 03-build/app
npm install
cp .env.example .env.local       # then set ANTHROPIC_API_KEY=sk-ant-... in .env.local
node scripts/build-index.mjs     # build the policy search index (run once)
npm run dev                      # open http://localhost:3000
```

On the Onboarding screen, pick a customer from the queue and run the check, or flip the **Break it**
toggle to watch the trust layer catch a deliberately degraded retrieval.

Verify the logic and the trust layer:

```bash
npm test                         # store and query-building logic (no API key needed)
node scripts/test-evals.mjs      # runs the trust layer and the discrimination test
```

See the [app README](03-build/app/README.md) for the seven screens, deploy, and configuration.

## Where the project stands
The agent, the trust layer, and the full seven-screen console are built, type-clean, tested, and
evaluated. Live deployment is the remaining step (Render blueprint at the repo root, rootDir
03-build/app).

The build ran in four phases:

| Phase | Folder | Deliverable | Status |
|---|---|---|---|
| 1. Scope & Research | [`01-scope-and-research/`](01-scope-and-research/) | UAE direction research, the one problem, the core idea | **Complete** |
| 2. Design | [`02-design/`](02-design/) | PRD, data schema, AI-feature + retrieval design | **Complete** |
| 3. Build & AI Integration | [`03-build/`](03-build/) | The grounded agent, trust layer, and seven-screen console | **Complete** |
| 4. Evaluate & Ship | [`04-evaluate-and-ship/`](04-evaluate-and-ship/) | Eval harness, discrimination test, RCA, demo guide | **Complete** |

## Repository map
- **`01` to `04`:** the work, one folder per phase. Each phase folder has a `README.md`, a
  `deliverables/` folder (the graded outputs), and `working/` (the reasoning behind them).
- **`03-build/app/`:** the runnable Next.js application (its own tests, deploy config, and README).
- **`MEMORY.md`:** the working index (decisions, status, standing rules). **`SPEC.md`:** the locked
  thesis and plan.

## How this is built
Monika owns the product: scope, decisions, reviews, and sign-offs. Claude Code is the engineering pair.
