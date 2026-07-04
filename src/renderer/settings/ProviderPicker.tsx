import React, { useState } from "react";
import { ProviderStatus } from "@shared/types";
import { POPULAR_PROVIDER_IDS } from "@shared/provider-catalog";

interface Props {
  providers: ProviderStatus[] | null;
  loading: boolean;
  onPick: (p: ProviderStatus) => void;
  /** Opens the API-key card (replace mode) for an already-connected
   *  provider, straight from the list. */
  onEditKey: (p: ProviderStatus) => void;
  t: (key: any) => string;
}

/**
 * Searchable grid of providers. Popular ones (per POPULAR_PROVIDER_IDS) pin
 * to the top, then already-connected ones, then alphabetical. Each card shows
 * a live status badge: green "Connected" / amber "Needs key" / "Free".
 */
export function ProviderPicker({ providers, loading, onPick, onEditKey, t }: Props) {
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(10);

  const list = (providers || []).slice();
  const popRank = (id: string) => {
    const i = POPULAR_PROVIDER_IDS.indexOf(id);
    return i === -1 ? 999 : i;
  };
  list.sort((a, b) => {
    if (popRank(a.id) !== popRank(b.id)) return popRank(a.id) - popRank(b.id);
    if (!!a.authenticated !== !!b.authenticated) return a.authenticated ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const needle = q.trim().toLowerCase();
  // Search filters across ALL providers; pagination only limits rendering.
  const filtered = needle
    ? list.filter((p) => `${p.name} ${p.id}`.toLowerCase().includes(needle))
    : list;
  const shown = filtered.slice(0, visible);

  return (
    <div className="pp">
      <div className="pp-search">
        <input
          className="model-input"
          type="text"
          placeholder={t("searchProviders")}
          value={q}
          onChange={(e) => { setQ(e.target.value); setVisible(10); }}
        />
      </div>
      {loading && <div className="pp-empty">{t("loadingDots")}</div>}
      {!loading && filtered.length === 0 && <div className="pp-empty">{t("noProviders")}</div>}
      <div className="provider-list">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`provider-row${p.authenticated ? " is-authed" : ""}${p.free ? " is-free" : ""}`}
            onClick={() => onPick(p)}
            title={p.id}
          >
            <img
              className="provider-logo"
              src={p.logoUrl}
              alt=""
              onError={(e) => {
                // models.dev unreachable (offline) → hide img, name still shows.
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
            <span className="provider-row-name">{p.name}</span>
            {p.authenticated && (
              <button
                type="button"
                className="provider-edit-key"
                onClick={(e) => { e.stopPropagation(); onEditKey(p); }}
                title={t("editApiKey")}
                aria-label={t("editApiKey")}
              >
                <i className="fa-solid fa-key"></i>
              </button>
            )}
            <span className={`status-badge ${p.authenticated ? "badge-ok" : "badge-needs"}`}>
              {p.authenticated ? t("connected") : t("needsKey")}
            </span>
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
