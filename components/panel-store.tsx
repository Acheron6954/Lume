"use client";
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { warningsOf, type Influencer, type Warning } from "@/lib/influencer";
import { initialState, reduce, sanitize, type Action, type PanelState } from "@/lib/panel-state";

const KEY = "lume-panel-v1";

type Store = {
  state: PanelState;
  dispatch: Dispatch<Action>;
  all: Influencer[];
  loadError: string | null;
  hydrated: boolean;
  /** Salt okunur hesap: durum değiştiren hiçbir eylem çalışmaz, tarayıcı depolamasına dokunulmaz. */
  readOnly: boolean;
  warningsFor: (i: Influencer) => Warning[];
};

const Ctx = createContext<Store | null>(null);

type Local = { s: PanelState; hydrated: boolean };
type LocalAction = Action | { type: "ready" };

export function PanelProvider({
  influencers,
  loadError = null,
  readOnly = false,
  children,
}: {
  influencers: Influencer[];
  loadError?: string | null;
  readOnly?: boolean;
  children: ReactNode;
}) {
  const known = useMemo<ReadonlySet<string>>(() => new Set(influencers.map((i) => i.id)), [influencers]);
  // Panel durumu ve "tarayıcı kaydı okundu mu" bilgisi tek reducer'da: ikisi aynı anda güncellenir.
  const [{ s: state, hydrated }, rawDispatch] = useReducer(
    (l: Local, a: LocalAction): Local => {
      if (a.type === "ready") return l.hydrated ? l : { ...l, hydrated: true };
      const next = reduce(l.s, a, known);
      return a.type === "hydrate" ? { s: next, hydrated: true } : next === l.s ? l : { ...l, s: next };
    },
    { s: initialState, hydrated: false },
  );
  // Salt okunurda hiçbir eylem state'e ulaşmaz (arayüzdeki kapalı düğmelere ek, ikinci kilit).
  const dispatch = useMemo<Dispatch<Action>>(() => (readOnly ? () => {} : rawDispatch), [readOnly]);

  useEffect(() => {
    // Salt okunur hesap yöneticinin seçimlerini okumaz ve üzerine yazmaz: temiz, varsayılan görünüm.
    // Veri yüklenemediyse (known boş) kayıtlı seçimleri silmemek için de hydrate etme.
    if (loadError || readOnly) {
      rawDispatch({ type: "ready" });
      return;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) rawDispatch({ type: "hydrate", state: sanitize(JSON.parse(raw), known) });
    } catch {}
    rawDispatch({ type: "ready" });
  }, [known, loadError, readOnly]);

  useEffect(() => {
    if (!hydrated || loadError || readOnly) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated, loadError, readOnly]);

  const value = useMemo<Store>(
    () => ({ state, dispatch, all: influencers, loadError, hydrated, readOnly, warningsFor: (i) => warningsOf(i, state.thresholds) }),
    [state, dispatch, influencers, loadError, hydrated, readOnly],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanel(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePanel yalnızca PanelProvider içinde kullanılabilir");
  return v;
}
