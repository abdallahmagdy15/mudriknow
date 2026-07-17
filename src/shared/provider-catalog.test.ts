import { describe, it, expect } from "vitest";
import {
  SNAPSHOT_CATALOG,
  getKeyUrl,
  getLogoUrl,
  envVarFromCatalog,
  pickTestModel,
  isFreeProvider,
  providerDisplayName,
  POPULAR_PROVIDER_IDS,
} from "./provider-catalog";

describe("provider-catalog - bundled snapshot", () => {
  it("ships the popular providers offline", () => {
    expect(SNAPSHOT_CATALOG.anthropic).toBeDefined();
    expect(SNAPSHOT_CATALOG.anthropic.name).toBe("Anthropic");
    expect(SNAPSHOT_CATALOG.anthropic.env).toContain("ANTHROPIC_API_KEY");
    expect(SNAPSHOT_CATALOG.openai).toBeDefined();
    expect(SNAPSHOT_CATALOG.opencode).toBeDefined();
    expect(SNAPSHOT_CATALOG["ollama-cloud"]).toBeDefined();
  });

  it("each model has the minimal fields", () => {
    const m = SNAPSHOT_CATALOG.anthropic.models["claude-opus-4-5"];
    expect(m).toBeDefined();
    expect(typeof m.name).toBe("string");
    expect(typeof m.attachment).toBe("boolean");
    expect(typeof m.reasoning).toBe("boolean");
  });
});

describe("provider-catalog - helpers", () => {
  it("getKeyUrl returns curated signup URLs, then doc, then models.dev", () => {
    expect(getKeyUrl("anthropic")).toBe("https://console.anthropic.com/settings/keys");
    expect(getKeyUrl("openai")).toBe("https://platform.openai.com/api-keys");
    // Unknown provider with a doc fallback
    expect(getKeyUrl("unknowntest", "https://example.com/docs")).toBe("https://example.com/docs");
    // Unknown provider, no doc
    expect(getKeyUrl("unknowntest")).toBe("https://models.dev/unknowntest");
  });

  it("getLogoUrl targets models.dev svg by lowercased id", () => {
    expect(getLogoUrl("Anthropic")).toBe("https://models.dev/logos/anthropic.svg");
    expect(getLogoUrl("openai")).toBe("https://models.dev/logos/openai.svg");
  });

  it("envVarFromCatalog returns the catalog env var when present", () => {
    expect(envVarFromCatalog("anthropic", SNAPSHOT_CATALOG)).toBe("ANTHROPIC_API_KEY");
    expect(envVarFromCatalog("google", SNAPSHOT_CATALOG)).toMatch(/GOOGLE/);
    expect(envVarFromCatalog("never-exists", SNAPSHOT_CATALOG)).toBeUndefined();
  });

  it("pickTestModel prefers cheap/fast model names", () => {
    const t = pickTestModel("anthropic", SNAPSHOT_CATALOG);
    expect(t).toMatch(/^anthropic\//);
    // google catalog typically has a flash model — should prefer it
    const g = pickTestModel("google", SNAPSHOT_CATALOG);
    if (g) expect(g).toMatch(/flash|lite|mini|haiku/i);
  });

  it("pickTestModel returns undefined for an unknown provider", () => {
    expect(pickTestModel("not-a-provider", SNAPSHOT_CATALOG)).toBeUndefined();
  });

  it("isFreeProvider flags the no-key providers", () => {
    expect(isFreeProvider("opencode")).toBe(true);
    expect(isFreeProvider("ollama-cloud")).toBe(true);
    expect(isFreeProvider("anthropic")).toBe(false);
  });

  it("providerDisplayName falls back to the id when unknown", () => {
    expect(providerDisplayName("anthropic")).toBe("Anthropic");
    expect(providerDisplayName("mystery-provider")).toBe("mystery-provider");
  });

  it("POPULAR_PROVIDER_IDS leads with Google (default install model provider)", () => {
    expect(POPULAR_PROVIDER_IDS[0]).toBe("google");
    expect(POPULAR_PROVIDER_IDS).toContain("nvidia");
    expect(POPULAR_PROVIDER_IDS).toContain("anthropic");
  });
});
