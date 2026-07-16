import React, { useState } from "react";
import { ModelDisplay } from "@shared/types";

interface Props {
  providerId: string;
  models: ModelDisplay[] | null;
  loading: boolean;
  /** Called when a model is picked. An optional variant picks the reasoning
   *  effort level (e.g. "low"/"medium"/"high") along with the model. */
  onPick: (modelId: string, variant?: string) => void;
  t: (key: any) => string;
}

/**
 * A provider's model list. Rows show display name, attachment/reasoning icons,
 * context window, $/1M cost, and a "Recommended" tag on the first available
 * model. Entries flagged `authRequired` came from the catalog fallback (the
 * provider isn't connected yet) — they're shown greyed with a lock hint.
 */
export function ModelPicker({ providerId, models, loading, onPick, t }: Props) {
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(10);
  void providerId;
  const list = models || [];
  const needle = q.trim().toLowerCase();
  // Search filters across ALL models; pagination only limits how many of the
  // matching results are rendered at once.
  const filtered = needle
    ? list.filter((m) => `${m.name} ${m.id}`.toLowerCase().includes(needle))
    : list;
  const shown = filtered.slice(0, visible);

  return (
    <div className="mp">
      <div className="mp-search">
        <input
          className="model-input"
          type="text"
          placeholder={t("searchModels")}
          value={q}
          onChange={(e) => { setQ(e.target.value); setVisible(10); }}
        />
      </div>
      {loading && <div className="pp-empty">{t("loadingDots")}</div>}
      {!loading && filtered.length === 0 && <div className="pp-empty">{t("noModels")}</div>}
      {filtered.some((m) => m.attachment && !m.authRequired) && (
        <div className="mp-multimodal-hint">
          <i className="fa-solid fa-image"></i> {t("multimodalHint")}
        </div>
      )}
      {filtered.some((m) => m.authRequired) && (
        <div className="mp-auth-hint"><i className="fa-solid fa-lock"></i> {t("needsKey")}</div>
      )}
      <div className="model-list">
        {shown.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`model-row${m.authRequired ? " is-authreq" : ""}`}
            onClick={() => onPick(m.id)}
          >
            <div className="model-row-main">
              <span className="model-row-name">{m.name}</span>
              <span className="model-row-icons">
                {m.attachment && <i className="fa-solid fa-image" title="image"></i>}
                {m.reasoning && <i className="fa-solid fa-brain" title="reasoning"></i>}
              </span>
            </div>
            <div className="model-row-meta">
              {m.contextLimit ? (
                <span>{Math.round(m.contextLimit / 1000)}K {t("contextTok")}</span>
              ) : null}
              {m.cost && (m.cost.input || m.cost.output) ? (
                <span>${(m.cost.input || 0).toFixed(2)}+${(m.cost.output || 0).toFixed(2)} {t("perMillion")}</span>
              ) : (
                <span className="muted">—</span>
              )}
              {filtered.indexOf(m) === 0 && !m.authRequired && <span className="tag-rec">{t("recommended")}</span>}
            </div>
            {m.effortOptions && m.effortOptions.length > 0 && !m.authRequired && (
              <div className="model-row-variants">
                {m.effortOptions.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="var-chip"
                    onClick={(e) => { e.stopPropagation(); onPick(m.id, v); }}
                    title={v}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
      {filtered.length > visible && (
        <button type="button" className="load-more" onClick={() => setVisible((v) => v + 10)}>
          {t("loadMore")} ({filtered.length - visible})
        </button>
      )}
    </div>
  );
}
