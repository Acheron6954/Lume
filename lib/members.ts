// Panel üyeliği: kayıt doğrulaması (saf, ağa çıkmaz). Onaylanmadan kimse giriş yapamaz.
import { isEmail } from "./influencer";

export type MemberStatus = "pending" | "approved" | "rejected";
export type MemberRole = "viewer" | "admin";

export type Registration = { name: string; email: string; password: string };

export const MIN_PASSWORD = 10;

export function parseRegistration(input: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  password2?: unknown;
  kvkk?: unknown;
  website?: unknown;
}): { ok: true; value: Registration } | { ok: false; error: string; bot?: boolean } {
  if (typeof input.website === "string" && input.website.trim()) return { ok: false, error: "", bot: true };
  const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 160) : "";
  const password = typeof input.password === "string" ? input.password : "";
  const password2 = typeof input.password2 === "string" ? input.password2 : "";
  if (name.length < 2) return { ok: false, error: "Adını ve soyadını yaz." };
  if (!isEmail(email)) return { ok: false, error: "Geçerli bir e-posta adresi yaz." };
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Şifre en az ${MIN_PASSWORD} karakter olmalı.` };
  if (password.length > 128) return { ok: false, error: "Şifre en fazla 128 karakter olabilir." };
  if (password !== password2) return { ok: false, error: "Şifreler aynı değil." };
  if (input.kvkk !== true && input.kvkk !== "on") return { ok: false, error: "Devam etmek için aydınlatma metnini onaylaman gerekiyor." };
  return { ok: true, value: { name, email, password } };
}

/** Oturumdaki kullanıcı adı ortam değişkenindeki sahip/izleyici mi, yoksa bir üye mi? Üyeler e-posta ile girer. */
export const isMemberLogin = (sessionUser: string): boolean => sessionUser.includes("@");
