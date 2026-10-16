"use client";
import { useEffect, useId, useRef, useState } from "react";
import { fmtCount } from "@/lib/influencer";
import { useIntroReady } from "./use-intro-ready";

/** Sayıyı sıfırdan hedefe sayarak getirir. Site görünür olunca başlar. */
export function CountUp({ value, ms = 1100 }: { value: number; ms?: number }) {
  const ready = useIntroReady();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, value, ms]);
  return <span className="num">{shown}</span>;
}

export function Sparkline({ values, w = 128, h = 40 }: { values: number[]; w?: number; h?: number }) {
  const id = useId().replace(/:/g, "");
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [2 + (i / Math.max(1, values.length - 1)) * (w - 4), h - 5 - (v / max) * (h - 12)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.38" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg${id})`} className="spark-area" />
      <path d={line} pathLength={1} className="spark-line" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" className="spark-dot" />
    </svg>
  );
}

/** Satır içi küçük şema: üstte takipçi, altta ortalama görüntülenme (aynı ölçek). */
export function DualBar({ followers, avgViews, max }: { followers: number; avgViews: number; max: number }) {
  const w = (v: number) => `${Math.max(4, Math.sqrt(v / max) * 100)}%`;
  return (
    <div className="dual" aria-hidden="true">
      <span className="dual-f" style={{ width: w(followers) }} />
      <span className="dual-v" style={{ width: w(avgViews) }} />
    </div>
  );
}

export type ScatterPoint = { id: string; name: string; x: number; y: number; flagged: boolean; selected: boolean };

const X0 = 5000;
const X1 = 200000;
const Y0 = 1000;
const Y1 = 100000;

/** Takipçi (yatay) ve ortalama görüntülenme (dikey), ikisi de logaritmik. Eşik bölgesi taranır. */
export function Scatter({
  points,
  minFollowers,
  minRatio,
  hoverId,
  onHover,
}: {
  points: ScatterPoint[];
  minFollowers: number;
  minRatio: number;
  hoverId: string | null;
  onHover: (id: string | null) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const W = 340;
  const H = 262;
  const L = 46;
  const R = 14;
  const T = 14;
  const B = 40;
  const iw = W - L - R;
  const ih = H - T - B;
  const lx = (v: number) => (Math.log(v) - Math.log(X0)) / (Math.log(X1) - Math.log(X0));
  const ly = (v: number) => (Math.log(v) - Math.log(Y0)) / (Math.log(Y1) - Math.log(Y0));
  const sx = (v: number) => L + lx(v) * iw;
  const sy = (v: number) => T + ih - ly(v) * ih;
  const xTicks = [5000, 10000, 25000, 50000, 100000, 200000];
  const yTicks = [1000, 3000, 10000, 30000, 100000];
  const minX = Math.min(X1, Math.max(X0, minFollowers));
  const ratioOn = minRatio > 0;
  const rx0 = sx(X0);
  const rx1 = sx(X1);
  const ry0 = sy(minRatio * X0);
  const ry1 = sy(minRatio * X1);
  const hover = points.find((p) => p.id === hoverId);

  return (
    <svg className="scatter" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Takipçi sayısına karşı ortalama görüntülenme grafiği">
      <defs>
        <clipPath id={`clip${uid}`}>
          <rect x={L} y={T} width={iw} height={ih} />
        </clipPath>
      </defs>
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="grid" />
          <text x={L - 6} y={sy(v) + 3} textAnchor="end" className="tick">{fmtCount(v)}</text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={`x${v}`}>
          <line x1={sx(v)} x2={sx(v)} y1={T} y2={T + ih} className="grid" />
          <text x={sx(v)} y={T + ih + 14} textAnchor="middle" className="tick">{fmtCount(v)}</text>
        </g>
      ))}
      <text x={L + iw / 2} y={H - 6} textAnchor="middle" className="axis">Takipçi</text>
      <text x={11} y={T + ih / 2} textAnchor="middle" className="axis" transform={`rotate(-90 11 ${T + ih / 2})`}>Ort. görüntülenme</text>

      <g clipPath={`url(#clip${uid})`}>
        <rect x={L} y={T} width={Math.max(0, sx(minX) - L)} height={ih} className="zone" />
        {ratioOn && <polygon points={`${rx0},${T + ih} ${rx1},${T + ih} ${rx1},${ry1} ${rx0},${ry0}`} className="zone" />}
        <line x1={sx(minX)} x2={sx(minX)} y1={T} y2={T + ih} className="limit" />
        {ratioOn && <line x1={rx0} y1={ry0} x2={rx1} y2={ry1} className="limit" />}
      </g>

      {points.map((p) => {
        const x = sx(Math.min(X1, Math.max(X0, p.x)));
        const y = sy(Math.min(Y1, Math.max(Y0, p.y)));
        const on = p.id === hoverId;
        return (
          <circle
            key={p.id}
            cx={x}
            cy={y}
            r={on ? 7 : p.selected ? 6 : 4.5}
            className={`pt${p.flagged ? " pt-flag" : ""}${p.selected ? " pt-sel" : ""}${on ? " pt-on" : ""}`}
            onMouseEnter={() => onHover(p.id)}
            onMouseLeave={() => onHover(null)}
          >
            <title>{p.name}</title>
          </circle>
        );
      })}
      {hover && (
        <text
          x={Math.min(W - R - 4, Math.max(L + 4, sx(Math.min(X1, Math.max(X0, hover.x)))))}
          y={Math.max(T + 10, sy(Math.min(Y1, Math.max(Y0, hover.y))) - 11)}
          textAnchor="middle"
          className="pt-label"
        >
          {hover.name}
        </text>
      )}
    </svg>
  );
}
