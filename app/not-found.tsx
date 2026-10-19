import type { Metadata } from "next";
import Link from "next/link";
import { d } from "@/lib/ui";

export const metadata: Metadata = { title: "Sayfa bulunamadı" };

export default function NotFound() {
  return (
    <main className="login">
      <div className="login-sky" aria-hidden="true">
        <span className="login-ring" />
        <span className="login-ring login-ring-2" />
      </div>
      <section className="login-card notfound-card rise" style={d(120)}>
        <div className="login-brand">
          <span className="orb orb-lg" aria-hidden="true" />
          <p className="notfound-code" aria-hidden="true">404</p>
        </div>
        <h1 className="notfound-title">Bu sayfa kara delike düştü</h1>
        <p className="login-sub">Aradığın sayfa yok ya da taşınmış olabilir.</p>
        <Link href="/" className="btn btn-primary btn-block">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
