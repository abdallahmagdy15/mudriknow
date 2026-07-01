import { useState, useRef, useEffect } from "react";
import { getRawCopyText } from "../utils/message-content";
import { CopyIcon, MarkdownIcon } from "./icons";

interface Props {
  content: string;
  variant: "ai" | "user";
  onCopy: (text: string, label: "text" | "md") => void;
}

export function MessageCopyButton({ content, variant, onCopy }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (target: Node | null) => {
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onMouseDown = (e: MouseEvent) => closeIfOutside(e.target as Node | null);
    const onFocusIn = (e: FocusEvent) => closeIfOutside(e.target as Node | null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const getRenderedText = (): string => {
    const el = containerRef.current?.closest(".message")?.querySelector(".message-content") as HTMLElement | null;
    return el?.innerText ?? "";
  };

  const copyText = () => onCopy(getRenderedText(), "text");
  const copyMd = () => {
    onCopy(getRawCopyText(content), "md");
    setOpen(false);
  };

  return (
    <div className="message-actions" ref={containerRef}>
      {variant === "ai" && (
        <div className="copy-split-wrap">
          <button className="copy-action" title="Copy" onClick={copyText}>
            <CopyIcon />
          </button>
          <button
            className="copy-action copy-action-caret"
            title="Copy options"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div className="copy-menu">
              <button className="copy-menu-item" onClick={copyMd}>
                <MarkdownIcon />
                <span>Copy as Markdown</span>
              </button>
            </div>
          )}
        </div>
      )}
      {variant === "user" && (
        <button className="copy-action" title="Copy" onClick={copyText}>
          <CopyIcon />
        </button>
      )}
    </div>
  );
}
