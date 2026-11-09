"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NICHES, STEP_FIELDS, parseApplication, type Application, type FieldErrors } from "@/lib/application";

const FAQS: [string, string][] = [
  ["Başvurmak ücretli mi?", "Hayır, başvuru ücretsiz. Programa katılmak için herhangi bir ödeme yapmazsın."],
  ["Hangi platformlarda içerik üretmeliyim?", "Instagram ya da TikTok. İkisinde birden üretiyorsan ikisini de formda belirt."],
  ["Kazancımı nasıl öğreneceğim?", "Çalışma koşulları ve kazanç detayları başvurun onaylandığında seninle birebir paylaşılır."],
  ["Ürünleri nasıl alacağım?", "Başvurun onaylandığında ürünlerin sana nasıl ulaşacağını birlikte planlarız."],
  ["Kişisel verilerim ne olacak?", "Verilerini yalnızca başvurunu değerlendirmek için kullanırız. Ayrıntılar KVKK Aydınlatma Metni’nde."],
];

const STEP_LABEL = { 1: "Hesapların", 2: "İletişim", 3: "Onay" } as const;
type Step = 1 | 2 | 3;
type Form = { instagram: string; tiktok: string; niche: string; name: string; email: string; whatsapp: string; city: string; kvkk: boolean; disclosure: boolean; website: string };
const EMPTY: Form = { instagram: "", tiktok: "", niche: NICHES[0], name: "", email: "", whatsapp: "", city: "", kvkk: false, disclosure: false, website: "" };

/** Kaydırdıkça dönen, alttaki koyu bölüme yaklaştıkça belirginleşen kara delik. */
function useBlackHole() {
  const wrap = useRef<HTMLDivElement>(null);
  const disk = useRef<HTMLSpanElement>(null);
  const disk2 = useRef<HTMLSpanElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight || 900;
      const deg = reduce ? 0 : y * 0.12;
      const top = dark.current?.getBoundingClientRect().top ?? Infinity;
      // 0: aydınlık üst bölümler, 1: alttaki mor-lacivert bölüm
      const p = Math.max(0, Math.min(1, (vh * 0.95 - top) / (vh * 0.7)));
      if (disk.current) disk.current.style.transform = `rotate(${deg}deg)`;
      if (disk2.current) disk2.current.style.transform = `rotate(${-deg * 0.6}deg)`;
      if (wrap.current) {
        wrap.current.style.transform = `translateX(${(1 - p) * 150}px)`;
        wrap.current.style.opacity = String(0.5 + p * 0.5);
        wrap.current.style.filter = `hue-rotate(${150 * (1 - p)}deg) saturate(${0.55 + p * 0.45})`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return { wrap, disk, disk2, dark };
}

function ApplyForm() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const stepErrors = (s: Step): FieldErrors => {
    const res = parseApplication(form);
    if (res.ok) return {};
    const out: FieldErrors = {};
    for (const k of STEP_FIELDS[s]) if (res.errors[k]) out[k] = res.errors[k];
    return out;
  };

  const next = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errs = stepErrors(step);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (step < 3) {
      setStep((step + 1) as Step);
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/basvuru", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = (await res.json().catch(() => ({}))) as { error?: string; fields?: FieldErrors };
      if (!res.ok) {
        if (j.fields) {
          setErrors(j.fields);
          const first = ([1, 2, 3] as Step[]).find((s) => STEP_FIELDS[s].some((k) => j.fields?.[k]));
          if (first) setStep(first);
        }
        throw new Error(j.error ?? "Başvuru gönderilemedi.");
      }
      setStatus("done");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Başvuru gönderilemedi.");
      setStatus("idle");
    }
  };

  const field = (k: keyof Application, label: string, opts: { type?: string; optional?: string; placeholder?: string; auto?: string } = {}) => (
    <label className="s-field">
      <span>
        {label} {opts.optional && <small>({opts.optional})</small>}
      </span>
      <input
        className="s-input"
        type={opts.type ?? "text"}
        value={form[k as keyof Form] as string}
        placeholder={opts.placeholder}
        autoComplete={opts.auto}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `err-${k}` : undefined}
        onChange={(e) => set(k as keyof Form, e.target.value as never)}
      />
      {errors[k] && <span id={`err-${k}`} className="s-err">{errors[k]}</span>}
    </label>
  );

  if (status === "done") {
    return (
      <div className="s-form">
        <div className="s-done" role="status">
          <span className="s-done-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#de76d0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h3 className="s-display">Başvurun bize ulaştı.</h3>
          <p className="s-lead">Hesabını inceleyip e-posta ile sana döneceğiz.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="s-form" onSubmit={next} noValidate>
      <div>
        <div className="s-progress-row">
          <span>{STEP_LABEL[step]}</span>
          <span>Adım {step} / 3</span>
        </div>
        <div className="s-bar" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label="Başvuru adımı">
          <span style={{ width: `${Math.round((step / 3) * 100)}%` }} />
        </div>
      </div>

      {step === 1 && (
        <div className="s-fields">
          {field("instagram", "Instagram kullanıcı adı", { placeholder: "@kullaniciadi" })}
          {field("tiktok", "TikTok kullanıcı adı", { placeholder: "@kullaniciadi", optional: "varsa" })}
          <label className="s-field">
            <span>İçerik alanın</span>
            <select className="s-input" value={form.niche} onChange={(e) => set("niche", e.target.value)}>
              {NICHES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {step === 2 && (
        <div className="s-fields">
          {field("name", "Ad soyad", { auto: "name" })}
          {field("email", "E-posta", { type: "email", auto: "email" })}
          {field("whatsapp", "WhatsApp", { type: "tel", auto: "tel", optional: "isteğe bağlı" })}
          {field("city", "Şehir", { auto: "address-level2" })}
        </div>
      )}
      {step === 3 && (
        <div className="s-fields">
          <p className="s-lead">Başvurunu göndermeden önce kişisel verilerinin nasıl işlendiğini oku.</p>
          <label className="s-check">
            <input type="checkbox" checked={form.kvkk} onChange={(e) => set("kvkk", e.target.checked)} aria-invalid={errors.kvkk ? true : undefined} />
            <span>
              <a href="#kvkk">KVKK Aydınlatma Metni</a>&apos;ni okudum; başvurumun değerlendirilmesi için verilerimin işlenmesine onay veriyorum.
            </span>
          </label>
          {errors.kvkk && <span className="s-err">{errors.kvkk}</span>}
          <label className="s-check">
            <input type="checkbox" checked={form.disclosure} onChange={(e) => set("disclosure", e.target.checked)} aria-invalid={errors.disclosure ? true : undefined} />
            <span>Paylaşımlarımda reklam / iş birliği etiketini kullanacağımı kabul ediyorum.</span>
          </label>
          {errors.disclosure && <span className="s-err">{errors.disclosure}</span>}
        </div>
      )}

      <label className="s-hp" aria-hidden="true">
        Web sitesi
        <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
      </label>

      {serverError && (
        <p className="s-err" role="alert">
          {serverError}
        </p>
      )}

      <div className="s-actions">
        {step > 1 && (
          <button type="button" className="s-btn-back" onClick={() => { setErrors({}); setStep((step - 1) as Step); }}>
            Geri
          </button>
        )}
        <button type="submit" className="s-btn-next" disabled={status === "sending"}>
          {step === 3 ? (status === "sending" ? "Gönderiliyor…" : "Başvuruyu gönder") : "Devam"}
        </button>
      </div>
    </form>
  );
}

export function Landing() {
  const { wrap, disk, disk2, dark } = useBlackHole();
  const [open, setOpen] = useState(0);

  return (
    <div className="site">
      <div className="s-hole" ref={wrap} aria-hidden="true">
        <span className="h-glow" />
        <span className="h-disk" ref={disk} />
        <span className="h-disk2" ref={disk2} />
        <span className="h-ring" />
        <span className="h-core" />
      </div>

      <header className="s-header">
        <nav className="s-wrap s-nav" aria-label="Ana menü">
          <a href="#top" className="s-brand">
            <span className="s-brand-dot" aria-hidden="true" />
            <span className="s-word">L&apos;UME</span>
          </a>
          <div className="s-links">
            <a href="#nasil">Nasıl çalışır</a>
            <a href="#kimler">Kimleri arıyoruz</a>
            <a href="#sss">SSS</a>
          </div>
          <div className="s-account">
            <Link href="/giris" className="s-btn s-btn-line">Giriş yap</Link>
            <Link href="/kayit" className="s-btn s-btn-dark s-hide-sm">Üye ol</Link>
          </div>
        </nav>

        <section id="top" className="s-wrap s-hero">
          <p className="s-eyebrow">KREATÖR PROGRAMI</p>
          <h1 className="s-display">İçeriğin ışığa dönüşsün.</h1>
          <p className="s-lead">
            L&apos;UME, güzellik ve bakım içerikleri üreten kreatörlerle çalışan bir iş birliği programı. Ürünlerimizi kendi tarzınla anlatırsın, senin aracılığınla gelen her satıştan kazanırsın.
          </p>
          <div className="s-cta">
            <a href="#basvur" className="s-btn s-btn-lg s-btn-green">Başvurunu yap</a>
            <a href="#nasil" className="s-btn s-btn-lg s-btn-line">Nasıl çalışır?</a>
          </div>
        </section>
      </header>

      <main className="s-main">
        <section id="nasil" className="s-wrap s-section" style={{ paddingTop: 40 }}>
          <div className="s-head">
            <p className="s-eyebrow">NASIL ÇALIŞIR</p>
            <h2 className="s-display s-h2">Üç adımda içerikten kazanca.</h2>
          </div>
          <div className="s-grid3">
            <div className="s-card"><span className="s-num">01</span><h3>Başvur</h3><p>Kısa formu doldur. Ekibimiz Instagram ya da TikTok hesabını inceler ve sana döner.</p></div>
            <div className="s-card"><span className="s-num">02</span><h3>Ürünü tanı, içerik üret</h3><p>Ürünleri dene, kendi sesinle anlat. Takipçilerin seni tanıdığı gibi kalsın.</p></div>
            <div className="s-card"><span className="s-num">03</span><h3>Sattıkça kazan</h3><p>Senin aracılığınla gelen satışlardan pay alırsın. Reklam bütçesi gerekmez.</p></div>
          </div>
        </section>

        <section id="kimler" className="s-band">
          <div className="s-wrap s-section">
            <div className="s-head">
              <p className="s-eyebrow">KİMLERİ ARIYORUZ</p>
              <h2 className="s-display s-h2">Kendi sesi olan kreatörler.</h2>
            </div>
            <div className="s-grid3">
              <div className="s-card"><h3>Güzellik ve bakım</h3><p>Cilt bakımı, makyaj ya da yaşam tarzı içerikleri üretenler</p></div>
              <div className="s-card"><h3>Video seven</h3><p>Instagram ya da TikTok&apos;ta Reels, video veya hikâye formatında düzenli üretim</p></div>
              <div className="s-card"><h3>Samimi anlatım</h3><p>Takipçileriyle gerçek bir bağ kurmuş, kendi tarzı olan</p></div>
            </div>
          </div>
        </section>

        <section className="s-wrap s-section" style={{ gap: 80 }}>
          <div className="s-grid2">
            <div className="s-head" style={{ gap: 18 }}>
              <p className="s-eyebrow">KAZANÇ</p>
              <h2 className="s-display s-h2">Reklam bütçesi yok. Satış kadar kazanç.</h2>
              <p className="s-lead">Sabit bir ücret yerine, içeriğinle gelen satışlardan pay alırsın. Çalışma koşulları başvurun onaylandığında seninle birebir paylaşılır.</p>
            </div>
            <div className="s-terms">
              <div><span>Kazanç modeli</span><strong>Satış başına pay</strong></div>
              <div><span>Reklam bütçesi</span><strong>Gerekmez</strong></div>
              <div><span>Başvuru ücreti</span><strong>Yok</strong></div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div className="s-products-head">
              <div className="s-head" style={{ gap: 12 }}>
                <p className="s-eyebrow">ÜRÜNLER</p>
                <h2 className="s-display s-h2" style={{ fontSize: 48 }}>Koleksiyon çok yakında.</h2>
              </div>
              <span className="s-chip">Görseller hazırlanıyor</span>
            </div>
            <div className="s-grid3" aria-hidden="true">
              <div className="s-slot" />
              <div className="s-slot" />
              <div className="s-slot" />
            </div>
          </div>
        </section>

        <div className="s-fade" aria-hidden="true" />

        <div className="s-dark" ref={dark}>
          <section id="sss" className="s-wrap s-faq-wrap">
            <div className="s-head" style={{ gap: 14 }}>
              <p className="s-eyebrow">SIKÇA SORULANLAR</p>
              <h2 className="s-display s-h2" style={{ fontSize: 56 }}>Aklındaki sorular.</h2>
            </div>
            <div className="s-faq">
              {FAQS.map(([q, a], i) => (
                <div key={q} className="s-faq-item">
                  <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                    <span>{q}</span>
                    <span aria-hidden="true">{open === i ? "−" : "+"}</span>
                  </button>
                  {open === i && <p id={`faq-${i}`}>{a}</p>}
                </div>
              ))}
            </div>
          </section>

          <section id="basvur" className="s-wrap s-apply">
            <div className="s-head" style={{ gap: 20 }}>
              <p className="s-eyebrow">BAŞVURU</p>
              <h2 className="s-display s-h2" style={{ fontSize: 64, lineHeight: 1 }}>Hazırsan, başlayalım.</h2>
              <p className="s-lead">Form iki dakika sürer. Hesabını inceledikten sonra e-posta ile sana döneriz.</p>
            </div>
            <ApplyForm />
          </section>

          <footer className="s-wrap s-footer">
            <span className="s-word">L&apos;UME</span>
            <nav aria-label="Alt menü">
              <a id="kvkk" href="#kvkk">KVKK Aydınlatma Metni</a>
              <a href="#gizlilik">Gizlilik</a>
              <a href="#sartlar">Şartlar</a>
              <Link href="/giris">Giriş yap</Link>
              <Link href="/kayit">Üye ol</Link>
            </nav>
            <span>© 2026 L&apos;UME</span>
          </footer>
        </div>
      </main>

      <div className="s-sticky">
        <a href="#basvur" className="s-btn s-btn-green">Başvur</a>
      </div>
    </div>
  );
}
