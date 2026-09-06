// Pure helpers for the settings-change notice injected into the AI's message
// stream. Kept in a side module (not inside ipc-handlers.ts) so the branchy
// delta logic is unit-testable without loading electron/robotjs/koffi.

export interface SettingsSnap {
  actionsEnabled: boolean;
  autoGuideEnabled: boolean;
}

const onOff = (v: boolean) => (v ? "ON" : "OFF");

/**
 * Compute which model-visible settings changed between the last snapshot the
 * AI was told about and the current live values. Returns label strings like
 * "actions: OFF->ON". Empty array means nothing relevant changed (no delta
 * notice should be emitted).
 *
 * When `snapshot` is null (AI was never told a baseline), the "old" side is
 * rendered as "?" so the model still sees the current value.
 */
export function settingsDeltaParts(
  snapshot: SettingsSnap | null,
  actions: boolean,
  guide: boolean
): string[] {
  const parts: string[] = [];
  if (!snapshot || actions !== snapshot.actionsEnabled) {
    parts.push(`actions: ${snapshot ? onOff(snapshot.actionsEnabled) : "?"}->${onOff(actions)}`);
  }
  if (!snapshot || guide !== snapshot.autoGuideEnabled) {
    parts.push(`guide: ${snapshot ? onOff(snapshot.autoGuideEnabled) : "?"}->${onOff(guide)}`);
  }
  return parts;
}

/**
 * Build the full "SETTINGS UPDATE" notice block for a follow-up turn.
 * Returns "" when nothing changed (caller should emit nothing).
 */
export function buildSettingsDeltaBlock(
  snapshot: SettingsSnap | null,
  actions: boolean,
  guide: boolean,
  time: string
): string {
  const parts = settingsDeltaParts(snapshot, actions, guide);
  if (parts.length === 0) return "";
  return `\n--- SETTINGS UPDATE @ ${time} | ${parts.join(", ")} ---\nThe user changed these settings after the last SETTINGS snapshot in this conversation. OVERRIDE any earlier actions/guide instruction you were given; follow these latest values. (Newest timestamp wins.)\n--- END SETTINGS ---\n\n`;
}

/**
 * Build the full "SETTINGS" snapshot block emitted on a fresh system-prompt
 * send (first message / new context capture / new session).
 */
export function buildSettingsSnapshotBlock(actions: boolean, guide: boolean, time: string): string {
  return `\n--- SETTINGS @ ${time} | actions=${onOff(actions)} guide=${onOff(guide)} ---\nThese are the current live settings as of the timestamp above. If a later turn carries a newer SETTINGS timestamp (full snapshot or UPDATE notice), that newer one wins.\n--- END SETTINGS ---\n`;
}

/**
 * Regexes for prompt artifacts MudrikNow prepends to user text. Follow-up
 * turns carry no USER MESSAGE wrapper, so on session restore these blocks
 * would otherwise be replayed to the user as if they typed them.
 */
const INJECTED_ARTIFACT_PATTERNS: RegExp[] = [
  /--- SETTINGS UPDATE @ [\s\S]*?--- END SETTINGS ---\s*/g,
  /--- SETTINGS @ [\s\S]*?--- END SETTINGS ---\s*/g,
  /\[Note: I cancelled the in-progress guide walkthrough[^\]]*\]\s*/g,
];

/** Strip injected prompt artifacts (SETTINGS blocks, guide stop-note) from a
 *  stored user message so session restore shows only what the user typed. */
export function stripInjectedPromptArtifacts(content: string): string {
  let out = content;
  for (const p of INJECTED_ARTIFACT_PATTERNS) out = out.replace(p, "");
  return out.trim();
}
