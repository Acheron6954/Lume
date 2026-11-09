// Yanıtları eşitler: gönderilen maillerin Gmail konuşmalarına yalnızca üstbilgi düzeyinde bakar,
// gerçek (otomatik olmayan) bir yanıt varsa `emails` tablosuna "gelen" olarak yazar.
// Hiçbir şey göndermez, silmez, okundu işaretlemez.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { accessToken, fetchThread } from "@/lib/gmail";
import { findReply } from "@/lib/replies";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOW_DAYS = 45; // bundan eski mailler artık sorgulanmaz
const MAX_PER_RUN = 40;
const PARALLEL = 5;

export async function POST() {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Bu hesap salt okunur." }, { status: 403 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const db = adminClient();
  if (!clientId || !clientSecret || !db) return Response.json({ error: "Gmail ya da Supabase ayarları eksik" }, { status: 500 });

  const { data: auth } = await db.from("gmail_auth").select("email, refresh_token").eq("id", "main").maybeSingle();
  if (!auth) return Response.json({ error: "Gmail bağlı değil" }, { status: 409 });

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data: sent, error: sentErr } = await db
    .from("sent_mail")
    .select("id, influencer_id, sent_at, gmail_thread_id")
    .not("influencer_id", "is", null)
    .not("gmail_thread_id", "is", null)
    .is("bounced_at", null)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(300);
  if (sentErr) return Response.json({ error: "Gönderilen mailler okunamadı" }, { status: 500 });

  const ids = [...new Set((sent ?? []).map((s) => s.influencer_id as string))];
  const { data: inbound } = ids.length ? await db.from("emails").select("influencer_id, sent_at").eq("direction", "gelen").in("influencer_id", ids) : { data: [] };
  const replied = new Set((inbound ?? []).map((r) => r.influencer_id as string));

  // Yanıtı zaten kayıtlı hesapları atla; kalanlardan en yeniler önce, sınırlı sayıda.
  const pending = (sent ?? []).filter((s) => !replied.has(s.influencer_id as string)).slice(0, MAX_PER_RUN);
  if (pending.length === 0) return Response.json({ checked: 0, replies: 0, bounced: 0, errors: 0 });

  let token: string;
  try {
    token = await accessToken(auth.refresh_token, { clientId, clientSecret });
  } catch (e) {
    const gone = e instanceof Error && e.message === "invalid_grant";
    return Response.json({ error: gone ? "Gmail izni geçersiz, yeniden bağla" : "Gmail erişimi alınamadı" }, { status: 502 });
  }

  let replies = 0;
  let bounced = 0;
  let errors = 0;
  let forbidden = false;

  const check = async (row: (typeof pending)[number]) => {
    try {
      const thread = await fetchThread(token, row.gmail_thread_id as string);
      if (!thread) return;
      const verdict = findReply(thread, auth.email, new Date(row.sent_at).getTime());
      if (verdict.reply) {
        const r = verdict.reply;
        const { error } = await db
          .from("emails")
          .upsert({ influencer_id: row.influencer_id, direction: "gelen", subject: r.subject, body: r.snippet, gmail_message_id: r.messageId, sent_at: r.at }, { onConflict: "gmail_message_id", ignoreDuplicates: true });
        if (error) throw new Error("db");
        await db.from("influencers").update({ status: "gorusuluyor", updated_at: new Date().toISOString() }).eq("id", row.influencer_id).eq("status", "mail_atildi");
        replies += 1;
      } else if (verdict.bounced) {
        await db.from("sent_mail").update({ bounced_at: new Date().toISOString() }).eq("id", row.id);
        bounced += 1;
      }
    } catch (e) {
      if (e instanceof Error && /insufficient|permission|scope|forbidden/i.test(e.message)) forbidden = true;
      errors += 1;
    }
  };

  for (let n = 0; n < pending.length && !forbidden; n += PARALLEL) {
    await Promise.all(pending.slice(n, n + PARALLEL).map(check));
  }

  if (forbidden && replies === 0) {
    return Response.json({ error: "Gmail yanıt okuma izni yok. Gmail'i yeniden bağla (iki izni de ver)." }, { status: 403 });
  }
  return Response.json({ checked: pending.length, replies, bounced, errors });
}
