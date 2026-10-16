"use client";
import { useEffect, useState } from "react";

/** Açılış animasyonu bitip site görünür olduğunda true olur (animasyon yoksa hemen). */
export function useIntroReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    if (el.classList.contains("intro-done")) {
      setReady(true);
      return;
    }
    const mo = new MutationObserver(() => {
      if (el.classList.contains("intro-done")) {
        setReady(true);
        mo.disconnect();
      }
    });
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return ready;
}
