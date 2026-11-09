"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { usePanel } from "@/components/panel-store";
import { TransitionLink } from "@/components/transition-link";
import { DM_LIMIT, DM_NOTE_LIMIT, dmDiff, dmDraft, dmHandle, dmReduce, dmStatus, dmUrl, initialDm, sanitizeDm, type DmChannel, type DmItem } from "@/lib/dm-state";
import { TEMPLATE_FIELDS, fmtCount, fmtDay, needsContact, type Influencer } from "@/lib/influencer";
import { d } from "@/lib/ui";

const LEGACY_KEY = "lume-dm-v1"; // eski tarayıcı kaydı: bir kez Supabase'e aktarılır, sonra yalnızca yedek kalır
const IMPORTED_KEY = "lume-dm-imported-v1";
const STATUS_LABEL = { taslak: "Onay bekliyor", onayli: "Onaylandı", gonderildi: "Gönderildi", yanit: "Yanıt geldi" } as const;

export default function DmKontrol() {
  const { all, state, readOnly, loadError } = usePanel();
  const known = useMemo(() => new Set(all.map((i) => i.id)), [all]);
  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);
  const [dm, dispatchRaw] = useReducer(dmReduce, initialDm);
  const dispatch = readOnly ? () => {} : dispatchRaw;
  const [tab, setTab] = useState<"todo" | "sent" | "template">("todo");

  const [dmError, setDmError] = useState(false); // sunucudan okunamadı: yazmayı kapat, üzerine yazma
  const [save, setSave] = useState<"idle" | "saving" | "error">("idle");
  const [retry, setRetry] = useState(0);
  const synced = useRef<{ items: DmItem[]; template: string } | null>(null); // sunucuda bildiğimiz son durum
  const importPending = useRef(false);

  const markImported = () => {
    try {
      localStorage.setItem(IMPORTED_KEY, "1");
    } catch {}
  };

  useEffect(() => {
    let live = true;
    (async () => {
      if (readOnly || loadError) {
        dispatchRaw({ type: "hydrate", state: sanitizeDm({}, known) });
        return;
      }
      try {
        const res = await fetch("/api/dm", { cache: "no-store" });
        if (!res.ok) throw new Error("dm");
        const j = (await res.json()) as { template: string | null; items: unknown[] };
        let st = sanitizeDm({ template: j.template, items: j.items }, known);
        const base = { items: st.items, template: st.template };
        let imported = false;
        try {
          imported = localStorage.getItem(IMPORTED_KEY) === "1";
        } catch {}
        if (!imported) {
          try {
            const raw = localStorage.getItem(LEGACY_KEY);
            if (raw) {
              const old = sanitizeDm(JSON.parse(raw), known);
              const have = new Set(st.items.map((x) => x.id));
              const extra = old.items.filter((x) => !have.has(x.id));
              st = { ...st, items: [...st.items, ...extra], template: j.template ? st.template : old.template };
              importPending.current = extra.length > 0 || st.template !== base.template;
            }
          } catch {}
          if (!importPending.current) markImported();
        }
        if (!live) return;
        synced.current = base; // fark, içe aktarılanları kendiliğinden sunucuya yazar
        dispatchRaw({ type: "hydrate", state: st });
      } catch {
        if (live) setDmError(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [known, loadError, readOnly]);

  useEffect(() => {
    if (!dm.ready || readOnly || loadError || dmError || !synced.current) return;
    const base = synced.current;
    const diff = dmDiff(base.items, dm.items);
    const tplChanged = dm.template !== base.template;
    if (!diff.upsert.length && !diff.remove.length && !tplChanged) return;
    const snapshot = { items: dm.items, template: dm.template };
    const t = setTimeout(async () => {
      setSave("saving");
      try {
        const res = await fetch("/api/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upsert: diff.upsert, remove: diff.remove, ...(tplChanged ? { template: dm.template } : {}) }),
        });
        if (!res.ok) throw new Error("dm");
        synced.current = snapshot;
        if (importPending.current) {
          importPending.current = false;
          markImported();
        }
        setSave("idle");
      } catch {
        setSave("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [dm, readOnly, loadError, dmError, retry]);

  const items = dm.items.filter((x) => byId.has(x.influencerId));
  const todo = items.filter((x) => !x.sentAt);
  const sent = items.filter((x) => x.sentAt);
  const tabs = [
    { id: "todo" as const, label: "Hazırlanacak", count: todo.length },
    { id: "sent" as const, label: "Gönderilenler", count: sent.length },
    { id: "template" as const, label: "Ortak metin", count: 0 },
  ];

  return (
    <div className="page">
      <header className="page-head rise" style={d(0)}>
        <div>
          <p className="eyebrow">Instagram ve TikTok</p>
          <h1 className="h1">DM Kontrol</h1>
        </div>
      </header>
      <p className="muted small rise" style={d(60)}>
        DM&apos;ler panelden gönderilmez. Taslağı onaylarsın, “Kopyala ve aç” metni kopyalar ve sohbeti açar, mesajı sen kendi hesabından yollayıp “Gönderdim” dersin.
      </p>

      {dmError && (
        <p className="issue" role="alert">
          <Icon name="warn" size={14} /> DM kayıtları sunucudan okunamadı, bu yüzden düzenleme kapalı (kayıtların üzerine yazılmasın diye). Sayfayı yenile.
        </p>
      )}
      {save === "error" && (
        <p className="issue" role="alert">
          <Icon name="warn" size={14} /> Son değişiklik kaydedilemedi.{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRetry((n) => n + 1)}>
            Tekrar dene
          </button>
        </p>
      )}

      <div className="tabs rise" style={d(90)} role="tablist" aria-label="DM bölümleri">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
            {t.count > 0 && <b className="tab-count">{t.count}</b>}
          </button>
        ))}
      </div>

      <div key={tab} className="tab-panel">
        <fieldset disabled={readOnly || dmError} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          {tab === "todo" && (
            <>
              <AddCard all={all} excluded={state.excluded} selected={state.selected} dm={dm.items} template={dm.template} mail={state.mail} dispatch={dispatch} />
              <List list={todo} byId={byId} dispatch={dispatch} empty="Taslak yok. Yukarıdan hesap ekle." />
            </>
          )}
          {tab === "sent" && <List list={sent} byId={byId} dispatch={dispatch} empty="Henüz “gönderdim” işaretlediğin DM yok." />}
          {tab === "template" && (
            <section className="card" aria-label="Ortak DM metni">
              <div className="card-head">
                <h2 className="h2">Ortak DM metni</h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "resetTemplate" })}>
                  <Icon name="undo" size={15} /> Varsayılana dön
                </button>
              </div>
              <textarea className="input textarea" rows={9} maxLength={DM_LIMIT * 2} value={dm.template} onChange={(e) => dispatch({ type: "template", text: e.target.value })} />
              <p className="muted small">
                Her hesap için dolar: {TEMPLATE_FIELDS.map((f) => (
                  <code key={f}>{f}</code>
                ))}. Marka, komisyon ve irtibat adresi Mail Kontrol &gt; Ortak metin sekmesinden gelir. Değişiklik yalnızca yeni eklenen taslakları etkiler.
              </p>
            </section>
          )}
        </fieldset>
      </div>
    </div>
  );
}

function AddCard({
  all,
  excluded,
  selected,
  dm,
  template,
  mail,
  dispatch,
}: {
  all: Influencer[];
  excluded: string[];
  selected: string[];
  dm: DmItem[];
  template: string;
  mail: Parameters<typeof dmDraft>[2];
  dispatch: (a: Parameters<typeof dmReduce>[1]) => void;
}) {
  const [channel, setChannel] = useState<DmChannel>("instagram");
  const [pick, setPick] = useState("");
  const out = new Set(excluded);
  const have = new Set(dm.map((x) => x.id));
  const options = all.filter((i) => !out.has(i.id) && dmHandle(i, channel) && !have.has(`${i.id}:${channel}`));
  const chosen = options.filter((i) => selected.includes(i.id));

  const add = (list: Influencer[]) =>
    dispatch({ type: "add", items: list.map((i) => ({ influencerId: i.id, channel, text: dmDraft(template, i, mail) })) });

  return (
    <section className="card" aria-label="DM taslağı ekle">
      <div className="card-head">
        <h2 className="h2">Taslak ekle</h2>
        <span className="muted small">{options.length} uygun hesap</span>
      </div>
      <div className="recontact-add">
        <label className="field">
          <span>Kanal</span>
          <select className="input" value={channel} onChange={(e) => { setChannel(e.target.value as DmChannel); setPick(""); }}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok (bio linkinden bulunanlar)</option>
          </select>
        </label>
        <label className="field">
          <span>Hesap</span>
          <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{options.length ? "Hesap seç…" : "Eklenecek hesap yok"}</option>
            {options.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} (@{dmHandle(i, channel)})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!pick}
          onClick={() => {
            const i = options.find((o) => o.id === pick);
            if (i) add([i]);
            setPick("");
          }}
        >
          <Icon name="plus" size={16} /> Ekle
        </button>
      </div>
      {chosen.length > 0 && (
        <div className="actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => add(chosen)}>
            <Icon name="plus" size={15} /> Listede seçtiklerimi ekle ({chosen.length})
          </button>
        </div>
      )}
    </section>
  );
}

function List({ list, byId, dispatch, empty }: { list: DmItem[]; byId: Map<string, Influencer>; dispatch: (a: Parameters<typeof dmReduce>[1]) => void; empty: string }) {
  if (list.length === 0)
    return (
      <div className="card empty-card">
        <p>{empty}</p>
        <TransitionLink href="/influencerlar" className="btn btn-ghost">
          Influencer listesi <Icon name="arrow" size={16} />
        </TransitionLink>
      </div>
    );
  return (
    <ul className="drafts">
      {[...list].reverse().map((x, idx) => {
        const inf = byId.get(x.influencerId);
        return inf ? <Item key={x.id} x={x} inf={inf} idx={idx} dispatch={dispatch} /> : null;
      })}
    </ul>
  );
}

function Item({ x, inf, idx, dispatch }: { x: DmItem; inf: Influencer; idx: number; dispatch: (a: Parameters<typeof dmReduce>[1]) => void }) {
  const [copied, setCopied] = useState(false);
  const st = dmStatus(x);
  const handle = dmHandle(inf, x.channel) ?? "";
  const locked = !!x.sentAt;

  const open = async () => {
    try {
      await navigator.clipboard.writeText(x.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    window.open(dmUrl(handle, x.channel), "_blank", "noopener,noreferrer");
  };

  return (
    <li className={`draft rise${x.approved ? " draft-ok" : ""}`} style={d(Math.min(idx, 8) * 60)}>
      <div className="draft-head">
        <span className="avatar" aria-hidden="true">{inf.name.slice(0, 1)}</span>
        <div className="who">
          <p className="who-name">{inf.name}</p>
          <p className="who-sub">
            <a href={dmUrl(handle, x.channel).replace("ig.me/m/", "www.instagram.com/")} target="_blank" rel="noopener noreferrer" className="handle">
              <Icon name={x.channel === "instagram" ? "ig" : "tt"} size={14} /> @{handle}
            </a>
            <span className="dotsep">·</span>
            <span>{fmtCount(inf.followers)} takipçi</span>
            {x.sentAt && (
              <>
                <span className="dotsep">·</span>
                <span>gönderildi {fmtDay(x.sentAt)}</span>
              </>
            )}
            {x.repliedAt && (
              <>
                <span className="dotsep">·</span>
                <span>yanıt {fmtDay(x.repliedAt)}</span>
              </>
            )}
          </p>
        </div>
        <span className={`status ${st === "taslak" ? "status-wait" : "status-ok"}`}>{STATUS_LABEL[st]}</span>
      </div>
      <textarea
        className="input textarea draft-text"
        rows={6}
        value={x.text}
        maxLength={DM_LIMIT}
        readOnly={locked}
        aria-label={`${inf.name} için DM metni`}
        onChange={(e) => dispatch({ type: "edit", id: x.id, text: e.target.value })}
      />
      <p className="muted small">{x.text.length} / {DM_LIMIT}</p>
      {needsContact(x.text) && (
        <p className="issue">
          <Icon name="warn" size={14} /> Metinde irtibat adresi henüz yazılmadı (Mail Kontrol &gt; Ortak metin).
        </p>
      )}
      <input
        className="input input-slim"
        value={x.note}
        maxLength={DM_NOTE_LIMIT}
        placeholder="Not ekle…"
        aria-label={`${inf.name} için not`}
        onChange={(e) => dispatch({ type: "note", id: x.id, note: e.target.value })}
      />
      <div className="draft-actions">
        {!locked && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "remove", id: x.id })}>
            <Icon name="trash" size={15} /> Sil
          </button>
        )}
        {!locked && (
          <button type="button" className={`btn btn-sm ${x.approved ? "btn-ghost" : "btn-primary"}`} disabled={!x.approved && !x.text.trim()} onClick={() => dispatch({ type: "toggleApprove", id: x.id })}>
            <Icon name="check" size={15} /> {x.approved ? "Onayı kaldır" : "Onayla"}
          </button>
        )}
        {x.approved && !locked && (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={open}>
              <Icon name="arrow" size={15} /> {copied ? "Kopyalandı, DM'i aç" : "Kopyala ve DM'i aç"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "markSent", id: x.id, at: new Date().toISOString() })}>
              <Icon name="mailcheck" size={15} /> Gönderdim
            </button>
          </>
        )}
        {locked && !x.repliedAt && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => dispatch({ type: "markReplied", id: x.id, at: new Date().toISOString() })}>
            <Icon name="check" size={15} /> Yanıt geldi
          </button>
        )}
        {locked && x.repliedAt && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "unmarkReplied", id: x.id })}>
            <Icon name="undo" size={15} /> Yanıtı geri al
          </button>
        )}
        {locked && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "unmarkSent", id: x.id })}>
            <Icon name="undo" size={15} /> Gönderildi işaretini kaldır
          </button>
        )}
      </div>
    </li>
  );
}
