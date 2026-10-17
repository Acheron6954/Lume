import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Intro } from "@/components/intro";
import "./globals.css";
import "./intro.css";

const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const body = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Lume", template: "%s · Lume" },
  description: "Lume",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0f2e",
  colorScheme: "dark",
};

// Animasyon siteye her girişte (sayfa her yüklendiğinde) oynar. Yalnızca "hareketi azalt" açıksa,
// ilk boyamadan önce katmanı gizler.
const BOOT = `(function(){try{var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches){d.setAttribute("data-intro","skip");d.classList.add("intro-done")}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        {children}
        <Intro />
        <noscript>
          <style>{`.intro{display:none}.rise,.page-enter{animation:none!important;opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </body>
    </html>
  );
}
