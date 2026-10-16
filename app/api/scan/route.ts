// Adayları Instagram'dan doğrular: takipçi, ort. beğeni/yorum, etkileşim oranı, bio'daki e-posta.
// Sadece giriş yapmış kullanıcı çalıştırabilir. Tarayıcıda /api/scan adresini açmak yeterli.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { discover, emailFromBio, engagementOf } from "@/lib/instagram";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 25; // tek çalıştırmada en fazla bu kadar hesap
const CONCURRENCY = 3;
const FRESH_HOURS = 6; // bu süre içinde taranmış hesap tekrar taranmaz (?force=1 ile aşılır)

type Row = { id: string; instagram: string; email: string | null; other_url: string | null };

export async function GET(request: Request) {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) return Response.json({ error: "Giriş gerekli" }, { status: 401 });

  const token = process.env.IG_TOKEN;
  const igUserId = process.env.IG_USER_ID;
  const db = adminClient();
  if (!token || !igUserId) return Response.json({ error: "IG_TOKEN veya IG_USER_ID eksik" }, { status: 500 });
  if (!db) return Response.json({ error: "Supabase ayarları eksik (SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });

  const force = new URL(request.url).searchParams.get("force") === "1";
  let q = db
    .from("influencers")
    .select("id, instagram, email, other_url")
    .not("instagram", "is", null)
    .eq("excluded", false)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (!force) {
    const cutoff = new Date(Date.now() - FRESH_HOURS * 3_600_000).toISOString();
    q = q.or(`last_scanned_at.is.null,last_scanned_at.lt.${cutoff}`);
  }
  const { data, error } = await q;
  if (error) return Response.json({ error: `Veritabanı: ${error.message}` }, { status: 500 });
  const rows = (data ?? []) as Row[];

  const out = { picked: rows.length, ok: 0, notBusiness: 0, failed: 0, stoppedBy: null as string | null };
  const errors: { handle: string; message: string }[] = [];
  let stop = false;

  const work = async (row: Row) => {
    if (stop) return;
    const r = await discover(row.instagram, igUserId, token);
    const now = new Date().toISOString();
    if (r.ok) {
      const p = r.profile;
      const eng = engagementOf(p);
      const email = emailFromBio(p.biography);
      const { error: upErr } = await db
        .from("influencers")
        .update({
          followers: p.followers,
          engagement_rate: eng.ratePct,
          avg_likes: eng.avgLikes,
          avg_comments: eng.avgComments,
          posts_analyzed: eng.posts,
          scan_status: "ok",
          last_scanned_at: now,
          updated_at: now,
          ...(email && !row.email ? { email } : {}),
          ...(p.website && !row.other_url ? { other_url: p.website.slice(0, 300) } : {}),
        })
        .eq("id", row.id);
      if (upErr) {
        out.failed++;
        errors.push({ handle: row.instagram, message: `Yazılamadı: ${upErr.message}` });
      } else out.ok++;
      return;
    }
    if (r.kind === "not_found") {
      await db.from("influencers").update({ scan_status: "not_business", last_scanned_at: now, updated_at: now }).eq("id", row.id);
      out.notBusiness++;
      return;
    }
    if (r.kind === "token" || r.kind === "rate") {
      stop = true;
      out.stoppedBy = r.kind === "token" ? "Instagram token geçersiz/süresi dolmuş" : "Instagram istek limiti doldu";
      return;
    }
    out.failed++;
    errors.push({ handle: row.instagram, message: r.message.slice(0, 160) });
  };

  for (let i = 0; i < rows.length && !stop; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(work));
  }

  return Response.json({ ...out, errors: errors.slice(0, 10) });
}
