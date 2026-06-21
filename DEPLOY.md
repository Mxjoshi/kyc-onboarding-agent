# Deploy guide

This app needs **one persistent Node server**, because:
- the audit log / dashboard / review queue live in memory (`src/lib/store.mjs`), and
- the policy search loads a local ML model (`transformers.js`) into that server.

So pick a host that runs a long-lived Node process. Below: the recommended one-click path, two
other persistent hosts, and an honest note on Vercel.

Whatever host you choose, you need exactly one secret:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | your Anthropic API key (https://console.anthropic.com) |

The build and start commands are always:

```bash
npm install && npm run build      # build
npm run start                     # start (Next reads PORT from the env, binds 0.0.0.0)
```

---

## Option 1: Render (recommended, one click)

The repo ships a `render.yaml` blueprint, so Render configures everything for you.

1. Click the button (or go to https://render.com and use **New + -> Blueprint**):

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Mxjoshi/kyc-onboarding-agent)

2. Sign in with GitHub and select this repo. Render reads `render.yaml` and fills in the commands.
3. When asked, paste your **`ANTHROPIC_API_KEY`** (it is marked secret; the only manual field).
4. Click **Apply**. The first build takes a few minutes (watch the Logs tab).
5. You get a public URL like `https://kyc-onboarding-agent.onrender.com`.

Free tier notes: the service sleeps after ~15 min idle (first visit then takes ~50s to wake), and
the in-memory audit log resets if the service restarts. Both are fine for a demo; open the link once
before presenting.

## Option 2: Railway

1. https://railway.app -> **New Project -> Deploy from GitHub repo** -> pick this repo.
2. Railway auto-detects Next.js. If needed, set Build = `npm install && npm run build`,
   Start = `npm run start`.
3. Add a variable **`ANTHROPIC_API_KEY`**.
4. Deploy. Railway gives you a public domain.

## Option 3: Docker / any Node host (Fly.io, a VPS, etc.)

Any host that runs Node 20+ works. There is no Dockerfile in the repo by default; a minimal one:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Build and run, passing the key:

```bash
docker build -t kyc-onboarding-agent .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... kyc-onboarding-agent
```

## A note on Vercel

Vercel is excellent for Next.js, but it runs **serverless functions**, not one long-lived server.
Two things break here as-is:

1. **The audit log resets.** `src/lib/store.mjs` is in memory, and each serverless invocation can be
   a different short-lived instance, so the dashboard / audit / report would not accumulate.
2. **The model re-downloads on cold starts**, which is slow and can hit function limits.

To run this on Vercel, swap the in-memory store for a database (for example Postgres, or a
serverless KV like Upstash Redis): replace the read/write functions in `src/lib/store.mjs` with calls
to that database. The agent and trust layer themselves work fine on Vercel; it is only the shared,
persistent state that needs a real datastore. Until then, use a persistent host (Options 1 to 3).

## Updating a live deployment

Every host above redeploys automatically when you push to `main`:

```bash
git add -A
git commit -m "your change"
git push
```

## Troubleshooting

- **Build fails on type errors:** run `npm run build` locally first; it type-checks the whole app.
- **"unknown customer" or empty results:** make sure `src/data/policy-index.json` is present
  (committed in the repo) or run `node scripts/build-index.mjs`.
- **401 / auth errors at runtime:** the `ANTHROPIC_API_KEY` is missing or wrong on the host. Check
  the host's environment settings.
- **First request is slow:** the embedding model loads on first use; subsequent requests are fast.
