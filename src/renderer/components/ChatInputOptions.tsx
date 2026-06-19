import * as React from "react";

interface Props {
  caption?: string;
  stepIndex?: number;
  estStepsLeft?: number;
  options: string[];
  /** Index of the Cancel option — styled red regardless of text. */
  cancelIndex?: number;
  onChoose: (option: string) => void;
}

function layoutFor(n: number): "row" | "list" | "grid" {
  if (n <= 2) return "row";
  if (n === 3) return "list";
  return "grid";
}

export const ChatInputOptions: React.FC<Props> = ({
  caption,
  stepIndex,
  estStepsLeft,
  options,
  cancelIndex,
  onChoose,
}) => {
  const layout = layoutFor(options.length);
  // The controller sends options in final order: AI options first, then
  // localized Cancel, then localized Something else. No reordering needed.
  // cancelIndex identifies the Cancel button for red styling; the option
  // right after it (if any) is Something else → secondary styling.
  return (
    <div className={`chat-input-options ${layout}`}>
      {caption && (
        <div className="step-caption">
          {typeof stepIndex === "number" && (
            <span className="step-marker">
              Step {stepIndex} · ~{estStepsLeft ?? 0} left
            </span>
          )}
          <span className="caption-text">{caption}</span>
        </div>
      )}
      <div className="options-bar">
        {options.map((opt, i) => {
          const isCancel = i === cancelIndex;
          return (
            <button
              key={i}
              className={`option-btn ${isCancel ? "cancel" : "ok"}`}
              onClick={() => onChoose(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChatInputOptions;
