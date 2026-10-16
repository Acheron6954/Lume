import type { CSSProperties } from "react";

/** Giriş animasyonu gecikmesi: <div className="rise" style={d(120)}> */
export const d = (ms: number): CSSProperties => ({ "--d": `${ms}ms` }) as CSSProperties;
