"use client";
import Link from "next/link";
import { useActionState } from "react";
import { MIN_PASSWORD } from "@/lib/members";
import { register, type RegisterState } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, {});
  if (state.done) {
    return (
      <p className="form-ok" role="status">
        Kaydın alındı. Hesabın onaylandığında bu e-posta ve şifreyle giriş yapabilirsin.
      </p>
    );
  }
  return (
    <form action={action} className="login-form">
      <label className="field">
        <span>Ad soyad</span>
        <input name="name" className="input" autoComplete="name" required maxLength={80} />
      </label>
      <label className="field">
        <span>E-posta</span>
        <input name="email" type="email" className="input" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={160} />
      </label>
      <label className="field">
        <span>Şifre (en az {MIN_PASSWORD} karakter)</span>
        <input name="password" type="password" className="input" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} />
      </label>
      <label className="field">
        <span>Şifre tekrar</span>
        <input name="password2" type="password" className="input" autoComplete="new-password" required minLength={MIN_PASSWORD} maxLength={128} />
      </label>
      <label className="hp-field" aria-hidden="true">
        Web sitesi
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="kvkk-line">
        <input type="checkbox" name="kvkk" required />
        <span>
          <Link href="/#kvkk">KVKK Aydınlatma Metni</Link>&apos;ni okudum; üyelik başvurumun değerlendirilmesi için verilerimin işlenmesine onay veriyorum.
        </span>
      </label>
      <p className="form-error" role="alert" aria-live="polite">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Gönderiliyor…" : "Üye ol"}
      </button>
    </form>
  );
}
