// Next 16'da "middleware" yerine "proxy". Oturumu olmayan herkes /giris'e gider.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, cronAuthorized, readConfig, readSession } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const cfg = readConfig();
  const session = cfg ? readSession(request.cookies.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  const onLogin = request.nextUrl.pathname === "/giris";

  // Günlük aday arama: Vercel Cron oturum açamaz, gizli anahtarla gelir (rota da ayrıca doğrular).
  if (request.nextUrl.pathname === "/api/discover" && cronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.next();
  }

  if (!session && !onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (session && onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|woff2?)$).*)"],
};
