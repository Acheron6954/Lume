import type { Metadata } from "next";
import Link from "next/link";
import { d } from "@/lib/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Üye ol" };

export default function RegisterPage() {
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
        <p className="login-sub">Kreatör paneli üyeliği</p>
        <RegisterForm />
        <p className="login-fine">
          Üyelikler elle onaylanır; onaydan önce giriş yapılamaz. Zaten hesabın var mı? <Link href="/giris">Giriş yap</Link>
        </p>
        <p className="login-fine">
          <Link href="/">← Ana sayfaya dön</Link>
        </p>
      </section>
    </main>
  );
}
