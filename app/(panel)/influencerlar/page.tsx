"use client";
import { useMemo, useState } from "react";
import { DualBar, Scatter, type ScatterPoint } from "@/components/charts";
import { Icon } from "@/components/icons";
import { usePanel } from "@/components/panel-store";
import { TransitionLink } from "@/components/transition-link";
import { WARNING_LABEL, fmtCount, fmtDay, fmtRate, profileUrl, type Influencer } from "@/lib/influencer";
import { d } from "@/lib/ui";

const FOLLOWER_STEPS = [5000, 10000, 15000, 20000, 30000, 50000];
const RATIO_STEPS = [0, 0.005, 0.01, 0.015, 0.02, 0.03];

export default function Influencers() {
  const { all, state, dispatch, hydrated, warningsFor } = usePanel();
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);

  const excluded = useMemo(() => new Set(state.excluded), [state.excluded]);
  const selected = useMemo(() => new Set(state.selected), [state.selected]);
  const q = query.trim().toLocaleLowerCase("tr-TR");

  const active = all.filter((i) => !excluded.has(i.id));
  const shown = active.filter(
    (i) => !q || `${i.name} ${i.handle} ${i.niche}`.toLocaleLowerCase("tr-TR").includes(q),
  );
  const flaggedActive = active.filter((i) => warningsFor(i).length > 0);
  const removed = all.filter((i) => excluded.has(i.id));
  const maxFollowers = Math.max(1, ...all.map((i) => i.followers));

  const points: ScatterPoint[] = active
    .filter((i) => i.engagement !== null)
    .map((i) => ({
    id: i.id,
    name: i.name,
    x: i.followers,
    y: i.engagement ?? 0,
    flagged: warningsFor(i).length > 0,
    selected: selected.has(i.id),
  }));

  const t = state.thresholds;
  const cleanShown = shown.filter((i) => warningsFor(i).length === 0);

  return (
    <div className="page">
      <header className="page-head rise" style={d(0)}>
        <div>
          <p className="eyebrow">Ajanın bulduğu hesaplar</p>
          <h1 className="h1">Influencerlar</h1>
        </div>
      </header>

      <section className="card controls rise" style={d(100)} aria-label="Uyarı eşikleri">
        <label className="ctl">
          <span>Takipçi alt sınırı</span>
          <select
            className="input"
            value={t.minFollowers}
            onChange={(e) => dispatch({ type: "thresholds", value: { minFollowers: Number(e.target.value) } })}
          >
            {(FOLLOWER_STEPS.includes(t.minFollowers) ? FOLLOWER_STEPS : [...FOLLOWER_STEPS, t.minFollowers].sort((a, b) => a - b)).map((v) => (
              <option key={v} value={v}>
                {fmtCount(v)} altı uyar
              </option>
            ))}
          </select>
        </label>
        <label className="ctl">
          <span>Etkileşim oranı alt sınırı</span>
          <select
            className="input"
            value={t.minEngagement}
            onChange={(e) => dispatch({ type: "thresholds", value: { minEngagement: Number(e.target.value) } })}
          >
            {(RATIO_STEPS.includes(t.minEngagement) ? RATIO_STEPS : [...RATIO_STEPS, t.minEngagement].sort((a, b) => a - b)).map((v) => (
              <option key={v} value={v}>
                {v === 0 ? "Kontrol etme" : `${fmtRate(v)} altı uyar`}
              </option>
            ))}
          </select>
        </label>
        <label className="ctl ctl-grow">
          <span>Ara</span>
          <input className="input" type="search" placeholder="İsim, hesap veya alan" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="ctl-hint">
          <b>Etkileşim oranı</b> = (ort. beğeni + ort. yorum) ÷ takipçi, son 12 gönderiden. Düşükse takipçilerin ilgisi zayıf ya da takipçi satın alınmış olabilir.
        </div>
      </section>

      <div className="cols">
        <section className="list-col" aria-label="Influencer listesi">
          {flaggedActive.length > 0 && (
            <div className="banner rise" style={d(160)} role="status">
              <Icon name="warn" size={20} />
              <p>
                <b>{flaggedActive.length} hesap</b> eşiğin altında kaldı.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-warn"
                onClick={() => dispatch({ type: "exclude", ids: flaggedActive.map((i) => i.id) })}
              >
                Hepsini etkileşimden çıkar
              </button>
            </div>
          )}

          <ul className="rows">
            {shown.map((i, idx) => (
              <Row
                key={i.id}
                inf={i}
                idx={idx}
                max={maxFollowers}
                warnings={warningsFor(i)}
                checked={selected.has(i.id)}
                hovered={hover === i.id}
                onHover={setHover}
              />
            ))}
          </ul>
          {shown.length === 0 && (
            <p className="empty">{all.length === 0 ? "Henüz aday yok. Ajan hesap bulunca burada görünür." : active.length === 0 ? "Listede aktif hesap kalmadı." : "Aramanla eşleşen hesap yok."}</p>
          )}

          {removed.length > 0 && (
            <details className="removed">
              <summary>Etkileşimden çıkarılanlar ({removed.length})</summary>
              <ul className="removed-list">
                {removed.map((i) => (
                  <li key={i.id}>
                    <span>
                      {i.name} <span className="muted">@{i.handle}</span>
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "restore", id: i.id })}>
                      <Icon name="undo" size={15} /> Geri al
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <aside className="side-col">
          <div className="card sticky rise" style={d(220)}>
            <h2 className="h2">Takipçi ve etkileşim</h2>
            <p className="muted small">Her nokta bir hesap. Taranan bölgede kalanlar uyarılıdır.</p>
            <Scatter points={points} minFollowers={t.minFollowers} minEngagement={t.minEngagement} hoverId={hover} onHover={setHover} />
            <ul className="legend">
              <li><i className="dot dot-ok" /> Uygun</li>
              <li><i className="dot dot-flag" /> Uyarılı</li>
              <li><i className="dot dot-sel" /> Seçili</li>
            </ul>
            <dl className="mini-stats">
              <div>
                <dt>Aktif</dt>
                <dd className="num">{active.length}</dd>
              </div>
              <div>
                <dt>Uygun</dt>
                <dd className="num">{active.length - flaggedActive.length}</dd>
              </div>
              <div>
                <dt>Seçili</dt>
                <dd className="num">{state.selected.length}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <div className="dock" data-show={hydrated && (state.selected.length > 0 || cleanShown.length > 0)}>
        <div className="dock-info">
          <b className="num">{state.selected.length}</b> hesap seçili
        </div>
        <div className="dock-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={cleanShown.length === 0}
            onClick={() => dispatch({ type: "select", ids: cleanShown.map((i) => i.id) })}
          >
            Uygun olanları seç
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={state.selected.length === 0} onClick={() => dispatch({ type: "clearSelection" })}>
            Temizle
          </button>
          <TransitionLink href="/mailler" className="btn btn-primary btn-sm" aria-disabled={state.selected.length === 0} data-disabled={state.selected.length === 0}>
            Mail taslaklarını hazırla <Icon name="arrow" size={15} />
          </TransitionLink>
        </div>
      </div>
    </div>
  );
}

function Row({
  inf,
  idx,
  max,
  warnings,
  checked,
  hovered,
  onHover,
}: {
  inf: Influencer;
  idx: number;
  max: number;
  warnings: ReturnType<ReturnType<typeof usePanel>["warningsFor"]>;
  checked: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const { dispatch } = usePanel();
  const flagged = warnings.length > 0;
  return (
    <li
      className={`row rise${flagged ? " row-flag" : ""}${checked ? " row-sel" : ""}${hovered ? " row-hover" : ""}`}
      style={d(200 + Math.min(idx, 10) * 45)}
      onMouseEnter={() => onHover(inf.id)}
      onMouseLeave={() => onHover(null)}
    >
      <label className="check">
        <input type="checkbox" checked={checked} onChange={() => dispatch({ type: "toggleSelect", id: inf.id })} aria-label={`${inf.name} seç`} />
        <span className="check-box" aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
      </label>

      <span className="avatar" aria-hidden="true">{inf.name.slice(0, 1)}</span>

      <div className="who">
        <p className="who-name">
          {inf.name}
        </p>
        <p className="who-sub">
          <a href={profileUrl(inf)} target="_blank" rel="noopener noreferrer" className="handle">
            <Icon name={inf.platform === "instagram" ? "ig" : "tt"} size={14} /> @{inf.handle}
          </a>
          <span className="dotsep">·</span>
          <span>{inf.niche || "alan yok"}</span>
          <span className="dotsep">·</span>
          <span>{fmtDay(inf.foundAt)}</span>
        </p>
        {flagged && (
          <p className="warns">
            {warnings.map((w) => (
              <span key={w} className="warn-pill">
                <Icon name="warn" size={13} /> {WARNING_LABEL[w]}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="metrics">
        <div className="metric">
          <span className="metric-n num">{fmtCount(inf.followers)}</span>
          <span className="metric-l">takipçi</span>
        </div>
        <div className="metric">
          <span className="metric-n num">{inf.verified ? fmtCount(inf.avgLikes) : "—"}</span>
          <span className="metric-l">ort. beğeni</span>
        </div>
        <div className="metric">
          <span className={`metric-n num${warnings.includes("low-engagement") ? " bad" : ""}`}>
            {inf.engagement === null ? "—" : fmtRate(inf.engagement)}
          </span>
          <span className="metric-l">etkileşim</span>
        </div>
        <DualBar followers={inf.followers} engagement={inf.engagement} max={max} />
      </div>

      <button type="button" className="btn btn-ghost btn-sm row-remove" onClick={() => dispatch({ type: "exclude", ids: [inf.id] })} title="Etkileşimden çıkar" aria-label={`${inf.name} hesabını etkileşimden çıkar`}>
        <Icon name="close" size={15} /> <span>Çıkar</span>
      </button>
    </li>
  );
}
