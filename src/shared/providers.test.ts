import { describe, it, expect } from "vitest";
import {
  buildCleanOpenCodeEnv,
  envVarForProvider,
  providerFromModelId,
  knownProviderNames,
} from "./providers";

describe("buildCleanOpenCodeEnv", () => {
  it("enables OpenCode's built-in websearch tool via OPENCODE_ENABLE_EXA", () => {
    // OpenCode only registers the `websearch` tool when the provider is
    // `opencode/*` OR this env var is truthy. Mudrik uses arbitrary
    // providers, so the env var is the only way the model ever sees
    // websearch. Without it the tool is absent and the model honestly
    // tells the user it can't search — even though readonly.md, the
    // system prompt, and the runtime allowlist all permit it.
    const env = buildCleanOpenCodeEnv({}, {});
    expect(env.OPENCODE_ENABLE_EXA).toBe("1");
  });

  it("whitelists Windows-essential vars and drops everything else", () => {
    const env = buildCleanOpenCodeEnv(
      { PATH: "p", TEMP: "t", USERPROFILE: "u", NODE_ENV: "dev", ELECTRON_RUN_AS_NODE: "1" },
      {},
    );
    expect(env.PATH).toBe("p");
    expect(env.TEMP).toBe("t");
    expect(env.USERPROFILE).toBe("u");
    expect(env.NODE_ENV).toBeUndefined();
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
  });

  it("lets a shell-provided *_API_KEY win over a config-stored key", () => {
    const env = buildCleanOpenCodeEnv(
      { ANTHROPIC_API_KEY: "shell-key" },
      { anthropic: "config-key" },
    );
    expect(env.ANTHROPIC_API_KEY).toBe("shell-key");
  });

  it("uses the config-stored key when no shell key is present", () => {
    const env = buildCleanOpenCodeEnv({}, { openai: "config-key" });
    expect(env.OPENAI_API_KEY).toBe("config-key");
  });
});

describe("provider helpers", () => {
  it("extracts the provider segment from a provider/model id", () => {
    expect(providerFromModelId("anthropic/claude-3")).toBe("anthropic");
    expect(providerFromModelId("no-slash")).toBe("no-slash");
  });

  it("maps known providers to their canonical env-var name", () => {
    expect(envVarForProvider("anthropic")).toBe("ANTHROPIC_API_KEY");
    expect(envVarForProvider("google")).toBe("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  it("falls back to UPPERCASED_PROVIDER_API_KEY for unknown providers", () => {
    expect(envVarForProvider("my-provider")).toBe("MY_PROVIDER_API_KEY");
  });

  it("exposes the known provider names list", () => {
    expect(knownProviderNames).toContain("anthropic");
    expect(knownProviderNames).toContain("openai");
  });
});
