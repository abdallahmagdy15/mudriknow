import { describe, expect, it } from "vitest";
import { settingsDeltaParts, buildSettingsDeltaBlock, buildSettingsSnapshotBlock, SettingsSnap } from "./settings-delta";

describe("settingsDeltaParts", () => {
  it("returns empty when nothing changed vs snapshot", () => {
    const snap: SettingsSnap = { actionsEnabled: true, autoGuideEnabled: false };
    expect(settingsDeltaParts(snap, true, false)).toEqual([]);
  });

  it("detects actions flip", () => {
    const snap: SettingsSnap = { actionsEnabled: true, autoGuideEnabled: false };
    expect(settingsDeltaParts(snap, false, false)).toEqual(["actions: ON->OFF"]);
  });

  it("detects guide flip", () => {
    const snap: SettingsSnap = { actionsEnabled: true, autoGuideEnabled: false };
    expect(settingsDeltaParts(snap, true, true)).toEqual(["guide: OFF->ON"]);
  });

  it("detects both flips", () => {
    const snap: SettingsSnap = { actionsEnabled: false, autoGuideEnabled: true };
    expect(settingsDeltaParts(snap, true, false)).toEqual(["actions: OFF->ON", "guide: ON->OFF"]);
  });

  it("treats null snapshot as unknown baseline and reports current values", () => {
    expect(settingsDeltaParts(null, true, false)).toEqual(["actions: ?->ON", "guide: ?->OFF"]);
  });
});

describe("buildSettingsDeltaBlock", () => {
  it("returns empty string when nothing changed", () => {
    const snap: SettingsSnap = { actionsEnabled: true, autoGuideEnabled: false };
    expect(buildSettingsDeltaBlock(snap, true, false, "2026-07-31 10:00:00")).toBe("");
  });

  it("embeds timestamp, changed parts, and OVERRIDE instruction", () => {
    const snap: SettingsSnap = { actionsEnabled: false, autoGuideEnabled: false };
    const out = buildSettingsDeltaBlock(snap, true, true, "2026-07-31 10:00:00");
    expect(out).toContain("SETTINGS UPDATE @ 2026-07-31 10:00:00");
    expect(out).toContain("actions: OFF->ON");
    expect(out).toContain("guide: OFF->ON");
    expect(out).toMatch(/OVERRIDE/i);
  });
});

describe("buildSettingsSnapshotBlock", () => {
  it("renders both settings with ON/OFF and timestamp", () => {
    const out = buildSettingsSnapshotBlock(true, false, "2026-07-31 10:00:00");
    expect(out).toContain("SETTINGS @ 2026-07-31 10:00:00");
    expect(out).toContain("actions=ON");
    expect(out).toContain("guide=OFF");
    expect(out).toMatch(/newer SETTINGS timestamp/i);
  });
});
