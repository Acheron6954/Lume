// Yanıt durumunu veritabanından okur (Gmail'e dokunmaz). Yalnızca yönetici.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { awaiting, summarize, FOLLOWUP_DAYS } from "@/lib/replies";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Bu hesap salt okunur." }, { status: 403 });
  const db = adminClient();
  if (!db) return Response.json({ error: "Supabase ayarları eksik" }, { status: 500 });

  const { data: auth } = await db.from("gmail_auth").select("email").eq("id", "main").maybeSingle();
  const { data: sent, error } = await db.from("sent_mail").select("influencer_id, sent_at, bounced_at").not("influencer_id", "is", null).limit(2000);
  if (error) return Response.json({ error: "Okunamadı" }, { status: 500 });
  const { data: inbound } = await db.from("emails").select("influencer_id, sent_at").eq("direction", "gelen").limit(2000);

  const rows = summarize(sent ?? [], (inbound ?? []) as { influencer_id: string; sent_at: string }[]);
  const now = new Date();
  return Response.json({
    connected: !!auth,
    followupDays: FOLLOWUP_DAYS,
    replied: rows.filter((r) => r.repliedAt).length,
    bounced: rows.filter((r) => r.bouncedAt).length,
    awaiting: awaiting(rows, now),
    total: rows.length,
  });
}
