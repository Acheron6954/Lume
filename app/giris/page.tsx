import type { Metadata } from "next";
import { d } from "@/lib/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

export default function LoginPage() {
  return (
    <main className="login">
      <div className="login-sky" aria-hidden="true">
        <span className="login-ring" />
        <span className="login-ring login-ring-2" />
      </div>
      <section className="login-card rise" style={d(120)}>
        <div className="login-brand">
          <span className="orb orb-lg" aria-hidden="true" />
          <h1 className="wordmark wordmark-lg">L&apos;UME</h1>
        </div>
        <p className="login-sub">Kreatör paneline giriş</p>
        <LoginForm />
        <p className="login-fine">Bu alan yalnızca yetkili kullanıcılar içindir.</p>
      </section>
    </main>
  );
}
