import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { MODEL } from "../src/lib/config.mjs";
// load .env.local manually (scripts run outside Next.js)
for (const line of readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic();
const r = await client.messages.create({
  model: MODEL,
  max_tokens: 20,
  messages: [{ role: "user", content: "Reply with exactly: KEY OK" }],
});
console.log(r.content.find(b => b.type === "text")?.text);
