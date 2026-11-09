"use server";

import { headers } from "next/headers";
import { lockedFor, recordFail } from "@/lib/auth";
import { parseRegistration } from "@/lib/members";
import { registerMember } from "@/lib/members-db";

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
  // Adres zaten kayıtlı olsa da aynı mesaj: kimin kayıtlı olduğu dışarıdan anlaşılmasın.
  return { done: true };
}
