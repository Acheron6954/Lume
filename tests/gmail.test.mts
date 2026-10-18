import test from "node:test";
import assert from "node:assert/strict";
import { authUrl, buildRaw, emailFromIdToken, exchangeCode, accessToken, istanbulDayStart, remainingToday, sendRaw, validateOutgoing, DAILY_LIMIT } from "../lib/gmail";

const cfg = { clientId: "cid", clientSecret: "sec", redirectUri: "https://x.test/api/gmail/callback" };
const jwt = (p: object) => `h.${Buffer.from(JSON.stringify(p)).toString("base64url")}.s`;
const reply = (body: object, status = 200) => async () => new Response(JSON.stringify(body), { status });

test("authUrl yalnızca gmail.send ister ve state taşır", () => {
  const u = new URL(authUrl(cfg, "abc"));
  assert.equal(u.searchParams.get("state"), "abc");
  assert.equal(u.searchParams.get("access_type"), "offline");
  const scope = u.searchParams.get("scope") ?? "";
  assert.ok(scope.includes("gmail.send"));
  assert.ok(!scope.includes("readonly") && !scope.includes("mail.google.com"));
});

test("validateOutgoing başlık enjeksiyonunu ve kötü adresi reddeder", () => {
  assert.equal(validateOutgoing({ to: "a@b.com", subject: "Konu", body: "Metin" }), null);
  assert.ok(validateOutgoing({ to: "a@b.com\nBcc: x@y.com", subject: "K", body: "M" }));
  assert.ok(validateOutgoing({ to: "a@b.com", subject: "K\r\nBcc: x@y.com", body: "M" }));
  assert.ok(validateOutgoing({ to: "a@b.com,c@d.com", subject: "K", body: "M" }));
  assert.ok(validateOutgoing({ to: "yok", subject: "K", body: "M" }));
  assert.ok(validateOutgoing({ to: "a@b.com", subject: " ", body: "M" }));
  assert.ok(validateOutgoing({ to: "a@b.com", subject: "K", body: "" }));
});

test("buildRaw UTF-8 konu ve gövdeyi doğru kodlar", () => {
  const raw = Buffer.from(buildRaw("ben@gmail.com", { to: "a@b.com", subject: "İş birliği şöyle", body: "Merhaba Ayşe,\nSevgiler" }), "base64url").toString("utf8");
  const [head, bodyB64] = raw.split("\r\n\r\n");
  assert.match(head, /^From: ben@gmail\.com\r\nTo: a@b\.com\r\nSubject: =\?UTF-8\?B\?/);
  const subj = /Subject: =\?UTF-8\?B\?(.+?)\?=/.exec(head)![1];
  assert.equal(Buffer.from(subj, "base64").toString("utf8"), "İş birliği şöyle");
  assert.equal(Buffer.from(bodyB64.replace(/\r\n/g, ""), "base64").toString("utf8"), "Merhaba Ayşe,\r\nSevgiler");
  assert.ok(!/[+/=]/.test(buildRaw("a@b.com", { to: "c@d.com", subject: "s", body: "b" })), "base64url olmalı");
});

test("emailFromIdToken", () => {
  assert.equal(emailFromIdToken(jwt({ email: "ben@gmail.com" })), "ben@gmail.com");
  assert.equal(emailFromIdToken(jwt({ email: "bozuk" })), null);
  assert.equal(emailFromIdToken("çöp"), null);
  assert.equal(emailFromIdToken(undefined), null);
});

test("exchangeCode: refresh token ve e-posta; eksikse hata", async () => {
  const ok = await exchangeCode("kod", cfg, reply({ refresh_token: "r1", id_token: jwt({ email: "ben@gmail.com" }), scope: "openid email https://www.googleapis.com/auth/gmail.send" }));
  assert.deepEqual(ok, { refreshToken: "r1", email: "ben@gmail.com" });
  await assert.rejects(exchangeCode("kod", cfg, reply({ id_token: jwt({ email: "ben@gmail.com" }) })), /no_refresh_token/);
  await assert.rejects(exchangeCode("kod", cfg, reply({ refresh_token: "r", id_token: jwt({ email: "a@b.com" }), scope: "openid email" })), /scope_missing/);
  await assert.rejects(exchangeCode("kod", cfg, reply({ error: "invalid_grant" }, 400)), /invalid_grant/);
});

test("accessToken ve sendRaw", async () => {
  assert.equal(await accessToken("r", cfg, reply({ access_token: "t" })), "t");
  await assert.rejects(accessToken("r", cfg, reply({ error: "invalid_grant" }, 400)), /invalid_grant/);
  let seen: { auth?: string; raw?: string } = {};
  const f = async (_u: string, init?: RequestInit) => {
    seen = { auth: (init?.headers as Record<string, string>).Authorization, raw: JSON.parse(String(init?.body)).raw };
    return new Response(JSON.stringify({ id: "m1" }));
  };
  assert.equal(await sendRaw("tok", "RAW", f), "m1");
  assert.deepEqual(seen, { auth: "Bearer tok", raw: "RAW" });
  await assert.rejects(sendRaw("tok", "RAW", reply({ error: { message: "Daily limit" } }, 429)), /Daily limit/);
});

test("istanbulDayStart ve kalan hak", () => {
  // 18 Ekim 2026 20:45 İstanbul = 17:45 UTC → gün başı 17 Ekim 21:00 UTC
  assert.equal(istanbulDayStart(new Date("2026-10-18T17:45:00Z")), "2026-10-17T21:00:00.000Z");
  // İstanbul'da 00:30 (UTC 21:30) yeni günün başıdır
  assert.equal(istanbulDayStart(new Date("2026-10-17T21:30:00Z")), "2026-10-17T21:00:00.000Z");
  assert.equal(remainingToday(0), DAILY_LIMIT);
  assert.equal(remainingToday(999), 0);
});
