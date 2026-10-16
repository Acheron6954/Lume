"use client";
import { useEffect, useRef, useState } from "react";
import { startBlackHole } from "@/lib/blackhole";

const FLAG = "lume-intro";

/** Oturumda bir kez oynar. Atla düğmesi, Esc, ya da "hareketi azalt" ayarı animasyonu geçer. */
export function Intro() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const html = document.documentElement;
    const remember = () => {
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {}
    };

    let seen = false;
    try {
      seen = sessionStorage.getItem(FLAG) === "1";
    } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || !canvas || seen || reduced) {
      html.classList.add("intro-done");
      setGone(true);
      return;
    }

    const ctl = startBlackHole(canvas, {
      onFrame: ({ x, y, r, title }) => {
        root.style.setProperty("--hx", `${x}px`);
        root.style.setProperty("--hy", `${y}px`);
        root.style.setProperty("--hr", `${r}px`);
        root.style.setProperty("--ti", title.toFixed(3));
      },
      onGo: () => html.classList.add("intro-done"),
      onDone: () => {
        remember();
        html.classList.add("intro-done");
        setGone(true);
      },
    });

    let leaving = false;
    skipRef.current = () => {
      if (leaving) return;
      leaving = true;
      ctl.stop();
      remember();
      html.classList.add("intro-done");
      root.dataset.leaving = "true";
      window.setTimeout(() => setGone(true), 650);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      ctl.stop();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (gone) return null;
  return (
    <div ref={rootRef} className="intro" role="dialog" aria-label="Açılış animasyonu">
      <div className="intro-cover" />
      <canvas ref={canvasRef} className="intro-canvas" />
      <div className="intro-title">
        L&apos;UME
        <span className="intro-sub">Kreatör Paneli</span>
      </div>
      <button type="button" className="intro-skip" onClick={() => skipRef.current()}>
        Atla
      </button>
    </div>
  );
}
