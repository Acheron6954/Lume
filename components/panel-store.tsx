"use client";
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from "react";
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
  const [state, rawDispatch] = useReducer((s: PanelState, a: Action) => reduce(s, a, known), initialState);
  const [hydrated, setHydrated] = useState(false);
  // Salt okunurda hiçbir eylem state'e ulaşmaz (arayüzdeki kapalı düğmelere ek, ikinci kilit).
  const dispatch = useMemo<Dispatch<Action>>(() => (readOnly ? () => {} : rawDispatch), [readOnly]);

  useEffect(() => {
    // Salt okunur hesap yöneticinin seçimlerini okumaz ve üzerine yazmaz: temiz, varsayılan görünüm.
    // Veri yüklenemediyse (known boş) kayıtlı seçimleri silmemek için de hydrate etme.
    if (loadError || readOnly) {
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) rawDispatch({ type: "hydrate", state: sanitize(JSON.parse(raw), known) });
    } catch {}
    setHydrated(true);
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
