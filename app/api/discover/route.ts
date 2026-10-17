// Günlük aday arama: web'de ara, yeni hesapları listeye ekle, sonra Instagram'dan doğrula.
// Vercel Cron her gün çağırır (CRON_SECRET ile). Panelden "Aday ara" düğmesi de buraya gelir (oturumla).
// Hiçbir yere mail veya DM göndermez.
import { cookies } from "next/headers";
import { SESSION_COOKIE, cronAuthorized, readConfig, readSession } from "@/lib/auth";
import { runDiscovery } from "@/lib/discover-run";
import { runScan, type ScanOutcome } from "@/lib/scan";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUERY_COUNT = 6; // günde 6 arama: ayda ~180, Brave'in aylık kredisi içinde
const SCAN_BUDGET_MS = 30_000; // yeni parti başlatmak için kalan süre eşiği
const SCAN_BATCH = 25;

export async function GET(request: Request) {
  const started = Date.now();
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session && !cronAuthorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  }
  if (session && session.role !== "admin") return Response.json({ error: "Bu hesap salt okunur." }, { status: 403 });

  const braveKey = process.env.BRAVE_API_KEY;
  const db = adminClient();
  if (!braveKey) return Response.json({ error: "BRAVE_API_KEY eksik (Vercel ortam değişkeni)" }, { status: 500 });
  if (!db) return Response.json({ error: "Supabase ayarları eksik (SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });

  try {
    const discovery = await runDiscovery(db, braveKey, { queryCount: QUERY_COUNT });

    const token = process.env.IG_TOKEN;
    const igUserId = process.env.IG_USER_ID;
    let scan: ScanOutcome | null = null;
    if (token && igUserId) {
      scan = { picked: 0, ok: 0, notBusiness: 0, failed: 0, stoppedBy: null, errors: [] };
      // Zaman izin verdikçe, taranacak hesap kalmayana kadar parti parti doğrula.
      while (Date.now() - started < SCAN_BUDGET_MS) {
        const r = await runScan(db, token, igUserId, { batch: SCAN_BATCH, freshHours: 6, force: false });
        scan.picked += r.picked;
        scan.ok += r.ok;
        scan.notBusiness += r.notBusiness;
        scan.failed += r.failed;
        scan.errors.push(...r.errors);
        if (r.stoppedBy) scan.stoppedBy = r.stoppedBy;
        if (r.stoppedBy || r.picked < SCAN_BATCH) break;
      }
      scan.errors = scan.errors.slice(0, 10);
    }
    return Response.json({ discovery, scan });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Arama başarısız" }, { status: 500 });
  }
}
