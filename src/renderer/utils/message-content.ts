export interface MessageSegment {
  type: "text" | "copy-chip";
  content: string;
}

// COPY markers wrap paste-ready content as a copy chip. Two syntaxes:
//   - New (collision-proof): <!--COPY_BEGIN-->content<!--COPY_END-->
//     The end sentinel is a unique string, so content can safely contain
//     `-->`, HTML comments, or any markup without terminating early.
//   - Legacy (fallback for older sessions): <!--COPY:content-->
//     Non-greedy on `-->` — breaks if content itself contains `-->`. Kept
//     so historical messages still render their chips.
// The alternation tries the new syntax first; group 1 = new content,
// group 2 = legacy content.
const COPY_RE = /<!--COPY_BEGIN-->([\s\S]*?)<!--COPY_END-->|<!--COPY:([\s\S]*?)-->/g;

export function parseMessageContent(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const clean = content
    .replace(/<!--ACTION:[\s\S]*?-->/g, "")
    .replace(/<skill_content[\s\S]*?<\/skill_content>/gi, "")
    .replace(/<skill[\s\S]*?<\/skill>/gi, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/\[skill\][\s\S]*?\[\/skill\]/gi, "")
    .trim();
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  COPY_RE.lastIndex = 0;
  while ((match = COPY_RE.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: clean.slice(lastIndex, match.index) });
    }
    const chipContent = match[1] !== undefined ? match[1] : match[2];
    segments.push({ type: "copy-chip", content: chipContent });
    lastIndex = COPY_RE.lastIndex;
  }
  if (lastIndex < clean.length) {
    segments.push({ type: "text", content: clean.slice(lastIndex) });
  }
  return segments;
}

export function getRawCopyText(content: string): string {
  return content
    .replace(/<!--ACTION:[\s\S]*?-->/g, "")
    .replace(/<skill_content[\s\S]*?<\/skill_content>/gi, "")
    .replace(/<skill[\s\S]*?<\/skill>/gi, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/\[skill\][\s\S]*?\[\/skill\]/gi, "")
    .replace(COPY_RE, (_m, g1, g2) => (g1 !== undefined ? g1 : g2))
    .trim();
}
