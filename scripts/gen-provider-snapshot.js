// One-shot generator for src/shared/provider-catalog.snapshot.json.
// Trims models.dev/api.json down to a curated set of popular providers with
// up to 10 models each. Run: node scripts/gen-provider-snapshot.js
const fs = require("fs");
const path = require("path");

const src = path.join(process.env.TEMP, "opencode", "models_api.json");
const out = path.join(__dirname, "..", "src", "shared", "provider-catalog.snapshot.json");

const want = [
  "opencode", "ollama-cloud", "anthropic", "openai", "google", "google-vertex",
  "deepseek", "openrouter", "groq", "mistral", "xai", "togetherai", "fireworks-ai",
  "perplexity", "cohere", "cerebras", "zai", "zai-coding-plan", "zhipuai",
  "zhipuai-coding-plan", "kimi-for-coding", "moonshotai", "nvidia", "amazon-bedrock", "azure",
];

const api = JSON.parse(fs.readFileSync(src, "utf-8"));
const out2 = {};
const missing = [];
for (const id of want) {
  const p = api[id];
  if (!p) { missing.push(id); continue; }
  const models = {};
  let i = 0;
  for (const [mid, m] of Object.entries(p.models || {})) {
    if (i++ >= 10) break;
    models[mid] = {
      id: m.id,
      name: m.name,
      attachment: !!m.attachment,
      reasoning: !!m.reasoning,
    };
  }
  out2[id] = { id: p.id, name: p.name, env: p.env || [], doc: p.doc || "", npm: p.npm || "", models };
}
fs.writeFileSync(out, JSON.stringify(out2, null, 2), "utf-8");
console.log(`WROTE providers=${Object.keys(out2).length} size=${fs.statSync(out).size} missing=${missing.join(",") || "none"}`);
