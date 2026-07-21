import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Height (px) at which a message body collapses into a preview + "Show more".
// Picked to fit ~10-12 lines of text — enough to preview a normal reply while
// keeping long code dumps / verbose answers scannable.
const COLLAPSE_THRESHOLD = 220;

interface Props {
  children: ReactNode;
  showLabel: string;
  hideLabel: string;
}

export function CollapsibleBody({ children, showLabel, hideLabel }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // collapsible flips on only if the content actually exceeds the threshold;
  // otherwise the body renders verbatim with no toggle.
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
    // Re-measure on panel resize, image load, font swap, etc.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!collapsible) {
    return <div ref={contentRef}>{children}</div>;
  }

  // Animate between the collapsed preview height and the full measured height.
  // scrollHeight is unaffected by max-height, so `fullHeight` is the true size.
  const targetHeight = expanded ? fullHeight : COLLAPSE_THRESHOLD;

  return (
    <div className={`collapsible-body ${expanded ? "is-expanded" : "is-collapsed"}`}>
      <div
        className="collapsible-body-inner"
        ref={contentRef}
        style={{ maxHeight: targetHeight }}
      >
        {children}
      </div>
      <button
        className="collapsible-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <i className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`}></i>
        {expanded ? hideLabel : showLabel}
      </button>
    </div>
  );
}
