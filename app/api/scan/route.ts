// Adayları Instagram'dan doğrular. Sadece giriş yapmış kullanıcı çalıştırabilir.
// Tarayıcıda /api/scan adresini açmak yeterli (?force=1 yakın zamanda taranmışları da tarar).
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { runScan } from "@/lib/scan";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  try {
    return Response.json(await runScan(db, token, igUserId, { batch: 25, freshHours: 6, force }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Tarama başarısız" }, { status: 500 });
  }
}
