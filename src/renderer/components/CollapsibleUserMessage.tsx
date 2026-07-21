import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MessageCopyButton } from "./MessageCopyButton";

// Collapsed preview height for user messages (px). Picked so a typical
// 5-6 line message shows in full, while pasted code/long text collapses
// into a preview with a centered 3-dot fade.
const COLLAPSE_THRESHOLD = 140;

interface Props {
  content: string;
  onCopy: (text: string, label: "text" | "md") => void;
}

/** Renders a user message body with copy + collapse actions in one row.
 *  Only the user side collapses (AI answers stay fully rendered). */
export function CollapsibleUserMessage({ content, onCopy }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.scrollHeight;
      setFullHeight(h);
      setCollapsible(h > COLLAPSE_THRESHOLD + 24);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);

  const collapsed = collapsible && !expanded;

  // The arrow toggle rendered inside the copy actions row (same row, same
  // hover-reveal animation as the copy button). Only shown when collapsible.
  let extraAction: ReactNode = null;
  if (collapsible) {
    extraAction = (
      <button
        className="copy-action collapse-toggle"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Collapse" : "Expand"}
        aria-expanded={expanded}
      >
        <i className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`}></i>
      </button>
    );
  }

  return (
    <>
      <div
        className={`msg-clip ${collapsed ? "is-collapsed" : ""}`}
        style={{ maxHeight: collapsed ? COLLAPSE_THRESHOLD : expanded ? fullHeight : undefined }}
      >
        <div className="message-content" ref={contentRef}>{content}</div>
      </div>
      <MessageCopyButton
        content={content}
        variant="user"
        onCopy={onCopy}
        extraAction={extraAction}
      />
    </>
  );
}
