import { describe, it, expect } from "vitest";
import { classifyError, ErrorCategory, extractErrorMessage } from "./error-classifier";

function category(raw: string): ErrorCategory {
  return classifyError(raw).category;
}

describe("classifyError - auth", () => {
  it("detects AUTH_INVALID on 401 / invalid-key strings", () => {
    expect(category("401 Unauthorized")).toBe("AUTH_INVALID");
    expect(category("Request failed with status 401")).toBe("AUTH_INVALID");
    expect(category("invalid api key")).toBe("AUTH_INVALID");
    expect(category("Incorrect API key provided")).toBe("AUTH_INVALID");
    expect(category("invalid x-api-key")).toBe("AUTH_INVALID");
    expect(category("Unauthorized: request failed")).toBe("AUTH_INVALID");
  });

  it("detects AUTH_MISSING when provider has no credentials", () => {
    expect(category("Provider not found: anthropic")).toBe("AUTH_MISSING");
    expect(category('Provider "openai" is not authenticated')).toBe("AUTH_MISSING");
    expect(category("missing api key")).toBe("AUTH_MISSING");
    expect(category("No API key configured")).toBe("AUTH_MISSING");
  });
});

describe("classifyError - usage limits", () => {
  it("detects RATE_LIMIT", () => {
    expect(category("429 Too Many Requests")).toBe("RATE_LIMIT");
    expect(category("Rate limit reached")).toBe("RATE_LIMIT");
    expect(category("rate-limit exceeded")).toBe("RATE_LIMIT");
  });

  it("detects QUOTA_EXCEEDED (billing/credit, not rate)", () => {
    expect(category("You exceeded your current quota")).toBe("QUOTA_EXCEEDED");
    expect(category("insufficient_quota")).toBe("QUOTA_EXCEEDED");
    expect(category("billing hard limit reached")).toBe("QUOTA_EXCEEDED");
    expect(category("credit balance is empty")).toBe("QUOTA_EXCEEDED");
  });
});

describe("classifyError - model / transport", () => {
  it("detects MODEL_NOT_FOUND", () => {
    expect(category("model not found: gpt-99")).toBe("MODEL_NOT_FOUND");
    expect(category('Model "x" not found for provider "openai"')).toBe("MODEL_NOT_FOUND");
    expect(category("unknown model: foo")).toBe("MODEL_NOT_FOUND");
  });

  it("detects NETWORK errors", () => {
    expect(category("fetch failed")).toBe("NETWORK");
    expect(category("ETIMEDOUT")).toBe("NETWORK");
    expect(category("getaddrinfo ENOTFOUND api.x.com")).toBe("NETWORK");
    expect(category("socket hang up")).toBe("NETWORK");
    expect(category("request timeout")).toBe("NETWORK");
  });

  it("detects PROVIDER_DOWN (5xx / overload)", () => {
    expect(category("503 Service Unavailable")).toBe("PROVIDER_DOWN");
    expect(category("502 Bad Gateway")).toBe("PROVIDER_DOWN");
    expect(category("Overloaded. Please try again later.")).toBe("PROVIDER_DOWN");
    expect(category("temporarily unavailable")).toBe("PROVIDER_DOWN");
  });
});

describe("classifyError - fallbacks", () => {
  it("returns INCONCLUSIVE for empty / whitespace", () => {
    expect(category("")).toBe("INCONCLUSIVE");
    expect(category("   ")).toBe("INCONCLUSIVE");
    expect(classifyError(undefined).category).toBe("INCONCLUSIVE");
    expect(classifyError(null).category).toBe("INCONCLUSIVE");
  });

  it("returns UNKNOWN with the raw text for unrecognised messages", () => {
    const r = classifyError("something weird happened");
    expect(r.category).toBe("UNKNOWN");
    expect(r.message).toContain("something weird happened");
  });
});

describe("classifyError - recovery actions", () => {
  it("points auth errors to settings", () => {
    expect(classifyError("401").recoveryAction).toBe("openSettingsModel");
    expect(classifyError("Provider not found: x").recoveryAction).toBe("openSettingsModel");
    expect(classifyError("quota exceeded").recoveryAction).toBe("openSettingsModel");
  });

  it("points transient errors to retry", () => {
    expect(classifyError("429 rate limit").recoveryAction).toBe("retry");
    expect(classifyError("503 overloaded").recoveryAction).toBe("retry");
    expect(classifyError("fetch failed").recoveryAction).toBe("retry");
  });
});

describe("classifyError - priority", () => {
  it("AUTH_INVALID wins over RATE_LIMIT when both appear", () => {
    // A 401 that also mentions "limit" should be treated as auth, not rate.
    expect(category("401 invalid api key - limit")).toBe("AUTH_INVALID");
  });

  it("RATE_LIMIT wins over QUOTA when both appear (429 with quota word)", () => {
    expect(category("429 rate limit, check quota")).toBe("RATE_LIMIT");
  });

  it("subscription/entitlement maps to QUOTA, not AUTH_INVALID (despite 'forbidden')", () => {
    expect(category("Forbidden: this model requires a subscription, upgrade for access")).toBe("QUOTA_EXCEEDED");
  });

  it("'API key not valid' maps to AUTH_INVALID", () => {
    expect(category("API key not valid. Please pass a valid API key.")).toBe("AUTH_INVALID");
  });

  it("'Unexpected server error' maps to PROVIDER_DOWN", () => {
    expect(category("Unexpected server error. Check server logs for details.")).toBe("PROVIDER_DOWN");
  });
});

describe("extractErrorMessage", () => {
  it("reads provider APIError messages from data.message (not error.message)", () => {
    // Real opencode error shape: { name: "APIError", data: { message, statusCode } }
    const apiError = { name: "APIError", data: { message: "API key not valid.", statusCode: 400 } };
    expect(extractErrorMessage(apiError)).toBe("API key not valid.");
  });

  it("falls back to error.message for simple errors", () => {
    expect(extractErrorMessage({ message: "boom" })).toBe("boom");
  });

  it("falls back to data.responseBody when data.message is absent", () => {
    expect(extractErrorMessage({ data: { responseBody: "nope" } })).toBe("nope");
  });

  it("returns '' for empty / unrecognised shapes", () => {
    expect(extractErrorMessage(null)).toBe("");
    expect(extractErrorMessage(undefined)).toBe("");
    expect(extractErrorMessage({})).toBe("");
    expect(extractErrorMessage("plain string")).toBe("plain string");
  });

  it("classifies a real opencode APIError end-to-end", () => {
    const apiError = { name: "APIError", data: { message: "API key not valid. Please pass a valid API key.", statusCode: 400 } };
    expect(classifyError(extractErrorMessage(apiError)).category).toBe("AUTH_INVALID");
  });
});
