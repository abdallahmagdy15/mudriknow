import React, { useState } from "react";

interface ApiKeyCardProps {
  providerId: string;
  providerName: string;
  keyUrl: string;
  /** "add" when connecting fresh, "replace" when editing an existing key
   *  (shows the Remove affordance). */
  mode: "add" | "replace";
  t: (key: any) => string;
  onSaved: () => void;
  onCancel: () => void;
}

type Phase = "idle" | "verifying" | "valid" | "invalid" | "saving";

/**
 * API-key entry card with a real Verify button. The Verify and Save actions
 * both route through the main process's VERIFY_KEY / SAVE_API_KEY(verify)
 * which spawn `opencode run` in an isolated env — so "✓ Key works" means the
 * key actually authenticated against the provider, not just that it was
 * accepted locally.
 */
export function ApiKeyCard({ providerId, providerName, keyUrl, mode, t, onSaved, onCancel }: ApiKeyCardProps) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const trim = key.trim();
  const busy = phase === "verifying" || phase === "saving";

  const doVerify = async () => {
    if (!trim) return;
    setPhase("verifying");
    setMsg(null);
    try {
      const r: any = await window.hoverbuddy.verifyKey(providerId, trim);
      if (r.ok) setPhase("valid");
      else { setPhase("invalid"); setMsg(r.message || t("invalidKey")); }
    } catch (e: any) {
      setPhase("invalid");
      setMsg(e?.message || t("invalidKey"));
    }
  };

  const doSave = async () => {
    if (!trim) return;
    setPhase("saving");
    setMsg(null);
    try {
      // Save persists the key as-is. The explicit Verify button is the
      // pre-flight check; we don't re-run it here because a transient
      // INCONCLUSIVE (slow provider, server hiccup) would otherwise block
      // saving a key the user just confirmed works. If the key is bad, the
      // send path now surfaces a clear classified error.
      const r: any = await window.hoverbuddy.saveApiKey(providerId, trim);
      if (r.ok) { onSaved(); }
      else { setPhase("idle"); setMsg(r.error || t("invalidKey")); }
    } catch (e: any) {
      setPhase("idle");
      setMsg(e?.message || t("invalidKey"));
    }
  };

  const doRemove = async () => {
    await window.hoverbuddy.removeApiKey(providerId);
    onSaved();
  };

  return (
    <div className="api-key-prompt akc">
      <div className="api-key-label">
        {mode === "add" ? t("apiKeyFor") : t("replaceKeyFor")}
        <span className="api-key-provider">{providerName || providerId}</span>
      </div>
      <div className="key-step-hint">{t("keyStepHint")}</div>
      <div className="model-input-row">
        <input
          className="model-input"
          type={show ? "text" : "password"}
          placeholder={t("pasteKeyHint")}
          value={key}
          onChange={(e) => { setKey(e.target.value); setPhase("idle"); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") doVerify(); }}
          disabled={busy}
          autoComplete="new-password"
          spellCheck={false}
          autoFocus
        />
        <button type="button" className="model-input-btn akc-eye" onClick={() => setShow(!show)} title={show ? "hide" : "show"} tabIndex={-1}>
          <i className={`fa-solid ${show ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
        <button type="button" className="model-input-btn" onClick={doVerify} disabled={busy || !trim} title={t("verify")}>
          {phase === "verifying" ? "..." : t("verify")}
        </button>
        <button type="button" className="model-input-btn model-input-btn-primary" onClick={doSave} disabled={busy || !trim}>
          {phase === "saving" ? "..." : t("save")}
        </button>
        <button type="button" className="model-input-btn model-input-btn-secondary" onClick={onCancel} disabled={busy} title={t("cancel")} tabIndex={-1}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="akc-status">
        {phase === "valid" && <span className="akc-ok"><i className="fa-solid fa-circle-check"></i> {t("verified")}</span>}
        {(phase === "invalid" || msg) && <span className="akc-bad"><i className="fa-solid fa-circle-exclamation"></i> {msg || t("invalidKey")}</span>}
      </div>
      <div className="akc-foot">
        <button type="button" className="key-link" onClick={() => window.hoverbuddy.openExternal(keyUrl)}>
          <i className="fa-solid fa-arrow-up-right-from-square"></i> {t("getKey")}
        </button>
        {mode === "replace" && (
          <button type="button" className="key-link key-link-danger" onClick={doRemove} disabled={busy}>
            <i className="fa-solid fa-trash"></i> {t("removeKey")}
          </button>
        )}
      </div>
      <div className="api-key-hint">{t("storedLocally")}</div>
    </div>
  );
}
