// Gmail bağlama: yöneticiyi Google izin ekranına gönderir. Yalnızca "gmail.send" (mail gönderme) izni istenir.
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { authUrl } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const STATE_COOKIE = "lume-gmail-state";

export async function GET(req: Request) {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  if (session.role !== "admin") return Response.json({ error: "Bu hesap salt okunur." }, { status: 403 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return Response.json({ error: "GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET ayarlanmamış" }, { status: 500 });
  }
  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  store.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/gmail", maxAge: 600 });
  return Response.redirect(authUrl({ clientId, redirectUri: `${origin}/api/gmail/callback` }, state), 302);
}
