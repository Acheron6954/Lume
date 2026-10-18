// Bio linklerinden TikTok hesabı ve mail adresi bulur. Sadece giriş yapmış yönetici çalıştırabilir.
// Tarayıcıda /api/linkscan adresini açmak yeterli. Hiçbir yere mail veya DM göndermez;
// yalnızca influencers tablosundaki BOŞ tiktok/email alanlarını doldurur.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { runLinkScan } from "@/lib/linkscan";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 12; // 3'lü paralel, sayfa başına en çok 8 sn: 60 sn sınırının altında kalır

export async function GET() {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Bu hesap salt okunur." }, { status: 403 });

  const db = adminClient();
  if (!db) return Response.json({ error: "Supabase ayarları eksik (SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });

  try {
    return Response.json(await runLinkScan(db, { batch: BATCH }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Link tarama başarısız" }, { status: 500 });
  }
}
