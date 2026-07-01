import { describe, expect, it } from "vitest";
import { getRawCopyText, parseMessageContent } from "./message-content";

describe("getRawCopyText", () => {
  it("strips ACTION markers", () => {
    const src = `Hi. <!--ACTION:{"type":"invoke_element"}--> Bye.`;
    expect(getRawCopyText(src)).toBe("Hi.  Bye.");
  });

  it("unwraps COPY markers keeping content inline", () => {
    const src = "Here:\n<!--COPY:git reset --soft HEAD~1-->\nDone.";
    expect(getRawCopyText(src)).toBe("Here:\ngit reset --soft HEAD~1\nDone.");
  });

  it("strips skill / system-reminder blocks", () => {
    const src = "A<skill>x</skill>B<system-reminder>secret</system-reminder>C";
    expect(getRawCopyText(src)).toBe("ABC");
  });

  it("preserves markdown markup verbatim", () => {
    const src = "## Title\n\n- **bold** and *italic* and `code`";
    expect(getRawCopyText(src)).toBe("## Title\n\n- **bold** and *italic* and `code`");
  });

  it("handles multi-line COPY content", () => {
    const src = "<!--COPY:def foo():\n    return 1-->";
    expect(getRawCopyText(src)).toBe("def foo():\n    return 1");
  });
});

describe("parseMessageContent", () => {
  it("splits text and copy-chip segments", () => {
    const segs = parseMessageContent("a<!--COPY:b-->c");
    expect(segs).toEqual([
      { type: "text", content: "a" },
      { type: "copy-chip", content: "b" },
      { type: "text", content: "c" },
    ]);
  });

  it("strips ACTION and skill blocks before splitting", () => {
    const segs = parseMessageContent(`<!--ACTION:{"type":"x"}-->hi`);
    expect(segs).toEqual([{ type: "text", content: "hi" }]);
  });
});
