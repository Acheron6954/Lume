// Onaylanmış mailleri gönderir. Panel yalnızca kullanıcının "Evet, gönder" dediği mailleri yollar;
// sunucu ayrıca günlük sınırı, adres geçerliliğini ve aynı adrese ikinci mail gitmesini denetler.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { DAILY_LIMIT, MAX_PER_REQUEST, accessToken, buildRaw, istanbulDayStart, remainingToday, sendRaw, validateOutgoing } from "@/lib/gmail";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Item = { key: string; influencerId?: string | null; to: string; subject: string; body: string; repeat?: boolean };
type Result = { key: string; ok: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Bu hesap salt okunur." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { items?: unknown; confirm?: unknown } | null;
  // Açık onay olmadan hiçbir şey gitmez.
  if (!body || body.confirm !== true || !Array.isArray(body.items)) return Response.json({ error: "Onay gerekli" }, { status: 400 });
  if (body.items.length === 0 || body.items.length > MAX_PER_REQUEST) return Response.json({ error: `Tek seferde 1-${MAX_PER_REQUEST} mail gönderilebilir` }, { status: 400 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const db = adminClient();
  if (!clientId || !clientSecret || !db) return Response.json({ error: "Gmail ya da Supabase ayarları eksik" }, { status: 500 });

  const { data: auth } = await db.from("gmail_auth").select("email, refresh_token").eq("id", "main").maybeSingle();
  if (!auth) return Response.json({ error: "Gmail bağlı değil" }, { status: 409 });

  const { count } = await db.from("sent_mail").select("id", { count: "exact", head: true }).gte("sent_at", istanbulDayStart(new Date()));
  let left = remainingToday(count ?? 0);

  let token: string;
  try {
    token = await accessToken(auth.refresh_token, { clientId, clientSecret });
  } catch (e) {
    const gone = e instanceof Error && e.message === "invalid_grant";
    return Response.json({ error: gone ? "Gmail izni geçersiz, yeniden bağla" : "Gmail erişimi alınamadı" }, { status: 502 });
  }

  const results: Result[] = [];
  const seen = new Set<string>();
  for (const raw of body.items as Partial<Item>[]) {
    const key = typeof raw.key === "string" ? raw.key : "";
    const m = { to: String(raw.to ?? "").trim(), subject: String(raw.subject ?? ""), body: String(raw.body ?? "") };
    const problem = validateOutgoing(m);
    const infId = typeof raw.influencerId === "string" && UUID.test(raw.influencerId) ? raw.influencerId : null;
    const addr = m.to.toLowerCase();
    if (problem) {
      results.push({ key, ok: false, error: problem });
      continue;
    }
    if (left <= 0) {
      results.push({ key, ok: false, error: `Günlük ${DAILY_LIMIT} mail sınırı doldu` });
      continue;
    }
    // Aynı adrese ikinci mail: bu istekte ya da daha önce gittiyse gönderilmez.
    // Tekrar iletişim listesindekiler (repeat) için önceki mail engel değildir; aynı istekte tekrar yine engellenir.
    const { count: prev } = raw.repeat === true ? { count: 0 } : await db.from("sent_mail").select("id", { count: "exact", head: true }).ilike("to_email", addr);
    if (seen.has(addr) || (prev ?? 0) > 0) {
      results.push({ key, ok: false, error: "Bu adrese daha önce mail gitti" });
      continue;
    }
    seen.add(addr);
    try {
      const id = await sendRaw(token, buildRaw(auth.email, m));
      left -= 1;
      await db.from("sent_mail").insert({ influencer_id: infId, to_email: m.to, subject: m.subject, gmail_message_id: id });
      if (infId) {
        await db.from("emails").insert({ influencer_id: infId, direction: "giden", subject: m.subject, body: m.body, gmail_message_id: id });
        await db.from("influencers").update({ status: "mail_atildi", updated_at: new Date().toISOString() }).eq("id", infId).eq("status", "bulundu");
      }
      results.push({ key, ok: true });
    } catch (e) {
      results.push({ key, ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "Gönderilemedi" });
    }
  }
  return Response.json({ results, remaining: left });
}
