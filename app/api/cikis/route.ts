// Oturumu kapatıp girişe gönderir. Erişimi kaldırılan üyenin çerezi burada silinir (sayfa düzeni çerez yazamaz).
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return Response.redirect(new URL("/giris", req.url), 303);
}
