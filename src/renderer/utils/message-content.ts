export interface MessageSegment {
  type: "text" | "copy-chip";
  content: string;
}

export function parseMessageContent(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const copyRe = /<!--COPY:([\s\S]*?)-->/g;
  const clean = content
    .replace(/<!--ACTION:[\s\S]*?-->/g, "")
    .replace(/<skill_content[\s\S]*?<\/skill_content>/gi, "")
    .replace(/<skill[\s\S]*?<\/skill>/gi, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(/\[skill\][\s\S]*?\[\/skill\]/gi, "")
    .trim();
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = copyRe.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: clean.slice(lastIndex, match.index) });
    }
    segments.push({ type: "copy-chip", content: match[1] });
    lastIndex = copyRe.lastIndex;
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
    .replace(/<!--COPY:([\s\S]*?)-->/g, "$1")
    .trim();
}
