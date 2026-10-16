import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel-shell";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { loadInfluencers } from "@/lib/influencers-db";

// Proxy'ye ek olarak sayfa tarafında da oturum doğrulanır (çift kilit).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) redirect("/giris");
  const { influencers, error } = await loadInfluencers();
  return (
    <PanelShell user={session.user} influencers={influencers} loadError={error}>
      {children}
    </PanelShell>
  );
}
