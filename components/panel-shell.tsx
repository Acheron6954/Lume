"use client";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, type ReactNode } from "react";
import { logout } from "@/app/giris/actions";
import { needsLogin } from "@/lib/login-gate";
import { Icon, type IconName } from "./icons";
import { PanelProvider, usePanel } from "./panel-store";
import { NavTransitionProvider, TransitionLink, useNavPhase } from "./transition-link";
import type { Influencer } from "@/lib/influencer";
import { approvedCount } from "@/lib/panel-state";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Genel Bakış", icon: "home" },
  { href: "/influencerlar", label: "Influencerlar", icon: "users" },
  { href: "/mailler", label: "Mail Kontrol", icon: "mail" },
  { href: "/dm", label: "DM Kontrol", icon: "ig" },
];

function Shell({ user, children }: { user: string; children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { state, loadError, readOnly } = usePanel();
  const phase = useNavPhase();

  // Siteye her girişte şifre sorulur: yeni sekme ya da adres çubuğundan yeniden giriş, oturumu kapatır.
  useEffect(() => {
    if (needsLogin()) startTransition(() => void logout());
  }, []);

  const badge: Record<string, number> = { "/influencerlar": state.selected.length, "/mailler": approvedCount(state) };

  return (
    <>
      {/* Izgara dışında tutulur: stil gecikse bile yerleşimi bozmaz */}
      <div className="route-bar" data-phase={phase} aria-hidden="true" />
      <div className="shell">
      <div className="bg bg-night" aria-hidden="true" />

      <aside className="sidebar">
        <TransitionLink href="/" className="brand" aria-label="Lume ana sayfa">
          <span className="orb" aria-hidden="true" />
          <span className="wordmark">L&apos;UME</span>
        </TransitionLink>
        <nav className="nav" aria-label="Ana menü">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <TransitionLink key={n.href} href={n.href} className="nav-link" aria-current={active ? "page" : undefined}>
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {badge[n.href] > 0 && <b className="nav-badge">{badge[n.href]}</b>}
              </TransitionLink>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="who-me">
            <span className="avatar sm" aria-hidden="true">{user.slice(0, 1).toUpperCase()}</span>
            <span>{user}</span>
            {readOnly && <span className="muted small" title="Bu hesap her şeyi görür ama hiçbir şeyi değiştiremez">salt okunur</span>}
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost btn-sm">
              <Icon name="out" size={16} /> Çıkış
            </button>
          </form>
        </div>
      </aside>

      <main className="main" data-phase={phase}>
        {loadError && (
          <div className="banner" role="alert">
            <p>{loadError}</p>
          </div>
        )}
        {children}
      </main>
      </div>
    </>
  );
}

export function PanelShell({
  user,
  influencers,
  loadError,
  readOnly = false,
  children,
}: {
  user: string;
  influencers: Influencer[];
  loadError: string | null;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <PanelProvider influencers={influencers} loadError={loadError} readOnly={readOnly}>
      <NavTransitionProvider>
        <Shell user={user}>{children}</Shell>
      </NavTransitionProvider>
    </PanelProvider>
  );
}
