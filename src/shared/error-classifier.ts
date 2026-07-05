/**
 * Classifies raw OpenCode / provider error strings into a small set of
 * categories the renderer can map to friendly, localized messages and the
 * right recovery affordance (e.g. an inline "Fix in Settings" button for
 * auth failures, a "Try again" button for transient failures).
 *
 * The classifier is intentionally conservative: when in doubt it returns
 * UNKNOWN and preserves the raw text rather than guessing. Callers that
 * know a timeout occurred (e.g. VERIFY_KEY) should pass an empty/whitespace
 * string to surface the INCONCLUSIVE category.
 */

export type ErrorCategory =
  | "AUTH_INVALID"
  | "AUTH_MISSING"
  | "RATE_LIMIT"
  | "QUOTA_EXCEEDED"
  | "MODEL_NOT_FOUND"
  | "NETWORK"
  | "PROVIDER_DOWN"
  | "BLOCKED"
  | "INCONCLUSIVE"
  | "UNKNOWN";

export type RecoveryAction = "openSettingsModel" | "retry" | "none";

export interface ClassifiedError {
  category: ErrorCategory;
  /** English fallback message. Renderers should prefer an i18n lookup keyed
   *  by `category`; this message is used when no translation exists and for
   *  logs. For UNKNOWN it includes the raw text. */
  message: string;
  raw?: string;
  recoveryAction: RecoveryAction;
}

interface Rule {
  category: ErrorCategory;
  test: (lower: string) => boolean;
  message: string;
}

const includes = (...needles: string[]) => (s: string) => needles.some((n) => s.includes(n));

/**
 * Extract a human-readable message from an OpenCode error object. Provider
 * errors arrive as `{ name: "APIError", data: { message, statusCode, ... } }`
 * — the text is at `data.message`, NOT `error.message` (which is undefined).
 * Simple/unknown errors may use `error.message` or `error.msg`. Check all.
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const e = error as Record<string, any>;
  if (typeof e.message === "string" && e.message) return e.message;
  if (e.data && typeof e.data === "object") {
    if (typeof e.data.message === "string" && e.data.message) return e.data.message;
    if (typeof e.data.responseBody === "string" && e.data.responseBody) return e.data.responseBody;
  }
  if (typeof e.msg === "string" && e.msg) return e.msg;
  return "";
}

// Ordered from most specific to least. The first matching rule wins.
const RULES: Rule[] = [
  {
    // Kill-switch terminated the session (the AI tried a blocked tool/operator
    // in read-only mode). Surfaced as a clear, actionable message rather than
    // a generic "something went wrong".
    category: "BLOCKED",
    test: includes("blocked:", "session terminated for safety", "blocked operator", "read-only mode"),
    message: "The AI tried to run a command that isn't allowed in read-only mode. Try rephrasing your request.",
  },
  {
    category: "AUTH_MISSING",
    // OpenCode emits "Provider not found: <p>" when the provider has no
    // credential on file; providers also surface "not authenticated".
    test: includes("provider not found", "not authenticated", "missing api key", "no api key", "missing credentials", "not configured"),
    message: "This provider isn't connected yet. Add your API key in Settings.",
  },
  {
    // Entitlement / plan issues often arrive as 403 "Forbidden: ... requires
    // a subscription". Must precede AUTH_INVALID (which also matches
    // "forbidden") so an upgrade-required error isn't misread as a bad key.
    category: "QUOTA_EXCEEDED",
    test: includes("subscription", "upgrade for access", "requires a subscription", "not available on your plan", "entitlement", "not entitled"),
    message: "Your provider account can't use this model (quota, billing, or subscription).",
  },
  {
    category: "AUTH_INVALID",
    test: (s) =>
      /\b(401|403)\b/.test(s) ||
      includes(
        "invalid api key", "invalid_api_key", "incorrect api key", "invalid x-api-key",
        "api key not valid", "not a valid api key", "please pass a valid api key",
        "unauthorized", "forbidden", "invalid key", "authentication failed",
      )(s),
    message: "Your API key was rejected. Check the key and provider in Settings.",
  },
  {
    category: "RATE_LIMIT",
    test: (s) => /\b429\b/.test(s) || includes("rate limit", "rate-limit", "too many requests")(s),
    message: "Rate limit hit. Wait a moment and try again.",
  },
  {
    category: "QUOTA_EXCEEDED",
    test: includes("quota", "insufficient", "billing", "balance", "credit", "exceeded your", "payment required"),
    message: "Your provider account can't use this model (quota, billing, or subscription).",
  },
  {
    category: "MODEL_NOT_FOUND",
    test: includes("model not found", "not found for provider", "unknown model", "does not exist"),
    message: "That model wasn't found for this provider.",
  },
  {
    category: "NETWORK",
    test: (s) =>
      includes("timeout", "etimedout", "enotfound", "econnreset", "econnrefused", "network", "socket hang up", "fetch failed", "getaddrinfo")(s),
    message: "Couldn't reach the provider. Check your connection.",
  },
  {
    category: "PROVIDER_DOWN",
    test: (s) =>
      /\b5\d\d\b/.test(s) ||
      includes("service unavailable", "bad gateway", "internal server error", "overloaded", "temporarily unavailable", "server error", "unexpected error", "unexpected server")(s),
    message: "The provider seems to be having trouble right now.",
  },
];

const RECOVERY: Record<ErrorCategory, RecoveryAction> = {
  AUTH_INVALID: "openSettingsModel",
  AUTH_MISSING: "openSettingsModel",
  QUOTA_EXCEEDED: "openSettingsModel",
  MODEL_NOT_FOUND: "openSettingsModel",
  RATE_LIMIT: "retry",
  NETWORK: "retry",
  PROVIDER_DOWN: "retry",
  BLOCKED: "retry",
  INCONCLUSIVE: "none",
  UNKNOWN: "none",
};

const FRIENDLY: Record<ErrorCategory, string> = {
  AUTH_INVALID: "Your API key was rejected. Check the key and provider in Settings.",
  AUTH_MISSING: "This provider isn't connected yet. Add your API key in Settings.",
  QUOTA_EXCEEDED: "Your provider account can't use this model (quota, billing, or subscription).",
  MODEL_NOT_FOUND: "That model wasn't found for this provider.",
  RATE_LIMIT: "Rate limit hit. Wait a moment and try again.",
  NETWORK: "Couldn't reach the provider. Check your connection.",
  PROVIDER_DOWN: "The provider seems to be having trouble right now.",
  BLOCKED: "The AI tried to run a command that isn't allowed in read-only mode. Try rephrasing your request.",
  INCONCLUSIVE: "Couldn't confirm the connection. You can save the key and try sending a message.",
  UNKNOWN: "Something went wrong.",
};

export function classifyError(raw: string | undefined | null): ClassifiedError {
  const text = (raw ?? "").trim();
  if (!text) {
    return { category: "INCONCLUSIVE", message: FRIENDLY.INCONCLUSIVE, recoveryAction: RECOVERY.INCONCLUSIVE };
  }
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(lower)) {
      return { category: rule.category, message: FRIENDLY[rule.category], raw: text, recoveryAction: RECOVERY[rule.category] };
    }
  }
  return { category: "UNKNOWN", message: `${FRIENDLY.UNKNOWN} (${text})`, raw: text, recoveryAction: RECOVERY.UNKNOWN };
}
