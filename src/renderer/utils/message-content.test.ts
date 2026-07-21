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

  it("new begin/end syntax preserves content with HTML comments inside", () => {
    const src = "<!--COPY_BEGIN--><!-- An HTML snippet container -->\n<div class=\"main-content\">x</div><!--COPY_END-->";
    expect(getRawCopyText(src)).toBe("<!-- An HTML snippet container -->\n<div class=\"main-content\">x</div>");
  });

  it("new begin/end syntax preserves content with `-->` inside", () => {
    const src = "Before\n<!--COPY_BEGIN-->if x --> 2: pass<!--COPY_END-->\nAfter";
    expect(getRawCopyText(src)).toBe("Before\nif x --> 2: pass\nAfter");
  });

  it("legacy COPY syntax is still unwrapped (backward compat)", () => {
    const src = "Here:\n<!--COPY:git reset --soft HEAD~1-->\nDone.";
    expect(getRawCopyText(src)).toBe("Here:\ngit reset --soft HEAD~1\nDone.");
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

  it("new begin/end syntax captures full content even with nested HTML comment", () => {
    // The exact bug: old syntax terminated at the first `-->` inside an HTML
    // comment, leaking the rest as raw markup. Begin/end markers fix it.
    const src = "<!--COPY_BEGIN--><!-- container -->\n<div>x</div><!--COPY_END-->";
    const segs = parseMessageContent(src);
    expect(segs).toEqual([
      { type: "copy-chip", content: "<!-- container -->\n<div>x</div>" },
    ]);
  });

  it("mixed: new-syntax chip plus surrounding text and a legacy chip", () => {
    const src = "Intro <!--COPY_BEGIN-->safe <!-- x --> code<!--COPY_END--> Mid <!--COPY:legacy cmd--> End";
    const segs = parseMessageContent(src);
    expect(segs).toEqual([
      { type: "text", content: "Intro " },
      { type: "copy-chip", content: "safe <!-- x --> code" },
      { type: "text", content: " Mid " },
      { type: "copy-chip", content: "legacy cmd" },
      { type: "text", content: " End" },
    ]);
  });
});
