"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  MAX_FAILS_GLOBAL,
  MAX_FAILS_PER_IP,
  SESSION_COOKIE,
  authenticate,
  lockedFor,
  readConfig,
  recordFail,
  recordSuccess,
  signSession,
} from "@/lib/auth";
import { checkMember } from "@/lib/members-db";

export type LoginState = { error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const cfg = readConfig();
  if (!cfg) {
    return { error: "Sunucu ayarları eksik (LUME_USER, LUME_PASS_HASH, SESSION_SECRET). Giriş kapalı." };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "yerel").trim();
  const wait = Math.max(lockedFor(`ip:${ip}`), lockedFor("global"));
  if (wait > 0) {
    return { error: `Çok fazla hatalı deneme. ${Math.ceil(wait / 60000)} dakika sonra tekrar dene.` };
  }

  const username = String(formData.get("username") ?? "").trim().slice(0, 160);
  const password = String(formData.get("password") ?? "").slice(0, 128);

  // Önce sahip/izleyici (ortam değişkenleri), sonra onaylı üyeler (e-posta ile).
  const envRole = authenticate(username, password, cfg);
  let sessionUser = envRole === "viewer" && cfg.viewer ? cfg.viewer.user : cfg.user;
  let role = envRole;
  if (!role && username.includes("@")) {
    const member = await checkMember(username, password);
    if (member?.status === "pending") {
      return { error: "Hesabın henüz onaylanmadı. Onaylandığında giriş yapabilirsin." };
    }
    if (member?.status === "approved") {
      role = member.role;
      sessionUser = member.email;
    }
  }
  if (!role) {
    recordFail(`ip:${ip}`, MAX_FAILS_PER_IP);
    recordFail("global", MAX_FAILS_GLOBAL);
    await sleep(700);
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }

  recordSuccess(`ip:${ip}`);
  const store = await cookies();
  // Oturumdaki ad, girilen hesabın kendi adıdır (izleyici ise izleyicinin adı, üye ise e-postası).
  store.set(SESSION_COOKIE, signSession(sessionUser, cfg.secret, Date.now(), role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // maxAge yok: oturum çerezi, tarayıcı tamamen kapanınca silinir (sunucu tarafı süre yine token içinde).
  });
  redirect("/panel");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/giris");
}
