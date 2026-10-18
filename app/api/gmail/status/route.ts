// Gmail bağlı mı, bugün kaç mail gitti? Yalnızca yönetici; token asla dönmez.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { DAILY_LIMIT, istanbulDayStart } from "@/lib/gmail";
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

  const configured = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  const { data: auth } = await db.from("gmail_auth").select("email").eq("id", "main").maybeSingle();
  const { count } = await db.from("sent_mail").select("id", { count: "exact", head: true }).gte("sent_at", istanbulDayStart(new Date()));
  return Response.json({ configured, connected: !!auth, email: auth?.email ?? null, sentToday: count ?? 0, limit: DAILY_LIMIT });
}
