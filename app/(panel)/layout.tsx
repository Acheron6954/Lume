import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel-shell";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";

// Proxy'ye ek olarak sayfa tarafında da oturum doğrulanır (çift kilit).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) redirect("/giris");
  return <PanelShell user={session.user}>{children}</PanelShell>;
}
