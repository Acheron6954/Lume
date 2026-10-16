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
  warningsFor: (i: Influencer) => Warning[];
};

const Ctx = createContext<Store | null>(null);

export function PanelProvider({
  influencers,
  loadError = null,
  children,
}: {
  influencers: Influencer[];
  loadError?: string | null;
  children: ReactNode;
}) {
  const known = useMemo<ReadonlySet<string>>(() => new Set(influencers.map((i) => i.id)), [influencers]);
  const [state, dispatch] = useReducer((s: PanelState, a: Action) => reduce(s, a, known), initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Veri yüklenemediyse (known boş) kayıtlı seçimleri silmemek için hydrate etme.
    if (loadError) {
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) dispatch({ type: "hydrate", state: sanitize(JSON.parse(raw), known) });
    } catch {}
    setHydrated(true);
  }, [known, loadError]);

  useEffect(() => {
    if (!hydrated || loadError) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated, loadError]);

  const value = useMemo<Store>(
    () => ({ state, dispatch, all: influencers, loadError, hydrated, warningsFor: (i) => warningsOf(i, state.thresholds) }),
    [state, influencers, loadError, hydrated],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanel(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePanel yalnızca PanelProvider içinde kullanılabilir");
  return v;
}
