// Adayları Instagram'dan doğrular: takipçi, ort. beğeni/yorum, etkileşim oranı, bio'daki e-posta.
import type { SupabaseClient } from "@supabase/supabase-js";
import { discover, emailFromBio, engagementOf } from "./instagram";

const CONCURRENCY = 3;

type Row = { id: string; instagram: string; email: string | null; other_url: string | null };

export type ScanOutcome = {
  picked: number;
  ok: number;
  notBusiness: number;
  failed: number;
  stoppedBy: string | null;
  errors: { handle: string; message: string }[];
};

/** Tek parti tarama: en eski taranmış (veya hiç taranmamış) hesaplardan başlar. */
export async function runScan(
  db: SupabaseClient,
  token: string,
  igUserId: string,
  opts: { batch: number; freshHours: number; force: boolean },
): Promise<ScanOutcome> {
  let q = db
    .from("influencers")
    .select("id, instagram, email, other_url")
    .not("instagram", "is", null)
    .eq("excluded", false)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(opts.batch);
  if (!opts.force) {
    const cutoff = new Date(Date.now() - opts.freshHours * 3_600_000).toISOString();
    q = q.or(`last_scanned_at.is.null,last_scanned_at.lt.${cutoff}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`Veritabanı: ${error.message}`);
  const rows = (data ?? []) as Row[];

  const out: ScanOutcome = { picked: rows.length, ok: 0, notBusiness: 0, failed: 0, stoppedBy: null, errors: [] };
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
        out.errors.push({ handle: row.instagram, message: `Yazılamadı: ${upErr.message}` });
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
    out.errors.push({ handle: row.instagram, message: r.message.slice(0, 160) });
  };

  for (let i = 0; i < rows.length && !stop; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(work));
  }
  out.errors = out.errors.slice(0, 10);
  return out;
}
