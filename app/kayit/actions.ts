"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, lockedFor, readConfig, recordFail, signSession } from "@/lib/auth";
import { parseRegistration } from "@/lib/members";
import { checkMember, registerMember } from "@/lib/members-db";

export type RegisterState = { error?: string; done?: boolean };

// Aynı adresten art arda kayıt: saatte en fazla 5 (bellekte; Vercel Firewall ile birlikte düşün).
const REG_LIMIT = 5;

export async function register(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "yerel").trim();
  if (lockedFor(`reg:${ip}`) > 0) return { error: "Çok fazla deneme yapıldı. Biraz sonra tekrar dene." };

  const parsed = parseRegistration({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    password2: formData.get("password2"),
    kvkk: formData.get("kvkk"),
    website: formData.get("website"),
  });
  // Bot: başarılı gibi görünsün, hiçbir şey kaydetme.
  if (!parsed.ok && parsed.bot) return { done: true };
  if (!parsed.ok) return { error: parsed.error };

  recordFail(`reg:${ip}`, REG_LIMIT);
  const res = await registerMember(parsed.value);
  if (res === "error") return { error: "Kayıt şu an alınamadı. Biraz sonra tekrar dene." };

  // Hesap oluştuysa (ya da adres zaten bu şifreyle kayıtlıysa) doğrudan giriş yapılır.
  // Adres başka bir şifreyle kayıtlıysa giriş yapılmaz ve yine aynı mesaj döner: kimin kayıtlı olduğu dışarıdan anlaşılmaz.
  const cfg = readConfig();
  const member = res === "created" ? { status: "pending" as const, role: "viewer" as const, email: parsed.value.email } : await checkMember(parsed.value.email, parsed.value.password);
  if (!cfg || !member || member.status === "rejected") return { done: true };
  const role = member.status === "approved" ? member.role : "member";
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(member.email, cfg.secret, Date.now(), role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect(role === "member" ? "/" : "/panel");
}
