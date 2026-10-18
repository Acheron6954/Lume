// Google izin ekranından dönüş: kodu token'a çevirir, yenileme token'ını yalnızca sunucu tarafı tabloda saklar.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { exchangeCode } from "@/lib/gmail";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const back = (origin: string, status: string) => Response.redirect(`${origin}/mailler?gmail=${status}`, 302);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session || session.role !== "admin") return Response.json({ error: "Giriş gerekli" }, { status: 401 });

  const expected = store.get("lume-gmail-state")?.value;
  store.delete({ name: "lume-gmail-state", path: "/api/gmail" });
  if (url.searchParams.get("error")) return back(origin, "iptal");
  const code = url.searchParams.get("code");
  if (!expected || !code || url.searchParams.get("state") !== expected) return back(origin, "hata");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const db = adminClient();
  if (!clientId || !clientSecret || !db) return back(origin, "ayar");

  try {
    const { refreshToken, email } = await exchangeCode(code, { clientId, clientSecret, redirectUri: `${origin}/api/gmail/callback` });
    const { error } = await db.from("gmail_auth").upsert({ id: "main", email, refresh_token: refreshToken, connected_at: new Date().toISOString() });
    if (error) return back(origin, "hata");
    return back(origin, "ok");
  } catch {
    return back(origin, "hata");
  }
}
