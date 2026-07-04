import { describe, it, expect } from "vitest";
import { parseVerboseModels } from "./models-parser";

const VERBOSE_SAMPLE = `nvidia/deepseek-ai/deepseek-v4-flash
{
  "id": "deepseek-v4-flash",
  "name": "DeepSeek V4 Flash",
  "capabilities": {
    "attachment": true,
    "reasoning": true,
    "toolcall": true,
    "input": { "image": true }
  },
  "cost": { "input": 0.0, "output": 0.0 },
  "limit": { "context": 1000000 }
}
nvidia/nemotron-nano-9b-v2
{
  "id": "nemotron-nano-9b-v2",
  "name": "Nemotron Nano 9B v2",
  "capabilities": {
    "attachment": false,
    "reasoning": false,
    "toolcall": true
  }
}
anthropic/claude-3-5-sonnet-20241022
{
  "id": "claude-3-5-sonnet-20241022",
  "name": "Claude Sonnet 3.5 v2",
  "capabilities": { "reasoning": true }
}`;

describe("parseVerboseModels", () => {
  it("preserves the FULL multi-segment id (the nvidia/deepseek-ai bug)", () => {
    const models = parseVerboseModels(VERBOSE_SAMPLE, "nvidia");
    const deepseek = models.find((m) => m.name === "DeepSeek V4 Flash");
    expect(deepseek).toBeDefined();
    // The bug: this was "deepseek-ai/deepseek-v4-flash" (missing nvidia/ prefix).
    expect(deepseek!.id).toBe("nvidia/deepseek-ai/deepseek-v4-flash");
  });

  it("keeps the leading provider for ordinary two-segment ids too", () => {
    const models = parseVerboseModels(VERBOSE_SAMPLE, "nvidia");
    const nano = models.find((m) => m.name === "Nemotron Nano 9B v2");
    expect(nano!.id).toBe("nvidia/nemotron-nano-9b-v2");
  });

  it("extracts capabilities, cost, and context limit", () => {
    const models = parseVerboseModels(VERBOSE_SAMPLE, "nvidia");
    const deepseek = models.find((m) => m.id === "nvidia/deepseek-ai/deepseek-v4-flash")!;
    expect(deepseek.attachment).toBe(true);
    expect(deepseek.reasoning).toBe(true);
    expect(deepseek.toolCall).toBe(true);
    expect(deepseek.cost).toEqual({ input: 0, output: 0 });
    expect(deepseek.contextLimit).toBe(1000000);
  });

  it("handles models with partial capabilities gracefully", () => {
    const models = parseVerboseModels(VERBOSE_SAMPLE, "nvidia");
    const claude = models.find((m) => m.id === "anthropic/claude-3-5-sonnet-20241022")!;
    expect(claude.reasoning).toBe(true);
    expect(claude.attachment).toBe(false);
    expect(claude.cost).toBeUndefined();
  });

  it("skips malformed JSON blocks without throwing", () => {
    const raw = `nvidia/foo
{ not valid json
}
nvidia/bar
{
  "name": "Bar"
}`;
    const models = parseVerboseModels(raw, "nvidia");
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("nvidia/bar");
  });

  it("returns empty for input with no model entries", () => {
    expect(parseVerboseModels("random stderr\nno models here", "nvidia")).toEqual([]);
  });
});
