import { ModelDisplay } from "../shared/types";

/**
 * Parse the output of `opencode models <provider> --verbose`.
 *
 * The stream is alternating lines:
 *   "<full-id>"            ← may have MULTIPLE segments, e.g.
 *                           "nvidia/deepseek-ai/deepseek-v4-flash"
 *   { pretty-printed JSON object }
 * The JSON object's closing brace sits at column 0.
 *
 * IMPORTANT: keep the FULL id (all segments). A previous regex captured only
 * two segments and silently dropped the leading provider for multi-segment
 * ids — e.g. a nvidia-hosted "nvidia/deepseek-ai/deepseek-v4-flash" got
 * stored as "deepseek-ai/deepseek-v4-flash", landing it under the wrong
 * provider in the recent list (no key → false "needs key" state).
 */
export function parseVerboseModels(raw: string, providerId: string): ModelDisplay[] {
  const out: ModelDisplay[] = [];
  const lines = raw.split(/\r?\n/);
  const isIdLine = (l: string) =>
    !!l && l.includes("/") && !l.includes(" ") && !l.startsWith("{") && !l.startsWith("}") && !l.startsWith('"');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
      if (isIdLine(line)) {
        // Accumulate the JSON block that follows, using brace-depth counting
        // so we stop at the OUTER closing brace — not an inner object's close
        // (which can also sit on its own line when it's the last field).
        let j = i + 1;
        let jsonText = "";
        let depth = 0;
        let started = false;
        while (j < lines.length) {
          const jl = lines[j];
          jsonText += jl + "\n";
          for (const ch of jl) {
            if (ch === "{") { depth++; started = true; }
            else if (ch === "}") depth--;
          }
          if (started && depth <= 0) break;
          j++;
        }
        try {
        const obj: any = JSON.parse(jsonText);
        const cap = obj.capabilities || {};
        out.push({
          id: line,
          name: obj.name || line.split("/").pop() || line,
          provider: providerId,
          attachment: cap.attachment === true || cap.input?.image === true,
          reasoning: cap.reasoning === true,
          toolCall: cap.toolcall === true,
          cost: obj.cost ? { input: obj.cost.input ?? 0, output: obj.cost.output ?? 0 } : undefined,
          contextLimit: obj.limit?.context,
          authRequired: false,
        });
      } catch { /* skip malformed block */ }
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
}
