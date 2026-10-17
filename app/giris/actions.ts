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

  const username = String(formData.get("username") ?? "").trim().slice(0, 64);
  const password = String(formData.get("password") ?? "").slice(0, 128);

  const role = authenticate(username, password, cfg);
  if (!role) {
    recordFail(`ip:${ip}`, MAX_FAILS_PER_IP);
    recordFail("global", MAX_FAILS_GLOBAL);
    await sleep(700);
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }

  recordSuccess(`ip:${ip}`);
  const store = await cookies();
  // Oturumdaki ad, girilen hesabın kendi adıdır (viewer ise viewer'ın adı).
  const sessionUser = role === "viewer" && cfg.viewer ? cfg.viewer.user : cfg.user;
  store.set(SESSION_COOKIE, signSession(sessionUser, cfg.secret, Date.now(), role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // maxAge yok: oturum çerezi, tarayıcı tamamen kapanınca silinir (sunucu tarafı süre yine token içinde).
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/giris");
}
