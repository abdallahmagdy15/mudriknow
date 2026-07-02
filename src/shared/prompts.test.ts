import { describe, expect, it } from "vitest";
import {
  BASE_PROMPT,
  ACTION_PROMPT_FULL,
  ACTION_PROMPT_AWARE,
  SYSTEM_PROMPT,
  buildSystemPrompt,
  GUIDE_PROMPT_AWARE,
  GUIDE_PROMPT_FULL,
  COMMANDS_PROMPT_FULL,
} from "./prompts";

describe("prompts split", () => {
  it("BASE_PROMPT exists and includes the MudrikNow intro", () => {
    expect(BASE_PROMPT).toBeTypeOf("string");
    expect(BASE_PROMPT).toContain("MudrikNow");
    expect(BASE_PROMPT).toContain("UIA");
  });

  it("ACTION_PROMPT_FULL exists and includes THE CONTRACT", () => {
    expect(ACTION_PROMPT_FULL).toBeTypeOf("string");
    expect(ACTION_PROMPT_FULL).toContain("THE CONTRACT");
    expect(ACTION_PROMPT_FULL).toContain("paste_text");
  });

  it("BASE_PROMPT does NOT contain action-marker how-to", () => {
    expect(BASE_PROMPT).not.toContain("THE CONTRACT");
    expect(BASE_PROMPT).not.toContain("paste_text");
  });

  it("legacy SYSTEM_PROMPT still equals BASE + ACTION (for back-compat)", () => {
    expect(SYSTEM_PROMPT).toContain(BASE_PROMPT);
    expect(SYSTEM_PROMPT).toContain(ACTION_PROMPT_FULL);
  });
});

describe("ACTION_PROMPT_AWARE", () => {
  it("is short (under 90 words)", () => {
    expect(ACTION_PROMPT_AWARE.split(/\s+/).length).toBeLessThan(90);
  });

  it("forbids interactive markers but explicitly allows copy_to_clipboard", () => {
    expect(ACTION_PROMPT_AWARE).toContain("DISABLED");
    expect(ACTION_PROMPT_AWARE).toMatch(/copy_to_clipboard.*allowed/i);
  });

  it("tells the AI how the user can re-enable", () => {
    expect(ACTION_PROMPT_AWARE).toContain("Allow desktop actions");
    expect(ACTION_PROMPT_AWARE).toContain("settings");
  });

  it("does NOT mention guide_to (conflates with guide mode and causes false refusals)", () => {
    expect(ACTION_PROMPT_AWARE).not.toContain("guide_to");
  });

  it("explicitly clarifies Auto-Guide is a separate setting", () => {
    expect(ACTION_PROMPT_AWARE).toMatch(/Auto-Guide.*SEPARATE/i);
    expect(ACTION_PROMPT_AWARE).toContain("guide_offer");
    expect(ACTION_PROMPT_AWARE).toContain("guide_step");
  });
});

describe("buildSystemPrompt", () => {
  it("with actionsEnabled=true, includes ACTION_PROMPT_FULL not AWARE", () => {
    const out = buildSystemPrompt({ actionsEnabled: true, autoGuideEnabled: false });
    expect(out).toContain(ACTION_PROMPT_FULL);
    expect(out).not.toContain(ACTION_PROMPT_AWARE);
  });

  it("with actionsEnabled=false, includes ACTION_PROMPT_AWARE not FULL", () => {
    const out = buildSystemPrompt({ actionsEnabled: false, autoGuideEnabled: false });
    expect(out).toContain(ACTION_PROMPT_AWARE);
    expect(out).not.toContain(ACTION_PROMPT_FULL);
  });

  it("always includes BASE_PROMPT", () => {
    const out1 = buildSystemPrompt({ actionsEnabled: true, autoGuideEnabled: false });
    const out2 = buildSystemPrompt({ actionsEnabled: false, autoGuideEnabled: false });
    expect(out1).toContain(BASE_PROMPT);
    expect(out2).toContain(BASE_PROMPT);
  });
});

describe("GUIDE_PROMPT_AWARE", () => {
  it("is short (under 60 words)", () => {
    expect(GUIDE_PROMPT_AWARE.split(/\s+/).length).toBeLessThan(60);
  });

  it("forbids guide markers and tells how to enable", () => {
    expect(GUIDE_PROMPT_AWARE).toContain("guide_offer");
    expect(GUIDE_PROMPT_AWARE).toContain("DISABLED");
    expect(GUIDE_PROMPT_AWARE).toContain("Auto-Guide");
    expect(GUIDE_PROMPT_AWARE).toContain("settings");
  });
});

describe("buildSystemPrompt — guide block AWARE", () => {
  it("with autoGuideEnabled=false, includes GUIDE_PROMPT_AWARE", () => {
    const out = buildSystemPrompt({ actionsEnabled: true, autoGuideEnabled: false });
    expect(out).toContain(GUIDE_PROMPT_AWARE);
  });

  it("with autoGuideEnabled=true, does NOT include GUIDE_PROMPT_AWARE", () => {
    const out = buildSystemPrompt({ actionsEnabled: true, autoGuideEnabled: true });
    expect(out).not.toContain(GUIDE_PROMPT_AWARE);
  });
});

describe("GUIDE_PROMPT_FULL", () => {
  it("documents all four marker types", () => {
    expect(GUIDE_PROMPT_FULL).toContain("guide_offer");
    expect(GUIDE_PROMPT_FULL).toContain("guide_step");
    expect(GUIDE_PROMPT_FULL).toContain("guide_complete");
    expect(GUIDE_PROMPT_FULL).toContain("guide_abort");
  });

  it("documents when not to use guide mode (single actions, pure questions)", () => {
    expect(GUIDE_PROMPT_FULL).toContain("Don't use guide mode");
    expect(GUIDE_PROMPT_FULL).toContain("single action");
  });

  it("explicitly tells the AI it owns the use-or-not-use decision (runtime doesn't gate)", () => {
    expect(GUIDE_PROMPT_FULL).toMatch(/YOU decide whether to use guide mode/i);
    expect(GUIDE_PROMPT_FULL).toMatch(/runtime does NOT reject/i);
  });

  it("honors explicit user requests for guide mode even on short tasks", () => {
    expect(GUIDE_PROMPT_FULL).toMatch(/explicit user request/i);
    expect(GUIDE_PROMPT_FULL).toMatch(/even for 1-2 step tasks/i);
  });

  it("includes a positive example with guide_offer first", () => {
    expect(GUIDE_PROMPT_FULL).toContain("ALWAYS emit this first");
  });

  it("includes a negative example showing single-action fallback", () => {
    expect(GUIDE_PROMPT_FULL).toContain("invoke_element");
  });
});

describe("buildSystemPrompt — guide block FULL", () => {
  it("with autoGuideEnabled=true, includes GUIDE_PROMPT_FULL not AWARE", () => {
    const out = buildSystemPrompt({ actionsEnabled: true, autoGuideEnabled: true });
    expect(out).toContain(GUIDE_PROMPT_FULL);
    expect(out).not.toContain(GUIDE_PROMPT_AWARE);
  });
});

describe("markdown formatting rule", () => {
  it("BASE_PROMPT instructs the AI to use Markdown", () => {
    expect(BASE_PROMPT).toContain("MARKDOWN FORMATTING");
    expect(BASE_PROMPT).toContain("**bold**");
    expect(BASE_PROMPT).toMatch(/fenced code/i);
    expect(BASE_PROMPT).toMatch(/tables/i);
  });

  it("keeps the main answer in the response body; COPY only for discrete paste snippets", () => {
    expect(BASE_PROMPT).toMatch(/MAIN response body/i);
    expect(BASE_PROMPT).toMatch(/paste-ready deliverable/i);
    expect(BASE_PROMPT).toMatch(/do not wrap.*whole formatted answer|do not wrap your whole/i);
  });
});

describe("COMMANDS_PROMPT_FULL", () => {
  it("lists available read-only commands", () => {
    expect(COMMANDS_PROMPT_FULL).toContain("git status");
    expect(COMMANDS_PROMPT_FULL).toContain("tasklist");
    expect(COMMANDS_PROMPT_FULL).toContain("findstr");
    expect(COMMANDS_PROMPT_FULL).toContain("systeminfo");
  });

  it("lists blocked operators", () => {
    expect(COMMANDS_PROMPT_FULL).toContain(";");
    expect(COMMANDS_PROMPT_FULL).toContain("|");
    expect(COMMANDS_PROMPT_FULL).toContain(">");
  });

  it("says PowerShell not cmd.exe", () => {
    expect(COMMANDS_PROMPT_FULL).toContain("PowerShell");
    expect(COMMANDS_PROMPT_FULL).not.toContain("cmd.exe");
  });

  it("uses $env:VAR syntax not %VAR%", () => {
    expect(COMMANDS_PROMPT_FULL).toContain("$env:");
  });

  it("does NOT list ver (cmd.exe internal, doesn't exist in PowerShell)", () => {
    const systemLine = COMMANDS_PROMPT_FULL.split("\n").find(l => l.includes("System queries:"));
    if (systemLine) expect(systemLine).not.toContain(" ver ");
  });

  it("tells the AI to stay read-only", () => {
    expect(COMMANDS_PROMPT_FULL).toMatch(/READ ONLY/i);
    expect(COMMANDS_PROMPT_FULL).toMatch(/NEVER.*write.*edit.*delete/i);
  });

  it("overrides earlier six-tool references", () => {
    expect(COMMANDS_PROMPT_FULL).toMatch(/seven.*tool|seven total/i);
    expect(COMMANDS_PROMPT_FULL).toMatch(/superseded/i);
  });
});

describe("buildSystemPrompt — commands block", () => {
  it("always includes COMMANDS_PROMPT_FULL", () => {
    const out = buildSystemPrompt({ actionsEnabled: true, autoGuideEnabled: false });
    expect(out).toContain(COMMANDS_PROMPT_FULL);
  });
});
