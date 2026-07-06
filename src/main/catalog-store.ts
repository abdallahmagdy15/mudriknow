/**
 * Main-process owner of the live provider/model catalog.
 *
 * Source of truth: `https://models.dev/api.json` — OpenCode's own catalog
 * (maintained by the OpenCode team). Fetched with a 5-day on-disk TTL so we
 * don't hammer models.dev on every launch. On any failure (offline, parse
 * error, opencode absent) we fall back to the bundled snapshot shipped in
 * `src/shared/provider-catalog.snapshot.json`.
 *
 * The renderer never fetches directly — it asks via `LIST_PROVIDERS` /
 * `LIST_MODELS` and main answers from this store.
 */
import { app } from "electron";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import { Catalog, CatalogModel, CatalogProvider, SNAPSHOT_CATALOG } from "../shared/provider-catalog";

const CATALOG_URL = "https://models.dev/api.json";
const TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const FETCH_TIMEOUT_MS = 15000;

let memory: Catalog | null = null;

function cachePath(): string {
  return path.join(app.getPath("userData"), "catalog-cache.json");
}

interface DiskCache {
  fetchedAt: number;
  catalog: Catalog;
}

/** Normalise the raw models.dev api.json object into our Catalog shape. */
function normalise(raw: any): Catalog {
  const out: Catalog = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [pid, p] of Object.entries(raw) as [string, any]) {
    if (!p || typeof p !== "object") continue;
    const models: Record<string, CatalogModel> = {};
    if (p.models && typeof p.models === "object") {
      for (const [mid, m] of Object.entries(p.models) as [string, any]) {
        if (!m || typeof m !== "object") continue;
        // Reasoning-effort variants (low/medium/high/...) from reasoning_options.
        let effortOptions: string[] | undefined;
        if (Array.isArray(m.reasoning_options)) {
          const effort = m.reasoning_options.find((r: any) => r && r.type === "effort");
          if (effort && Array.isArray(effort.values) && effort.values.length) {
            effortOptions = effort.values.map(String);
          }
        }
        models[mid] = {
          id: m.id || mid,
          name: m.name || mid,
          attachment: !!m.attachment,
          reasoning: !!m.reasoning,
          effortOptions,
        };
      }
    }
    const provider: CatalogProvider = {
      id: p.id || pid,
      name: p.name || pid,
      env: Array.isArray(p.env) ? p.env.map(String) : [],
      doc: typeof p.doc === "string" ? p.doc : "",
      npm: typeof p.npm === "string" ? p.npm : "",
      models,
    };
    out[pid.toLowerCase()] = provider;
  }
  return out;
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "MudrikNow" } }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`models.dev HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e as Error); }
      });
    });
    req.on("error", reject);
    req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy(new Error("models.dev fetch timeout")));
  });
}

function readDiskCache(): DiskCache | null {
  try {
    const p = cachePath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.fetchedAt === "number" && parsed.catalog) {
      return parsed as DiskCache;
    }
  } catch { /* corrupt cache — ignore */ }
  return null;
}

function writeDiskCache(catalog: Catalog): void {
  try {
    fs.writeFileSync(cachePath(), JSON.stringify({ fetchedAt: Date.now(), catalog } as DiskCache), "utf-8");
  } catch { /* non-fatal */ }
}

/** Returns the best catalog available right now (memory → fresh disk cache →
 *  snapshot) and kicks off a background refresh if the cache is stale. */
export async function getCatalog(): Promise<Catalog> {
  if (memory) return memory;

  const disk = readDiskCache();
  if (disk && Date.now() - disk.fetchedAt < TTL_MS) {
    memory = disk.catalog;
    return memory;
  }

  // Use stale disk cache (or snapshot) immediately, refresh in the background.
  const immediate = (disk && disk.catalog) || SNAPSHOT_CATALOG;
  memory = immediate;
  void refreshCatalog();
  return immediate;
}

/** Force a network refresh. On success, updates memory + disk cache. On
 *  failure, keeps whatever we already have. */
export async function refreshCatalog(): Promise<Catalog> {
  try {
    const raw = await fetchJson(CATALOG_URL);
    const catalog = normalise(raw);
    if (Object.keys(catalog).length === 0) throw new Error("empty catalog");
    memory = catalog;
    writeDiskCache(catalog);
    return catalog;
  } catch {
    return memory || SNAPSHOT_CATALOG;
  }
}
