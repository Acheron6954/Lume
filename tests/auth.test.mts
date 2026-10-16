// Çalıştır: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_MAX_AGE,
  checkCredentials,
  hashPassword,
  lockedFor,
  readConfig,
  readSession,
  recordFail,
  resetLimits,
  signSession,
  verifyPassword,
} from "../lib/auth.ts";

const SECRET = "x".repeat(48);
const cfg = { user: "umut", passHash: hashPassword("2710"), secret: SECRET };

test("hash: doğru şifre geçer, yanlış geçmez, hash düz şifre içermez", () => {
  assert.ok(verifyPassword("2710", cfg.passHash));
  assert.ok(!verifyPassword("2711", cfg.passHash));
  assert.ok(!cfg.passHash.includes("2710"));
  assert.ok(!cfg.passHash.includes("$"), "$ .env içinde değişken sanılır");
  assert.notEqual(hashPassword("2710"), hashPassword("2710"), "her hash farklı tuzla üretilir");
});

test("bozuk hash biçimleri reddedilir, hata fırlatmaz", () => {
  for (const bad of ["", "scrypt", "scrypt:", "scrypt:aa:", "md5:aa:bb", "scrypt::bb"]) {
    assert.equal(verifyPassword("2710", bad), false);
  }
});

test("kullanıcı adı büyük/küçük harfe duyarsız, şifre duyarlı", () => {
  assert.ok(checkCredentials("umut", "2710", cfg));
  assert.ok(checkCredentials("UMUT", "2710", cfg));
  assert.ok(!checkCredentials("umut", "2710 ", cfg));
  assert.ok(!checkCredentials("baska", "2710", cfg));
  assert.ok(!checkCredentials("", "", cfg));
});

test("oturum: imza doğrulanır, kurcalanırsa ve süresi dolarsa reddedilir", () => {
  const now = 1_000_000;
  const tok = signSession("umut", SECRET, now);
  assert.deepEqual(readSession(tok, SECRET, now + 1000), { user: "umut" });
  assert.equal(readSession(tok, "y".repeat(48), now + 1000), null, "başka anahtar");
  const [p, s] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "admin", exp: now + 1e9 })).toString("base64url");
  assert.equal(readSession(`${forged}.${s}`, SECRET, now), null, "yük değiştirildi");
  assert.equal(readSession(`${p}.${s}x`, SECRET, now), null, "imza bozuk");
  assert.equal(readSession(tok, SECRET, now + SESSION_MAX_AGE * 1000 + 1), null, "süre doldu");
  for (const junk of [undefined, "", "abc", ".", "a.b", "a.b.c"]) assert.equal(readSession(junk, SECRET, now), null);
});

test("deneme sınırı: 5. hatada kilitlenir, süre dolunca açılır", () => {
  resetLimits();
  const t = 5_000_000;
  for (let i = 0; i < 4; i++) recordFail("ip:1.2.3.4", 5, t + i);
  assert.equal(lockedFor("ip:1.2.3.4", t + 10), 0);
  recordFail("ip:1.2.3.4", 5, t + 5);
  assert.ok(lockedFor("ip:1.2.3.4", t + 10) > 0);
  assert.equal(lockedFor("ip:9.9.9.9", t + 10), 0, "başka IP etkilenmez");
  assert.equal(lockedFor("ip:1.2.3.4", t + 16 * 60 * 1000), 0, "15 dk sonra açılır");
});

test("ortam değişkenleri eksik ya da zayıfsa giriş kapalı kalır", () => {
  assert.equal(readConfig({}), null);
  assert.equal(readConfig({ LUME_USER: "umut", LUME_PASS_HASH: "scrypt:a:b", SESSION_SECRET: "kisa" }), null);
  assert.ok(readConfig({ LUME_USER: "umut", LUME_PASS_HASH: "scrypt:a:b", SESSION_SECRET: SECRET }));
});
