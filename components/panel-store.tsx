"use client";
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from "react";
import { warningsOf, type Influencer, type Warning } from "@/lib/influencer";
import { initialState, reduce, sanitize, type Action, type PanelState } from "@/lib/panel-state";
import { SAMPLE_INFLUENCERS } from "@/lib/sample-data";

const KEY = "lume-panel-v1";
const ALL: Influencer[] = SAMPLE_INFLUENCERS;
const KNOWN: ReadonlySet<string> = new Set(ALL.map((i) => i.id));

type Store = {
  state: PanelState;
  dispatch: Dispatch<Action>;
  all: Influencer[];
  hydrated: boolean;
  warningsFor: (i: Influencer) => Warning[];
};

const Ctx = createContext<Store | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer((s: PanelState, a: Action) => reduce(s, a, KNOWN), initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) dispatch({ type: "hydrate", state: sanitize(JSON.parse(raw), KNOWN) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  const value = useMemo<Store>(
    () => ({ state, dispatch, all: ALL, hydrated, warningsFor: (i) => warningsOf(i, state.thresholds) }),
    [state, hydrated],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanel(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePanel yalnızca PanelProvider içinde kullanılabilir");
  return v;
}
