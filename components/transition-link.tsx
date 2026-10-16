"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";

/** idle: sakin · going: eski sayfa çıkıyor · done: yeni sayfa geldi, çizgi sönüyor */
export type NavPhase = "idle" | "going" | "done";

type Ctl = { phase: NavPhase; go: (href: string) => void };
const Ctx = createContext<Ctl | null>(null);

const OUT_MS = 240;
const FAILSAFE_MS = 6000;

export function NavTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<NavPhase>("idle");
  const phaseRef = useRef<NavPhase>("idle");
  const timers = useRef<number[]>([]);

  const set = useCallback((p: NavPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const go = useCallback(
    (href: string) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || phaseRef.current === "going") {
        router.push(href);
        return;
      }
      clear();
      set("going");
      later(() => router.push(href), OUT_MS);
      later(() => set("idle"), FAILSAFE_MS); // gezinme olmazsa (hata vb.) ekran takılı kalmasın
    },
    [router, clear, set, later],
  );

  // Yeni sayfa geldi: çıkış durumunu bitir, ilerleme çizgisini söndür.
  useEffect(() => {
    if (phaseRef.current !== "going") return;
    clear();
    set("done");
    later(() => set("idle"), 800);
  }, [pathname, clear, set, later]);

  useEffect(() => clear, [clear]);

  const value = useMemo<Ctl>(() => ({ phase, go }), [phase, go]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavPhase(): NavPhase {
  return useContext(Ctx)?.phase ?? "idle";
}

/** Normal Link gibi çalışır; aynı sayfaya gitmez, tıklanınca önce çıkış animasyonunu oynatır. */
export function TransitionLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
  const ctl = useContext(Ctx);
  const target = typeof href === "string" ? href : (href.pathname ?? "/");
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || !ctl) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (rest.target && rest.target !== "_self") return;
        e.preventDefault();
        if (target === window.location.pathname) return;
        ctl.go(target);
      }}
    />
  );
}
