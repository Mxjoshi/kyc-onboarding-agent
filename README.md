# KYC Onboarding Agent (Acme Bank UAE)

A trustworthy KYC/AML customer-onboarding agent for UAE banking. It reviews a new customer
against the bank's policy and returns a decision an officer can defend: **proceed, request
documents, or escalate**. Every claim is **cited to the exact policy section**, it **refuses when
the policy is silent** instead of guessing, it **escalates risky cases to a human**, and a built-in
**trust layer grades every answer** and proves it can catch a bad one.

> Synthetic data only. "Acme Bank UAE" is fictional. No real customers or company documents.

**Live demo:** add your URL here after deploying (see [Deploy your own](#deploy-your-own)).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Mxjoshi/kyc-onboarding-agent)

---

## Contents

- [Why this exists](#why-this-exists)
- [What it does](#what-it-does)
- [The seven screens](#the-seven-screens)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quickstart (run locally)](#quickstart-run-locally)
- [Deploy your own](#deploy-your-own)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Security](#security)
- [License](#license)

## Why this exists

New expats in the UAE arrive with no local credit history, so onboarding decisions are hard and
high-stakes. This agent makes each decision grounded, cited, and auditable, in line with the
CBUAE's expectations for trustworthy AI in finance. It is the onboarding companion to a separate
credit-decisioning capstone: a customer verified here flows on to the credit copilot there.

## What it does

- **Grounded decisions (RAG).** It first retrieves the few relevant policy sections for the case,
  then decides using only those sections, never from memory.
- **Every claim cited.** Each statement links to the exact policy section, and one click shows the rule.
- **Honest refusal.** When the policy does not cover a case, it says so and escalates instead of guessing.
- **Human in the loop.** Sanctions, PEP, or uncovered cases are escalated to an officer, never auto-approved.
- **Visible trust layer.** A second AI call (the judge) grades every answer against a 4-point rubric,
  scores it, and tags the cause of any failure (bad retrieval vs bad generation).
- **Proven, not just claimed.** A built-in discrimination test feeds the judge deliberately broken
  answers and shows it catches them, which is the proof the grader can be trusted.

## The seven screens

The left sidebar groups them into **Workflow** (the operational console) and **Trust & transparency**
(how the AI works and the proof it can be trusted).

| Screen | What it shows |
|--------|---------------|
| **Dashboard** | What the app does, an interactive pipeline map, and live stats. |
| **Onboarding** | The case console: a customer's profile and documents, run the check, see the cited decision and the trust scoreboard. A "Break it" switch injects bad retrieval to prove the trust layer catches it. |
| **Review queue** | Cases escalated or paused for a human officer to action, with notes (human in the loop). |
| **Policy search (RAG)** | Retrieval made visible: the similarity map showing which policy sections were kept vs dropped for a case. |
| **Trust layer (Evals)** | Runs the discrimination test live and shows the rubric, proving the grader catches bad answers. |
| **Audit log** | Every decision recorded with outcome, trust score, root cause, and officer action. |
| **Report** | Filterable decisions report with CSV export and a CBUAE alignment mapping. |

## How it works

```
Documents + policy  ->  RAG search (transformers.js)  ->  Agent decides, cited (Claude)
                    ->  Trust judge grades it (Claude)  ->  Audit log  ->  handoff to credit copilot
```

The agent (`src/lib/onboarding.mjs`) embeds the case locally, retrieves the most relevant policy
sections, and asks Claude to decide using only those, citing each claim. The trust layer
(`src/lib/judge.mjs`) makes a second, independent Claude call to grade the result against the rubric
and tag any failure. Decisions are kept in an in-memory store (`src/lib/store.mjs`) that powers the
dashboard, review queue, audit log, and report.

## Tech stack

| Layer | Tool |
|-------|------|
| UI | React |
| Framework | Next.js (App Router) + TypeScript |
| AI (decision + judge) | Claude, via the Anthropic API (`claude-opus-4-8`) |
| Retrieval (RAG) | local embeddings with `transformers.js` (`all-MiniLM-L6-v2`) + cosine similarity |
| Hosting | a persistent Node server (Render by default) |

## Project structure

```
kyc-onboarding-agent/
├── src/
│   ├── app/
│   │   ├── page.tsx            # the whole bank console UI (all seven screens)
│   │   ├── layout.tsx          # root layout
│   │   ├── globals.css         # the design system
│   │   └── api/                # server routes
│   │       ├── onboard/        #   run the agent + judge for a customer (streams progress)
│   │       ├── customers/      #   the onboarding work queue
│   │       ├── retrieval/      #   RAG retrieval, for the similarity map
│   │       ├── discrimination/ #   the trust-layer discrimination test
│   │       ├── log/            #   decisions log (GET, DELETE)
│   │       └── review-action/  #   officer actions (human in the loop)
│   ├── lib/
│   │   ├── onboarding.mjs      # the agent: retrieve -> decide -> cite -> refuse
│   │   ├── judge.mjs           # the trust layer: rubric + LLM judge + root-cause tag
│   │   ├── store.mjs           # in-memory decisions store
│   │   └── config.mjs          # the model id (one source of truth, env-overridable)
│   └── data/
│       ├── customers.json      # 8 sample applicants (varied outcomes)
│       └── policy-index.json   # the built searchable policy index (9 chunks)
├── tests/                      # unit tests (node:test, no key needed): npm test
├── data/policy/
│   └── acme-bank-kyc-aml-policy.md   # the synthetic bank policy (the source of truth)
├── scripts/
│   ├── build-index.mjs         # ingestion: policy -> searchable index (run once)
│   ├── test-retrieval.mjs      # prove retrieval works
│   ├── test-agent.mjs          # run the agent on the sample customers
│   └── test-evals.mjs          # run the trust layer
├── render.yaml                 # one-click Render blueprint
├── START-HERE.md               # full local setup, step by step
├── DEPLOY.md                   # hosting guide (Render, Railway, Docker, Vercel notes)
└── .env.example                # copy to .env.local and add your Anthropic key
```

## Quickstart (run locally)

Requires Node.js 20+ and an Anthropic API key (https://console.anthropic.com).

```bash
git clone https://github.com/Mxjoshi/kyc-onboarding-agent.git
cd kyc-onboarding-agent
npm install                      # install dependencies
cp .env.example .env.local       # then add your key: ANTHROPIC_API_KEY=sk-ant-...
node scripts/build-index.mjs     # build the policy search index (run once)
npm run dev                      # open http://localhost:3000
```

First run downloads the small embedding model once, so the first search takes a few extra seconds.
A full from-scratch guide is in [START-HERE.md](START-HERE.md).

## Deploy your own

This app needs **one persistent Node server**, because the audit log lives in memory and the local
embedding model loads into that server. The fastest path is the button at the top (Render reads
`render.yaml`); you only paste your `ANTHROPIC_API_KEY`. Full step-by-step and other hosts
(Railway, Docker, and how to adapt it for Vercel) are in **[DEPLOY.md](DEPLOY.md)**.

## Scripts

```bash
npm run dev        # start the dev server (localhost:3000)
npm run build      # production build (also type-checks the whole app)
npm run start      # run the production build
npm run lint       # lint
npm test           # unit tests (store + query logic; no API key needed, runs in ms)

node scripts/ping.mjs                                          # check your Anthropic key works (prints KEY OK)
node scripts/build-index.mjs                                   # rebuild the policy index
node scripts/test-retrieval.mjs "do tourists need a branch"    # test search
node scripts/test-agent.mjs                                    # run the agent on the samples
node scripts/test-evals.mjs                                    # run the trust layer
```

## Configuration

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | yes | Your Anthropic API key. Local: in `.env.local`. Hosted: set as a secret env var. |
| `ANTHROPIC_MODEL` | no | Override the model used by the agent and judge. Defaults to `claude-opus-4-8` (see `src/lib/config.mjs`). |

Node.js 20+ is required (pinned in `package.json` and `render.yaml`).

## Security

The Anthropic API key lives only in `.env.local` (gitignored) on your machine, and as a secret
environment variable on the host. It is never committed to the repository.

## License

MIT. See [LICENSE](LICENSE).
