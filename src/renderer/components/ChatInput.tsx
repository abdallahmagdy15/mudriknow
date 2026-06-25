import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { t as translate, Lang } from "@shared/i18n";

interface Props {
  onSubmit: (prompt: string) => void;
  disabled: boolean;
  lang: Lang;
  // Feature toggles — mirror the same Config flags the settings panel edits,
  // so the composer pills and the settings switches stay in sync.
  contextCaptured: boolean;
  onToggleCapture: () => void;
  actionsEnabled: boolean;
  onToggleActions: () => void;
  autoGuideEnabled: boolean;
  onToggleGuide: () => void;
}

export const ChatInput = forwardRef<{ focus: () => void }, Props>(({
  onSubmit,
  disabled,
  lang,
  contextCaptured,
  onToggleCapture,
  actionsEnabled,
  onToggleActions,
  autoGuideEnabled,
  onToggleGuide,
}, ref) => {
  const tp = (key: any) => translate(lang, key);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
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
          placeholder={tp("inputPlaceholder")}
          disabled={disabled}
          rows={2}
        />
      </div>
      <div className="composer-bar">
        <div className="toggles">
          <button
            type="button"
            className={`tg${contextCaptured ? " on" : ""}`}
            onClick={onToggleCapture}
            disabled={disabled}
            title={contextCaptured ? tp("releaseContext") : tp("captureContext")}
          >
            <i className="fa-solid fa-crosshairs"></i>
            <span>{tp("capture")}</span>
          </button>
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
