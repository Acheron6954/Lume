"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { usePanel } from "@/components/panel-store";
import { TransitionLink } from "@/components/transition-link";
import {
  FOLLOWUP_TEMPLATE,
  TEMPLATE_FIELDS,
  fillTemplate,
  fmtCount,
  fmtDay,
  isEmail,
  needsContact,
  profileUrl,
  type Influencer,
} from "@/lib/influencer";
import { LIMITS, approvedCount, draftBody, draftSubject, manualReady, type ManualMail } from "@/lib/panel-state";
import { d } from "@/lib/ui";

type Tab = "drafts" | "manual" | "recontact" | "template";

const newId = () => `manuel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function Mails() {
  const { all, state, readOnly } = usePanel();
  const [tab, setTab] = useState<Tab>("drafts");

  const chosen = useMemo(() => all.filter((i) => state.selected.includes(i.id)), [all, state.selected]);
  const totalDrafts = chosen.length + state.manual.length;
  const ready = approvedCount(state);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "drafts", label: "Taslaklar", count: totalDrafts },
    { id: "manual", label: "Manuel mail" },
    { id: "recontact", label: "Tekrar iletişim", count: state.recontact.length },
    { id: "template", label: "Ortak metin" },
  ];

  return (
    <div className="page">
      <header className="page-head rise" style={d(0)}>
        <div>
          <p className="eyebrow">Gönderim öncesi kontrol</p>
          <h1 className="h1">Mail Kontrol</h1>
        </div>
      </header>

      <div className="tabs rise" style={d(90)} role="tablist" aria-label="Mail bölümleri">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <b className="tab-count">{t.count}</b>}
          </button>
        ))}
      </div>

      <div key={tab} id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel">
        {/* Salt okunur hesapta içerikteki tüm form alanları ve düğmeler tek hamlede kapanır; sekmeler dışarıda kaldığı için gezinti açık. */}
        <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          {tab === "drafts" && <Drafts chosen={chosen} onManual={() => setTab("manual")} />}
          {tab === "manual" && <ManualForm onAdded={() => setTab("drafts")} />}
          {tab === "recontact" && <RecontactTab onDrafts={() => setTab("drafts")} />}
          {tab === "template" && <TemplateCard />}
        </fieldset>
      </div>

      <div className="send-bar rise" style={d(300)}>
        <p className="small">
          <b className="num">{ready}</b> mail gönderime hazır. <span className="muted">Gmail bağlantısı kurulana kadar gönderim kapalı.</span>
        </p>
        <button type="button" className="btn btn-primary" disabled title="Gmail bağlantısı henüz kurulmadı">
          Gönder
        </button>
      </div>
    </div>
  );
}

/* ---------- Taslaklar ---------- */

function Drafts({ chosen, onManual }: { chosen: Influencer[]; onManual: () => void }) {
  const { state } = usePanel();
  const manual = [...state.manual].reverse(); // en yeni üstte
  const total = chosen.length + manual.length;
  const ready = approvedCount(state);
  const pct = total ? (ready / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="card empty-card">
        <p>Henüz taslak yok. Listeden hesap seçebilir ya da elle bir mail yazabilirsin.</p>
        <div className="actions">
          <TransitionLink href="/influencerlar" className="btn btn-primary">
            Influencer listesine git <Icon name="arrow" size={16} />
          </TransitionLink>
          <button type="button" className="btn btn-ghost" onClick={onManual}>
            <Icon name="plus" size={16} /> Manuel mail ekle
          </button>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Taslaklar">
      <div className="card-head head-plain">
        <h2 className="h2">Taslaklar ({total})</h2>
        <div className="progress" aria-label={`${ready} / ${total} onaylandı`}>
          <span className="progress-bar">
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="num small">
            {ready} / {total} onaylı
          </span>
        </div>
      </div>
      <ul className="drafts">
        {manual.map((m, idx) => (
          <ManualCard key={m.id} mail={m} idx={idx} />
        ))}
        {chosen.map((i, idx) => (
          <DraftCard key={i.id} inf={i} idx={idx + manual.length} />
        ))}
      </ul>
    </section>
  );
}

function DraftCard({ inf, idx }: { inf: Influencer; idx: number }) {
  const { state, dispatch } = usePanel();
  const body = draftBody(state, inf);
  const edited = state.edits[inf.id] !== undefined;
  const ok = state.approved.includes(inf.id);
  const issues: string[] = [];
  if (!inf.email) issues.push("Bu hesabın mail adresi bulunamadı, DM ile ulaşman gerekir.");
  if (needsContact(body)) issues.push("İrtibat adresi henüz yazılmadı.");
  return (
    <li className={`draft rise${ok ? " draft-ok" : ""}`} style={d(Math.min(idx, 8) * 60)}>
      <div className="draft-head">
        <span className="avatar" aria-hidden="true">{inf.name.slice(0, 1)}</span>
        <div className="who">
          <p className="who-name">{inf.name}</p>
          <p className="who-sub">
            <span>{inf.email ?? "mail yok"}</span>
            <span className="dotsep">·</span>
            <span>{fmtCount(inf.followers)} takipçi</span>
          </p>
        </div>
        <span className={`status ${ok ? "status-ok" : "status-wait"}`}>{ok ? "Onaylandı" : "Onay bekliyor"}</span>
      </div>
      <p className="draft-subject">
        <span className="muted">Konu:</span> {draftSubject(state, inf)}
      </p>
      <textarea
        className="input textarea draft-text"
        rows={15}
        value={body}
        maxLength={LIMITS.body}
        aria-label={`${inf.name} için mail metni`}
        onChange={(e) => dispatch({ type: "edit", id: inf.id, text: e.target.value })}
      />
      {issues.map((t) => (
        <p key={t} className="issue">
          <Icon name="warn" size={14} /> {t}
        </p>
      ))}
      <div className="draft-actions">
        {edited && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "edit", id: inf.id, text: null })}>
            <Icon name="undo" size={15} /> Ortak metne dön
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "toggleSelect", id: inf.id })}>
          Listeden çıkar
        </button>
        <button type="button" className={`btn btn-sm ${ok ? "btn-ghost" : "btn-primary"}`} onClick={() => dispatch({ type: "toggleApprove", id: inf.id })}>
          <Icon name="check" size={15} /> {ok ? "Onayı kaldır" : "Onayla"}
        </button>
      </div>
    </li>
  );
}

function ManualCard({ mail, idx }: { mail: ManualMail; idx: number }) {
  const { dispatch } = usePanel();
  const issues: string[] = [];
  if (!mail.name.trim()) issues.push("Alıcı adı boş.");
  if (!isEmail(mail.email)) issues.push("E-posta adresi geçerli değil.");
  if (!mail.subject.trim()) issues.push("Konu boş.");
  if (!mail.body.trim()) issues.push("Mail metni boş.");
  if (needsContact(mail.body)) issues.push("Metinde irtibat adresi henüz yazılmadı.");
  const ready = manualReady(mail);
  const patch = (p: Partial<Pick<ManualMail, "name" | "email" | "subject" | "body">>) => dispatch({ type: "editManual", id: mail.id, patch: p });
  return (
    <li className={`draft rise${mail.approved ? " draft-ok" : ""}`} style={d(Math.min(idx, 8) * 60)}>
      <div className="draft-head">
        <span className="avatar avatar-manual" aria-hidden="true">
          <Icon name="pen" size={18} />
        </span>
        <div className="who">
          <p className="who-name">
            {mail.name || "İsimsiz"} <span className="tag-manual">manuel</span>
          </p>
          <p className="who-sub">
            <span>{mail.email || "adres yok"}</span>
          </p>
        </div>
        <span className={`status ${mail.approved ? "status-ok" : "status-wait"}`}>{mail.approved ? "Onaylandı" : "Onay bekliyor"}</span>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Alıcı adı</span>
          <input className="input" value={mail.name} maxLength={LIMITS.name} onChange={(e) => patch({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>E-posta</span>
          <input className={`input${mail.email && !isEmail(mail.email) ? " input-warn" : ""}`} type="email" inputMode="email" value={mail.email} maxLength={LIMITS.email} onChange={(e) => patch({ email: e.target.value })} />
        </label>
        <label className="field field-wide">
          <span>Konu</span>
          <input className="input" value={mail.subject} maxLength={LIMITS.subject} onChange={(e) => patch({ subject: e.target.value })} />
        </label>
      </div>
      <textarea
        className="input textarea draft-text"
        rows={12}
        value={mail.body}
        maxLength={LIMITS.body}
        aria-label={`${mail.name || "Manuel mail"} için mail metni`}
        onChange={(e) => patch({ body: e.target.value })}
      />
      {issues.map((t) => (
        <p key={t} className="issue">
          <Icon name="warn" size={14} /> {t}
        </p>
      ))}
      <div className="draft-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "removeManual", id: mail.id })}>
          <Icon name="trash" size={15} /> Sil
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mail.approved ? "btn-ghost" : "btn-primary"}`}
          disabled={!mail.approved && !ready}
          onClick={() => dispatch({ type: "toggleApproveManual", id: mail.id })}
        >
          <Icon name="check" size={15} /> {mail.approved ? "Onayı kaldır" : "Onayla"}
        </button>
      </div>
    </li>
  );
}

/* ---------- Manuel mail ---------- */

function ManualForm({ onAdded }: { onAdded: () => void }) {
  const { state, dispatch } = usePanel();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [niche, setNiche] = useState("");
  // null: ortak şablondan otomatik dolsun; kullanıcı yazarsa kendi metni kalır
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const who = { name: name.trim() || "[isim]", niche, handle: "" };
  const subjectValue = subject ?? fillTemplate(state.mail.subject, who, state.mail);
  const bodyValue = body ?? fillTemplate(state.mail.template, who, state.mail);

  const errors = {
    name: name.trim() ? "" : "Alıcı adını yaz.",
    email: isEmail(email) ? "" : "Geçerli bir e-posta adresi yaz.",
    subject: subjectValue.trim() ? "" : "Konu boş olamaz.",
    body: bodyValue.trim() ? "" : "Mail metni boş olamaz.",
  };
  const valid = !errors.name && !errors.email && !errors.subject && !errors.body;
  const dup = state.manual.some((m) => m.email.trim().toLowerCase() === email.trim().toLowerCase());

  const submit = () => {
    setTried(true);
    if (!valid) return;
    dispatch({ type: "addManual", id: newId(), fields: { name, email, subject: subjectValue, body: bodyValue } });
    setName("");
    setEmail("");
    setNiche("");
    setSubject(null);
    setBody(null);
    setTried(false);
    onAdded();
  };

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="card-head">
        <h2 className="h2">Manuel mail</h2>
        <span className="muted small">Listede olmayan biri için elle taslak yaz</span>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Alıcı adı</span>
          <input className={`input${tried && errors.name ? " input-warn" : ""}`} value={name} maxLength={LIMITS.name} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          {tried && errors.name && <small className="hint-warn">{errors.name}</small>}
        </label>
        <label className="field">
          <span>E-posta</span>
          <input
            className={`input${tried && errors.email ? " input-warn" : ""}`}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="ornek@mail.com"
            value={email}
            maxLength={LIMITS.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {tried && errors.email && <small className="hint-warn">{errors.email}</small>}
          {!errors.email && dup && <small className="hint-warn">Bu adrese zaten bir manuel taslak var.</small>}
        </label>
        <label className="field field-wide">
          <span>Alan (isteğe bağlı)</span>
          <input className="input" value={niche} placeholder="ör. cilt bakımı" maxLength={60} onChange={(e) => setNiche(e.target.value)} />
          <small className="hint">Metindeki {"{alan}"} yerine yazılır. Boşsa “kozmetik” kullanılır.</small>
        </label>
        <label className="field field-wide">
          <span>Konu</span>
          <input className={`input${tried && errors.subject ? " input-warn" : ""}`} value={subjectValue} maxLength={LIMITS.subject} onChange={(e) => setSubject(e.target.value)} />
          {tried && errors.subject && <small className="hint-warn">{errors.subject}</small>}
        </label>
        <label className="field field-wide">
          <span>Metin</span>
          <textarea className={`input textarea${tried && errors.body ? " input-warn" : ""}`} rows={14} value={bodyValue} maxLength={LIMITS.body} onChange={(e) => setBody(e.target.value)} />
          {tried && errors.body && <small className="hint-warn">{errors.body}</small>}
          <small className="hint">
            Başlangıç metni ortak şablondan gelir; sen yazmaya başlayınca kendi metnin kalır.
            {needsContact(bodyValue) && " İrtibat adresi henüz yazılmadı (Ortak metin sekmesinden ekleyebilirsin)."}
          </small>
        </label>
      </div>
      <div className="actions">
        {(subject !== null || body !== null) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSubject(null);
              setBody(null);
            }}
          >
            <Icon name="undo" size={16} /> Şablondan yeniden doldur
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          <Icon name="plus" size={16} /> Taslaklara ekle
        </button>
      </div>
    </form>
  );
}

/* ---------- Tekrar iletişim ---------- */

function RecontactTab({ onDrafts }: { onDrafts: () => void }) {
  const { all, state, dispatch } = usePanel();
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");

  const listed = new Set(state.recontact.map((r) => r.id));
  const excluded = new Set(state.excluded);
  const options = all.filter((i) => !excluded.has(i.id) && !listed.has(i.id));
  const byId = new Map(all.map((i) => [i.id, i]));

  const add = () => {
    if (!pick) return;
    dispatch({ type: "addRecontact", id: pick, note, at: new Date().toISOString() });
    setPick("");
    setNote("");
  };

  const toDraft = (inf: Influencer) => {
    dispatch({ type: "select", ids: [inf.id] });
    if (state.edits[inf.id] === undefined) dispatch({ type: "edit", id: inf.id, text: fillTemplate(FOLLOWUP_TEMPLATE, inf, state.mail) });
    onDrafts();
  };

  return (
    <section aria-label="Tekrar iletişim">
      <div className="card">
        <div className="card-head">
          <h2 className="h2">Tekrar iletişime geçilecekler</h2>
          <span className="muted small">{state.recontact.length} hesap</span>
        </div>
        <form
          className="recontact-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="field">
            <span>Hesap</span>
            <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{options.length ? "Hesap seç…" : "Eklenecek hesap kalmadı"}</option>
              {options.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (@{i.handle})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Not (isteğe bağlı)</span>
            <input className="input" value={note} maxLength={LIMITS.note} placeholder="ör. ilk maile yanıt vermedi" onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={!pick}>
            <Icon name="plus" size={16} /> Listeye ekle
          </button>
        </form>
      </div>

      {state.recontact.length === 0 ? (
        <div className="card empty-card recontact-empty">
          <p>Liste boş. Yanıt vermeyen ya da yeniden yazmak istediğin hesapları yukarıdan ekle.</p>
          <p className="muted small">Gönderim ve yanıt takibi bağlanınca, yanıt vermeyenler buraya kendiliğinden düşecek.</p>
        </div>
      ) : (
        <ul className="recontact-list">
          {state.recontact.map((r, idx) => {
            const inf = byId.get(r.id);
            if (!inf) return null;
            const inDraft = state.selected.includes(inf.id);
            return (
              <li key={r.id} className="row recontact-row rise" style={d(Math.min(idx, 8) * 50)}>
                <span className="avatar" aria-hidden="true">{inf.name.slice(0, 1)}</span>
                <div className="who">
                  <p className="who-name">{inf.name}</p>
                  <p className="who-sub">
                    <a href={profileUrl(inf)} target="_blank" rel="noopener noreferrer" className="handle">
                      <Icon name={inf.platform === "instagram" ? "ig" : "tt"} size={14} /> @{inf.handle}
                    </a>
                    <span className="dotsep">·</span>
                    <span>{fmtCount(inf.followers)} takipçi</span>
                    <span className="dotsep">·</span>
                    <span>{inf.email ?? "mail yok"}</span>
                    <span className="dotsep">·</span>
                    <span>eklendi {fmtDay(r.at)}</span>
                  </p>
                  <input
                    className="input input-slim"
                    value={r.note}
                    maxLength={LIMITS.note}
                    placeholder="Not ekle…"
                    aria-label={`${inf.name} için not`}
                    onChange={(e) => dispatch({ type: "noteRecontact", id: r.id, note: e.target.value })}
                  />
                </div>
                <div className="recontact-actions">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={inDraft} onClick={() => toDraft(inf)}>
                    <Icon name="repeat" size={15} /> {inDraft ? "Taslakta" : "Hatırlatma taslağı"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "removeRecontact", id: r.id })} aria-label={`${inf.name} hesabını listeden kaldır`}>
                    <Icon name="close" size={15} /> Kaldır
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- Ortak metin ---------- */

function TemplateCard() {
  const { state, dispatch } = usePanel();
  const m = state.mail;
  const noContact = !m.contact.trim();
  return (
    <section className="card" aria-label="Ortak metin">
      <div className="card-head">
        <h2 className="h2">Ortak metin</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "resetTemplate" })}>
          <Icon name="undo" size={15} /> Varsayılana dön
        </button>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Marka adı</span>
          <input className="input" value={m.brand} maxLength={60} onChange={(e) => dispatch({ type: "mail", value: { brand: e.target.value } })} />
        </label>
        <label className="field">
          <span>Komisyon (%)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={m.commission}
            onChange={(e) => dispatch({ type: "mail", value: { commission: Number(e.target.value) } })}
          />
        </label>
        <label className="field field-wide">
          <span>İrtibat adresi (detay için)</span>
          <input
            className={`input${noContact ? " input-warn" : ""}`}
            type="text"
            placeholder="ör. isbirligi@sirketiniz.com"
            value={m.contact}
            maxLength={120}
            onChange={(e) => dispatch({ type: "mail", value: { contact: e.target.value } })}
          />
          {noContact && <small className="hint-warn">Boş bırakılırsa maillerde “[iletişim adresi]” yazar. Göndermeden önce doldur.</small>}
        </label>
        <label className="field field-wide">
          <span>Konu</span>
          <input className="input" value={m.subject} maxLength={LIMITS.subject} onChange={(e) => dispatch({ type: "mail", value: { subject: e.target.value } })} />
        </label>
        <label className="field field-wide">
          <span>Metin</span>
          <textarea className="input textarea" rows={13} value={m.template} maxLength={LIMITS.body} onChange={(e) => dispatch({ type: "mail", value: { template: e.target.value } })} />
          <small className="hint">
            Her hesap için otomatik dolar: {TEMPLATE_FIELDS.map((f) => (
              <code key={f}>{f}</code>
            ))}
          </small>
        </label>
      </div>
      <p className="muted small">Ortak metin değişince şablondan gelen onaylar sıfırlanır, çünkü her taslak yeniden kontrol edilmeli. Elle yazdığın maillere dokunulmaz.</p>
    </section>
  );
}
