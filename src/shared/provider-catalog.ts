/**
 * Provider/model metadata sourced from OpenCode's own catalog (models.dev).
 *
 * MudrikNow no longer maintains a parallel provider model. models.dev is the
 * canonical source of provider display names, env vars, logos, and model
 * lists — and it is created/maintained by the OpenCode team, so it stays in
 * lock-step with the engine MudrikNow spawns.
 *
 * This module is PURE: it carries a bundled fallback snapshot (~25 popular
 * providers, offline-safe) and helpers that operate on a catalog object. The
 * main process owns the live, refreshed catalog (fetched from
 * `https://models.dev/api.json` with on-disk TTL caching) and serves it to
 * the renderer via the `LIST_PROVIDERS` / `LIST_MODELS` IPC channels. The
 * renderer uses the id-based helpers here (`getKeyUrl`, `getLogoUrl`) to
 * render any provider id without an extra round-trip.
 */
import snapshot from "./provider-catalog.snapshot.json";

export interface CatalogModel {
  id: string;
  name: string;
  attachment: boolean;
  reasoning: boolean;
}
export interface CatalogProvider {
  id: string;
  name: string;
  env: string[];
  doc: string;
  npm: string;
  models: Record<string, CatalogModel>;
}
export type Catalog = Record<string, CatalogProvider>;

/** Bundled offline fallback (curated ~25 popular providers). */
export const SNAPSHOT_CATALOG = snapshot as unknown as Catalog;

/** Curated sign-up / API-key console URLs for popular providers. Falls back
 *  to the provider's `doc` page (or the models.dev provider page). */
const KEY_URLS: Record<string, string> = {
  opencode: "https://opencode.ai/",
  "ollama-cloud": "https://opencode.ai/",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/apikey",
  "google-vertex": "https://console.cloud.google.com/",
  deepseek: "https://platform.deepseek.com/api_keys",
  openrouter: "https://openrouter.ai/keys",
  groq: "https://console.groq.com/keys",
  mistral: "https://console.mistral.ai/api-keys/",
  xai: "https://console.x.ai/",
  togetherai: "https://api.together.ai/settings/api-keys",
  "fireworks-ai": "https://fireworks.ai/account/api-keys",
  perplexity: "https://www.perplexity.ai/settings/api",
  cohere: "https://dashboard.cohere.com/api-keys",
  cerebras: "https://cloud.cerebras.ai/",
  zai: "https://z.ai/",
  "zai-coding-plan": "https://z.ai/",
  zhipuai: "https://open.bigmodel.cn/usercenter/apikeys",
  "zhipuai-coding-plan": "https://open.bigmodel.cn/usercenter/apikeys",
  "kimi-for-coding": "https://platform.moonshot.ai/",
  moonshotai: "https://platform.moonshot.ai/",
  nvidia: "https://build.nvidia.com/",
  "amazon-bedrock": "https://console.aws.amazon.com/bedrock/",
  azure: "https://portal.azure.com/",
};

/** Sign-up / key-console URL for a provider. */
export function getKeyUrl(providerId: string, docFallback?: string): string {
  const id = (providerId || "").toLowerCase();
  return KEY_URLS[id] || docFallback || `https://models.dev/${id}`;
}

/** Logo URL (hosted by models.dev). */
export function getLogoUrl(providerId: string): string {
  return `https://models.dev/logos/${(providerId || "").toLowerCase()}.svg`;
}

/** Authoritative env-var name for a provider from the catalog's `env[]`, if
 *  present. Callers fall back to providers.ts#envVarForProvider otherwise. */
export function envVarFromCatalog(providerId: string, catalog: Catalog): string | undefined {
  const p = catalog[(providerId || "").toLowerCase()];
  if (p && Array.isArray(p.env) && p.env.length) return p.env[0];
  return undefined;
}

/** Pick a cheap, fast model id (`provider/model`) for the VERIFY_KEY
 *  pre-flight test. Prefers names that look small/fast (haiku/flash/mini...);
 *  otherwise the provider's first listed model. Returns undefined if the
 *  provider has no known models. */
export function pickTestModel(providerId: string, catalog: Catalog): string | undefined {
  const p = catalog[(providerId || "").toLowerCase()];
  if (!p) return undefined;
  const ids = Object.keys(p.models);
  if (!ids.length) return undefined;
  const cheap = ids.find((id) => /flash|haiku|nano|mini|small|lite|turbo/i.test(id));
  return `${p.id}/${cheap || ids[0]}`;
}

/** Provider ids in popularity order, for pinning to the top of the chooser.
 *  NVIDIA leads — it offers a generous, genuinely-usable free tier for every
 *  user, so the setup wizard recommends it as the default first connection. */
export const POPULAR_PROVIDER_IDS: readonly string[] = [
  "nvidia", "anthropic", "openai", "google", "deepseek", "openrouter",
  "groq", "mistral", "xai", "kimi-for-coding", "cerebras",
  "opencode", "ollama-cloud",
];

/** Free providers that need no API key from the user — the wizard skips the
 *  key step for these. */
export const FREE_PROVIDER_IDS: readonly string[] = ["opencode", "ollama-cloud"];

/** True if the provider is one that needs no user-supplied key. */
export function isFreeProvider(providerId: string): boolean {
  return FREE_PROVIDER_IDS.includes((providerId || "").toLowerCase());
}

/** Display name for a provider id, falling back to the id itself. */
export function providerDisplayName(providerId: string, catalog: Catalog = SNAPSHOT_CATALOG): string {
  const p = catalog[(providerId || "").toLowerCase()];
  return (p && p.name) || providerId;
}
