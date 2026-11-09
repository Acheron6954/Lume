// Google izin ekranından dönüş noktası (Google Console'daki redirect URI). Oturum gerektirmez ve hiçbir şey kaydetmez:
// yalnızca site içi bir ara sayfa döner, o sayfa /api/gmail/complete'e yönlendirir (orada oturum ve state doğrulanır).
import { bouncePage } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return new Response(bouncePage(url.searchParams), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
