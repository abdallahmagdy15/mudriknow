import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { t as translate, Lang } from "@shared/i18n";

interface Props {
  onSubmit: (prompt: string) => void;
  disabled: boolean;
  /** Placeholder shown when `disabled` is true (e.g. "Connect an AI to start").
   *  When omitted, the normal inputPlaceholder is used. */
  disabledPlaceholder?: string;
  lang: Lang;
  // Feature toggles — mirror the same Config flags the settings panel edits,
  // so the composer pills and the settings switches stay in sync.
  contextCaptured: boolean;
  onCapture: () => void;
  onRelease: () => void;
  actionsEnabled: boolean;
  onToggleActions: () => void;
  autoGuideEnabled: boolean;
  onToggleGuide: () => void;
  // Variant selector (model reasoning-effort, separate group beside toggles)
  variant: string;
  effortOptions: string[];
  onVariantChange: (variant: string) => void;
}

export const ChatInput = forwardRef<{ focus: () => void }, Props>(({
  onSubmit,
  disabled,
  disabledPlaceholder,
  lang,
  contextCaptured,
  onCapture,
  onRelease,
  actionsEnabled,
  onToggleActions,
  autoGuideEnabled,
  onToggleGuide,
  variant,
  effortOptions,
  onVariantChange,
}, ref) => {
  const tp = (key: any) => translate(lang, key);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = () => {
    if (text.trim() && !disabled) {
      onSubmit(text.trim());
      setText("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // Auto-resize: start at 2 rows, expand when content exceeds ~2 lines,
  // cap at 5 lines via CSS max-height (scroll kicks in beyond that).
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(autoResize, [text]);

  // Close the variant menu on outside mousedown.
  useEffect(() => {
    if (!variantOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && !t.closest(".variant-group")) setVariantOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [variantOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <form
      className={`composer${focused ? " focus" : ""}`}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      autoComplete="off"
    >
      <div className="composer-field">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={disabled && disabledPlaceholder ? disabledPlaceholder : tp("inputPlaceholder")}
          disabled={disabled}
          rows={2}
        />
      </div>
      <div className="composer-bar">
        <div className="toggles">
          <div className="capture-group">
            <button
              type="button"
              className={`tg${contextCaptured ? " on" : ""}`}
              onClick={onCapture}
              disabled={disabled}
              title={contextCaptured ? tp("recaptureContext") : tp("captureContext")}
            >
              <i className="fa-solid fa-crosshairs"></i>
              <span>{contextCaptured ? tp("recapture") : tp("capture")}</span>
            </button>
            {contextCaptured && (
              <button
                type="button"
                className="tg-release"
                onClick={onRelease}
                disabled={disabled}
                title={tp("releaseContext")}
                aria-label={tp("releaseContext")}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
          <button
            type="button"
            className={`tg${actionsEnabled ? " on" : ""}`}
            onClick={onToggleActions}
            title={tp("allowDesktopActionsHint")}
          >
            <i className="fa-solid fa-bolt"></i>
            <span>{tp("act")}</span>
          </button>
          <button
            type="button"
            className={`tg${autoGuideEnabled ? " on" : ""}`}
            onClick={onToggleGuide}
            title={tp("enableAutoGuideHint")}
          >
            <i className="fa-solid fa-route"></i>
            <span>{tp("guide")}</span>
          </button>
        </div>
        {effortOptions.length > 0 && (
          <div className="variant-group">
            <button
              type="button"
              className={`tg vg-btn${variant ? " on" : ""}`}
              onClick={() => setVariantOpen(!variantOpen)}
              disabled={disabled}
              title={tp("variant")}
            >
              <i className="fa-solid fa-sliders"></i>
              <span>{variant || tp("defaultVariant")}</span>
            </button>
            {variantOpen && (
              <div className="variant-menu">
                <button type="button" className={`vg-opt${!variant ? " sel" : ""}`} onClick={() => { onVariantChange(""); setVariantOpen(false); }}>
                  {tp("defaultVariant")}
                </button>
                {effortOptions.map((v) => (
                  <button key={v} type="button" className={`vg-opt${variant === v ? " sel" : ""}`} onClick={() => { onVariantChange(v); setVariantOpen(false); }}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="submit"
          className="composer-send"
          disabled={!canSend}
          title={tp("send")}
          aria-label={tp("send")}
        >
          <i className="fa-solid fa-arrow-up"></i>
        </button>
      </div>
    </form>
  );
});
