"use client";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="login-form">
      <label className="field">
        <span>Kullanıcı adı</span>
        <input name="username" className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </label>
      <label className="field">
        <span>Şifre</span>
        <input name="password" type="password" className="input" autoComplete="current-password" required />
      </label>
      <p className="form-error" role="alert" aria-live="polite">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Kontrol ediliyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
