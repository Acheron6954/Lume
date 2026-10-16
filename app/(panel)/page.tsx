"use client";
import { CountUp } from "@/components/charts";
import { Icon, type IconName } from "@/components/icons";
import { usePanel } from "@/components/panel-store";
import { TransitionLink } from "@/components/transition-link";
import { fmtDay } from "@/lib/influencer";
import { approvedCount } from "@/lib/panel-state";
import { d } from "@/lib/ui";

export default function Overview() {
  const { all, state, warningsFor } = usePanel();
  const excluded = new Set(state.excluded);
  const active = all.filter((i) => !excluded.has(i.id));
  const flagged = active.filter((i) => warningsFor(i).length > 0).length;

  const ready = approvedCount(state);
  const stats: { label: string; value: number; hint: string; tone: string; icon: IconName }[] = [
    { label: "Keşfedilen", value: all.length, hint: "ajanın bulduğu hesap", tone: "plum", icon: "radar" },
    { label: "Uyarılı", value: flagged, hint: "eşiğin altında kalan", tone: "amber", icon: "warn" },
    { label: "Çıkarılan", value: state.excluded.length, hint: "etkileşimden çıkarıldı", tone: "blue", icon: "userx" },
    { label: "Onaylı mail", value: ready, hint: `${state.selected.length} seçili hesap, ${state.manual.length} manuel mail`, tone: "plum", icon: "mailcheck" },
  ];
  const funnel = [
    { label: "Bulundu", n: active.length },
    { label: "Mail onaylı", n: ready },
    { label: "Gönderildi", n: 0 },
    { label: "Yanıt verdi", n: 0 },
    { label: "Kabul etti", n: 0 },
  ];
  const top = Math.max(1, ...funnel.map((f) => f.n));

  const scanned = all.map((i) => i.scannedAt).filter((x): x is string => !!x).sort();
  const lastScan = scanned[scanned.length - 1];
  const time = lastScan ? new Date(lastScan).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }) : "—";
  const verified = all.filter((i) => i.verified).length;
  const withMail = all.filter((i) => i.email).length;
  const failed = all.length - verified;
  const feed: { time: string; text: string }[] = lastScan
    ? [
        { time, text: `Son Instagram taraması: ${fmtDay(lastScan)}` },
        { time, text: `${verified} hesap Instagram'dan doğrulandı (takipçi, beğeni, yorum)` },
        { time, text: `${withMail} hesapta iletişim maili bulundu` },
        ...(failed > 0 ? [{ time, text: `${failed} hesap doğrulanamadı (kişisel hesap olabilir)` }] : []),
      ]
    : [{ time, text: "Henüz tarama yapılmadı" }];

  return (
    <div className="page">
      <header className="page-head rise" style={d(0)}>
        <div>
          <p className="eyebrow">Kreatör Paneli</p>
          <h1 className="h1">Genel Bakış</h1>
        </div>
      </header>

      <section className="stats" aria-label="Özet">
        {stats.map((s, idx) => (
          <article key={s.label} className={`card stat tone-${s.tone} rise`} style={d(120 + idx * 90)}>
            <span className="stat-icon" aria-hidden="true">
              <Icon name={s.icon} size={22} />
            </span>
            <p className="stat-label">{s.label}</p>
            <p className="stat-value">
              <CountUp value={s.value} />
            </p>
            <p className="stat-hint">{s.hint}</p>
          </article>
        ))}
      </section>

      <div className="split">
        <section className="card rise" style={d(480)}>
          <div className="card-head">
            <h2 className="h2">İş birliği hattı</h2>
            <span className="muted small">Gönderim Gmail bağlanınca başlar</span>
          </div>
          <ol className="funnel">
            {funnel.map((f, idx) => (
              <li key={f.label} className="funnel-row">
                <span className="funnel-label">{f.label}</span>
                <span className="funnel-track">
                  <span className="funnel-fill" style={{ width: `${(f.n / top) * 100}%`, animationDelay: `${700 + idx * 120}ms` }} />
                </span>
                <span className="num funnel-n">{f.n}</span>
              </li>
            ))}
          </ol>
          <div className="actions">
            <TransitionLink href="/influencerlar" className="btn btn-primary">
              Influencer listesine git <Icon name="arrow" size={16} />
            </TransitionLink>
            <TransitionLink href="/mailler" className="btn btn-ghost">
              Mail taslaklarını kontrol et
            </TransitionLink>
          </div>
        </section>

        <section className="card agent rise" style={d(580)}>
          <div className="card-head">
            <div className="agent-title">
              <span className="orb" aria-hidden="true" />
              <h2 className="h2">Ajan</h2>
            </div>
          </div>
          <ul className="feed">
            {feed.map((f) => (
              <li key={f.text}>
                <time className="num">{f.time}</time>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
