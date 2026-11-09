import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel-shell";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { loadInfluencers } from "@/lib/influencers-db";
import { isMemberLogin } from "@/lib/members";
import { memberStillApproved } from "@/lib/members-db";

// Proxy'ye ek olarak sayfa tarafında da oturum doğrulanır (çift kilit).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) redirect("/giris");
  // Üye girişi: erişimi kaldırıldıysa ya da rolü değiştiyse her sayfa açılışında yeniden kontrol edilir.
  let role = session.role;
  if (isMemberLogin(session.user)) {
    const current = await memberStillApproved(session.user);
    if (!current) redirect("/api/cikis");
    role = current === "admin" && session.role === "admin" ? "admin" : "viewer";
  }
  // Üyeler sayfasını yalnızca site sahibi (ortam değişkenindeki yönetici) görür.
  const isOwner = !isMemberLogin(session.user) && session.role === "admin";
  const { influencers, error } = await loadInfluencers();
  return (
    <PanelShell user={session.user} influencers={influencers} loadError={error} readOnly={role === "viewer"} isOwner={isOwner}>
      {children}
    </PanelShell>
  );
}
