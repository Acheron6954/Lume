"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { usePanel } from "@/components/panel-store";
import { MAX_PER_REQUEST } from "@/lib/gmail";
import { draftBody, draftSubject } from "@/lib/panel-state";

type Status = { configured: boolean; connected: boolean; email: string | null; sentToday: number; limit: number };
type Row = { key: string; kind: "inf" | "manual"; refId: string; name: string; to: string; subject: string; body: string; repeat: boolean };
type Result = { key: string; ok: boolean; error?: string };

export function SendBar() {
  const { all, state, dispatch, readOnly } = usePanel();
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: number; errors: { name: string; error: string }[] } | null>(null);

  const [tick, setTick] = useState(0); // arttıkça durum yeniden okunur
  useEffect(() => {
    if (readOnly) return;
    let live = true;
    fetch("/api/gmail/status", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : Promise.reject(new Error("status"))))
      .then((j) => {
        if (!live) return;
        setStatus(j);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [readOnly, tick]);

  const { rows, noMail } = useMemo(() => {
    const recontact = new Set(state.recontact.map((r) => r.id));
    const rows: Row[] = [];
    const noMail: string[] = [];
    for (const i of all) {
      if (!state.selected.includes(i.id) || !state.approved.includes(i.id)) continue;
      if (!i.email) {
        noMail.push(i.name);
        continue;
      }
      rows.push({ key: `inf:${i.id}`, kind: "inf", refId: i.id, name: i.name, to: i.email, subject: draftSubject(state, i), body: draftBody(state, i), repeat: recontact.has(i.id) });
    }
    for (const m of state.manual) {
      if (m.approved) rows.push({ key: `man:${m.id}`, kind: "manual", refId: m.id, name: m.name, to: m.email, subject: m.subject, body: m.body, repeat: false });
    }
    return { rows, noMail };
  }, [all, state]);

  const left = status ? Math.max(0, status.limit - status.sentToday) : 0;
  const sendable = rows.slice(0, left);

  const send = async () => {
    setBusy(true);
    const okKeys = new Set<string>();
    const errors: { name: string; error: string }[] = [];
    const byKey = new Map(sendable.map((r) => [r.key, r]));
    for (let n = 0; n < sendable.length; n += MAX_PER_REQUEST) {
      const chunk = sendable.slice(n, n + MAX_PER_REQUEST);
      try {
        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirm: true,
            items: chunk.map((r) => ({ key: r.key, influencerId: r.kind === "inf" ? r.refId : null, to: r.to, subject: r.subject, body: r.body, repeat: r.repeat })),
          }),
        });
        const j = (await res.json()) as { results?: Result[]; error?: string };
        if (!res.ok || !j.results) throw new Error(j.error ?? "Gönderilemedi");
        for (const r of j.results) {
          if (r.ok) okKeys.add(r.key);
          else errors.push({ name: byKey.get(r.key)?.name ?? r.key, error: r.error ?? "Gönderilemedi" });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gönderilemedi";
        for (const r of chunk) errors.push({ name: r.name, error: msg });
        break; // bağlantı ya da izin sorunu: kalanları denemeyi bırak
      }
    }
    // Gönderilenler taslaklardan düşer (seçim ve onay temizlenir), gönderilemeyenler olduğu gibi kalır.
    for (const r of sendable) {
      if (!okKeys.has(r.key)) continue;
      if (r.kind === "inf") dispatch({ type: "toggleSelect", id: r.refId });
      else dispatch({ type: "removeManual", id: r.refId });
    }
    setDone({ ok: okKeys.size, errors });
    setConfirming(false);
    setBusy(false);
    setTick((t) => t + 1);
  };

  let action: React.ReactNode;
  let note: React.ReactNode;
  if (readOnly) {
    note = <span className="muted">Bu hesap salt okunur, gönderim kapalı.</span>;
    action = <button type="button" className="btn btn-primary" disabled>Gönder</button>;
  } else if (failed || !status) {
    note = <span className="muted">{failed ? "Gmail durumu okunamadı." : "Gmail durumu kontrol ediliyor…"}</span>;
    action = <button type="button" className="btn btn-primary" disabled>Gönder</button>;
  } else if (!status.configured) {
    note = <span className="muted">Gmail kurulumu bekliyor: Vercel&apos;e GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET eklenmeli.</span>;
    action = <button type="button" className="btn btn-primary" disabled>Gönder</button>;
  } else if (!status.connected) {
    note = <span className="muted">Gmail bağlı değil. Bağlamak yalnızca mail gönderme izni verir.</span>;
    action = (
      <a className="btn btn-primary" href="/api/gmail/connect">
        Gmail&apos;i bağla
      </a>
    );
  } else {
    note = (
      <span className="muted">
        {status.email} bağlı · bugün {status.sentToday}/{status.limit}
        {rows.length > left && ` · sınır yüzünden ilk ${left} mail gider`}
      </span>
    );
    action = (
      <button type="button" className="btn btn-primary" disabled={sendable.length === 0 || busy} onClick={() => { setDone(null); setConfirming(true); }}>
        Gönder ({sendable.length})
      </button>
    );
  }

  return (
    <>
      {confirming && (
        <section className="card" role="alertdialog" aria-label="Gönderimi onayla">
          <div className="card-head">
            <h2 className="h2">{sendable.length} mail gönderilecek</h2>
            <span className="muted small">{status?.email}</span>
          </div>
          <ul className="small">
            {sendable.map((r) => (
              <li key={r.key}>
                {r.name} &lt;{r.to}&gt;{r.repeat && " (tekrar iletişim)"}
              </li>
            ))}
          </ul>
          <p className="muted small">Gönderilen mail geri alınamaz. Metinleri Taslaklar sekmesinde bir kez daha kontrol ettiğinden emin ol.</p>
          <div className="actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Vazgeç
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={send}>
              <Icon name="mailcheck" size={16} /> {busy ? "Gönderiliyor…" : `Evet, ${sendable.length} maili gönder`}
            </button>
          </div>
        </section>
      )}
      {done && (
        <section className="card" role="status">
          <p className="small">
            <b className="num">{done.ok}</b> mail gönderildi.
            {done.errors.length > 0 && ` ${done.errors.length} mail gitmedi:`}
          </p>
          {done.errors.map((e) => (
            <p key={e.name + e.error} className="issue">
              <Icon name="warn" size={14} /> {e.name}: {e.error}
            </p>
          ))}
        </section>
      )}
      <div className="send-bar rise">
        <p className="small">
          <b className="num">{rows.length}</b> mail gönderime hazır. {note}
          {noMail.length > 0 && <span className="muted"> · {noMail.length} hesabın maili yok, atlanır.</span>}
        </p>
        {action}
      </div>
    </>
  );
}
