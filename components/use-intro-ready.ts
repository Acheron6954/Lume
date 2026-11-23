"use client";
import { useSyncExternalStore } from "react";

// Açılış animasyonu bitince <html> etiketine "intro-done" sınıfı eklenir; bu kanca o sınıfı izler.
function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
const isDone = () => document.documentElement.classList.contains("intro-done");

/** Açılış animasyonu bitip site görünür olduğunda true olur (animasyon yoksa hemen). */
export function useIntroReady(): boolean {
  return useSyncExternalStore(subscribe, isDone, () => false);
}
