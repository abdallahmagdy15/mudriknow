import React, { useEffect, useState } from "react";
import { ProviderStatus, ModelDisplay } from "@shared/types";
import { ProviderPicker } from "./ProviderPicker";
import { ModelPicker } from "./ModelPicker";
import { ApiKeyCard } from "./ApiKeyCard";

interface Props {
  currentModel: string;
  recentModels: string[];
  onSwitchModel: (model: string) => void;
  onRemoveModel: (model: string) => void;
  t: (key: any) => string;
}

type View = "recent" | "providers" | "keycard" | "models" | "manage";

/**
 * Orchestrates the model-settings flow:
 *
 *   recent ──Add a model──▶ providers ──pick──▶ (free/authed? → models
 *                                            else → keycard → models) ──pick──▶ recent
 *
 * Owns provider/model fetching + the live auth-status map used to render the
 * status dots on the recent-models list. The App parent only supplies the
 * current model, the recent list, and switch/remove callbacks.
 */
export function ModelSettings({ currentModel, recentModels, onSwitchModel, onRemoveModel, t }: Props) {
  const [view, setView] = useState<View>("recent");
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [models, setModels] = useState<ModelDisplay[] | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [sel, setSel] = useState<ProviderStatus | null>(null);
  // Remembers which view opened the key card so Cancel returns there
  // (providers → new connection, manage → editing an existing provider's key).
  const [keycardFrom, setKeycardFrom] = useState<View>("providers");

  const fetchProviders = async () => {
    setProvidersLoading(true);
    try {
      const p = await window.hoverbuddy.listProviders();
      setProviders(p || []);
    } catch {
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  };

  useEffect(() => {
    void fetchProviders();
  }, []);

  // Re-fetch provider auth status whenever we return to the recent list, so
  // status dots reflect keys saved/removed during the picker flow.
  useEffect(() => {
    if (view === "recent") void fetchProviders();
  }, [view]);

  const authMap: Record<string, ProviderStatus> = {};
  (providers || []).forEach((p) => { authMap[p.id] = p; });

  const openModels = async (providerId: string) => {
    setView("models");
    setModels(null);
    setModelsLoading(true);
    try {
      const m = await window.hoverbuddy.listModels(providerId);
      setModels(m || []);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const pickProvider = (p: ProviderStatus) => {
    setSel(p);
    if (p.free || p.authenticated) {
      void openModels(p.id);
    } else {
      setKeycardFrom("providers");
      setView("keycard");
    }
  };

  /** Open the key card (replace mode) for an already-connected provider,
   *  reached from the provider-list's inline edit-key button. */
  const editProviderKey = (p: ProviderStatus) => {
    setSel(p);
    setKeycardFrom("providers");
    setView("keycard");
  };

  const onKeySaved = () => {
    void fetchProviders(); // refresh status dots
    if (sel) void openModels(sel.id);
    else setView("recent");
  };

  const pickModel = (modelId: string) => {
    onSwitchModel(modelId);
    setView("recent");
  };

  /** Open the per-provider manage hub for a recent model's provider — lets the
   *  user pick another model, switch provider, or edit the key. Replaces the
   *  old "pen = jump to key change" behaviour which was confusing. */
  const manageProvider = (modelId: string) => {
    const pid = modelId.split("/")[0];
    const s = authMap[pid];
    if (s) {
      setSel(s);
      setView("manage");
    }
  };

  return (
    <div className="ms">
      {view === "recent" && (
        <>
          <div className="ms-recent">
            {recentModels.map((m) => {
              const pid = m.split("/")[0];
              const st = authMap[pid];
              const ok = st ? st.free || st.authenticated : false;
              return (
                <div
                  key={m}
                  className={`model-option ${m === currentModel ? "model-active" : ""}`}
                  onClick={() => onSwitchModel(m)}
                >
                  <span
                    className={`status-dot ${ok ? "dot-ok" : "dot-needs"}`}
                    title={ok ? t("connected") : t("needsKey")}
                  ></span>
                  <span className="model-name">{m.split("/").pop()}</span>
                  <span className="model-provider">{pid}</span>
                  {m === currentModel && (
                    <span className="model-check"><i className="fa-solid fa-check"></i></span>
                  )}
                  <button
                    type="button"
                    className="model-edit-key"
                    onClick={(e) => { e.stopPropagation(); manageProvider(m); }}
                    title={t("manage")}
                    aria-label={t("manage")}
                  >
                    <i className="fa-solid fa-gear"></i>
                  </button>
                  {recentModels.length > 1 && (
                    <button
                      type="button"
                      className="model-remove"
                      onClick={(e) => { e.stopPropagation(); onRemoveModel(m); }}
                      title={t("removeKey")}
                      aria-label={t("removeKey")}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="ms-add" onClick={() => { void fetchProviders(); setView("providers"); }}>
            <i className="fa-solid fa-plus"></i> {t("addModel")}
          </button>
        </>
      )}

      {view === "providers" && (
        <div className="ms-sub">
          <button type="button" className="ms-back" onClick={() => setView("recent")}>
            <i className="fa-solid fa-arrow-left"></i> {t("back")}
          </button>
          <div className="settings-sublabel">{t("pickProvider")}</div>
          <ProviderPicker providers={providers} loading={providersLoading} onPick={pickProvider} onEditKey={editProviderKey} t={t} />
        </div>
      )}

      {view === "keycard" && sel && (
        <div className="ms-sub">
          <button type="button" className="ms-back" onClick={() => setView(keycardFrom)}>
            <i className="fa-solid fa-arrow-left"></i> {t("back")}
          </button>
          <div className="settings-sublabel">{t("connectProvider")} · {sel.name}</div>
          <ApiKeyCard
            providerId={sel.id}
            providerName={sel.name}
            keyUrl={sel.keyUrl}
            mode={sel.authenticated ? "replace" : "add"}
            t={t}
            onSaved={onKeySaved}
            onCancel={() => setView(keycardFrom)}
          />
        </div>
      )}

      {view === "manage" && sel && (
        <div className="ms-sub">
          <button type="button" className="ms-back" onClick={() => setView("recent")}>
            <i className="fa-solid fa-arrow-left"></i> {t("back")}
          </button>
          <div className="settings-sublabel">{t("manageProvider")} · {sel.name}</div>
          <div className="manage-status">
            <span className={`status-dot ${sel.free || sel.authenticated ? "dot-ok" : "dot-needs"}`}></span>
            {sel.free ? t("free") : sel.authenticated ? t("connected") : t("needsKey")}
          </div>
          <div className="manage-actions">
            <button type="button" className="manage-action" onClick={() => void openModels(sel.id)}>
              <i className="fa-solid fa-list"></i> {t("pickAnotherModel")}
            </button>
            <button type="button" className="manage-action" onClick={() => { setKeycardFrom("manage"); setView("keycard"); }}>
              <i className="fa-solid fa-key"></i> {t("editApiKey")}
            </button>
            <button type="button" className="manage-action" onClick={() => { void fetchProviders(); setView("providers"); }}>
              <i className="fa-solid fa-shuffle"></i> {t("switchProvider")}
            </button>
          </div>
        </div>
      )}

      {view === "models" && sel && (
        <div className="ms-sub">
          <button type="button" className="ms-back" onClick={() => setView("recent")}>
            <i className="fa-solid fa-arrow-left"></i> {t("back")}
          </button>
          <div className="settings-sublabel">{t("pickModel")} · {sel.name}</div>
          <ModelPicker providerId={sel.id} models={models} loading={modelsLoading} onPick={pickModel} t={t} />
        </div>
      )}
    </div>
  );
}
