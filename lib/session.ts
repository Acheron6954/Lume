// Sayfa ve sunucu eylemleri için oturum yardımcıları (yalnızca sunucu).
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "./auth";
import { isMemberLogin } from "./members";

export async function currentSession() {
  const cfg = readConfig();
  const store = await cookies();
  return cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
}

/** Site sahibi: ortam değişkenindeki yönetici hesabı. Üyeleri yalnızca o yönetir. */
export async function isOwnerSession(): Promise<boolean> {
  const s = await currentSession();
  return !!s && s.role === "admin" && !isMemberLogin(s.user);
}
