import type { Metadata } from "next";
import { adminClient } from "@/lib/supabase-admin";
import { d } from "@/lib/ui";

export const metadata: Metadata = { title: "Başvurular" };
export const dynamic = "force-dynamic";

type App = { id: string; name: string; email: string; instagram: string | null; tiktok: string | null; niche: string; city: string; whatsapp: string | null; created_at: string };

const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export default async function ApplicationsPage() {
  const db = adminClient();
  const { data, error } = db
    ? await db.from("creator_applications").select("id, name, email, instagram, tiktok, niche, city, whatsapp, created_at").order("created_at", { ascending: false }).limit(300)
    : { data: null, error: true };
  const apps = (data ?? []) as App[];
  return (
    <div className="page">
      <header className="page-head rise" style={d(0)}>
        <div>
          <p className="eyebrow">Siteden gelenler</p>
          <h1 className="h1">Başvurular</h1>
        </div>
      </header>
      <section className="card rise" style={d(100)} aria-label="Kreatör başvuruları">
        <div className="card-head">
          <h2 className="h2">Kreatör başvuruları</h2>
          <span className="pill">{apps.length}</span>
        </div>
        {error && <p className="issue" role="alert">Başvurular okunamadı.</p>}
        {!error && apps.length === 0 && <p className="muted small">Henüz başvuru yok. Sitedeki form doldurulunca burada görünür.</p>}
        {apps.length > 0 && (
          <ul className="recontact-list">
            {apps.map((a) => (
              <li key={a.id} className="row recontact-row">
                <span className="avatar" aria-hidden="true">{a.name.slice(0, 1).toUpperCase()}</span>
                <div className="who">
                  <p className="who-name">{a.name}</p>
                  <p className="who-sub">
                    {a.instagram && <a href={`https://www.instagram.com/${a.instagram}/`} target="_blank" rel="noopener noreferrer">IG @{a.instagram}</a>}
                    {a.instagram && a.tiktok && <span className="dotsep">·</span>}
                    {a.tiktok && <a href={`https://www.tiktok.com/@${a.tiktok}`} target="_blank" rel="noopener noreferrer">TikTok @{a.tiktok}</a>}
                    <span className="dotsep">·</span>
                    <span>{a.niche}</span>
                    <span className="dotsep">·</span>
                    <span>{a.city}</span>
                  </p>
                  <p className="who-sub">
                    <span>{a.email}</span>
                    {a.whatsapp && (<><span className="dotsep">·</span><span>{a.whatsapp}</span></>)}
                    <span className="dotsep">·</span>
                    <span>{fmt(a.created_at)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
