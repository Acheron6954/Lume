import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHandle, normalizePhone, parseApplication } from "../lib/application";
import { isMemberLogin, parseRegistration } from "../lib/members";

const good = { instagram: "@Ayse.Yilmaz", tiktok: "", niche: "Makyaj", name: "Ayşe Yılmaz", email: "AYSE@Mail.com", whatsapp: "0532 123 45 67", city: "İzmir", kvkk: true, disclosure: true };

test("normalizeHandle: @, adres ve büyük harf temizlenir; geçersiz null", () => {
  assert.equal(normalizeHandle("@Ayse.Yilmaz"), "ayse.yilmaz");
  assert.equal(normalizeHandle("https://www.instagram.com/ayse_y/?hl=tr"), "ayse_y");
  assert.equal(normalizeHandle("tiktok.com/@ayse"), "ayse");
  assert.equal(normalizeHandle("https://www.tiktok.com/@ayse.y?lang=tr"), "ayse.y");
  assert.equal(normalizeHandle("ayşe"), null);
  assert.equal(normalizeHandle("a b"), null);
  assert.equal(normalizeHandle("x".repeat(31)), null);
  assert.equal(normalizeHandle(""), null);
  assert.equal(normalizeHandle(42), null);
});

test("normalizePhone", () => {
  assert.equal(normalizePhone("0532 123 45 67"), "05321234567");
  assert.equal(normalizePhone("+90 (532) 123-45-67"), "+905321234567");
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("abc"), null);
  assert.equal(normalizePhone(""), null);
});

test("parseApplication: geçerli başvuru temizlenir", () => {
  const r = parseApplication(good);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.instagram, "ayse.yilmaz");
    assert.equal(r.value.tiktok, null);
    assert.equal(r.value.email, "ayse@mail.com");
    assert.equal(r.value.whatsapp, "05321234567");
  }
});

test("parseApplication: en az bir hesap, geçerli alan, onaylar zorunlu", () => {
  const none = parseApplication({ ...good, instagram: "", tiktok: "" });
  assert.ok(!none.ok && none.errors.instagram);
  const onlyTt = parseApplication({ ...good, instagram: "", tiktok: "@ayse" });
  assert.ok(onlyTt.ok);
  const bad = parseApplication({ ...good, niche: "Kumar", email: "x", name: "A", city: "", whatsapp: "12", kvkk: false, disclosure: "true" });
  assert.ok(!bad.ok);
  if (!bad.ok) {
    for (const k of ["niche", "email", "name", "city", "whatsapp", "kvkk", "disclosure"]) assert.ok(bad.errors[k as keyof typeof bad.errors], k);
  }
  const badHandle = parseApplication({ ...good, instagram: "ayşe yılmaz" });
  assert.ok(!badHandle.ok && badHandle.errors.instagram);
});

test("parseApplication: gizli alan dolu ise bot", () => {
  const r = parseApplication({ ...good, website: "http://spam" });
  assert.ok(!r.ok && r.bot);
});

test("parseApplication: uzun metin kırpılır", () => {
  const r = parseApplication({ ...good, name: "A".repeat(500), city: "B".repeat(500) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.name.length, 80);
    assert.equal(r.value.city.length, 60);
  }
});

test("parseRegistration", () => {
  const ok = parseRegistration({ name: " Ali  Veli ", email: "Ali@X.com", password: "0123456789", password2: "0123456789", kvkk: "on" });
  assert.deepEqual(ok, { ok: true, value: { name: "Ali Veli", email: "ali@x.com", password: "0123456789" } });
  assert.ok(!parseRegistration({ name: "Ali", email: "ali@x.com", password: "kisa", password2: "kisa", kvkk: "on" }).ok);
  assert.ok(!parseRegistration({ name: "Ali", email: "ali@x.com", password: "0123456789", password2: "0123456789x", kvkk: "on" }).ok);
  assert.ok(!parseRegistration({ name: "Ali", email: "ali@x.com", password: "0123456789", password2: "0123456789" }).ok);
  assert.ok(!parseRegistration({ name: "Ali", email: "ali", password: "0123456789", password2: "0123456789", kvkk: "on" }).ok);
  const bot = parseRegistration({ name: "Ali", email: "ali@x.com", password: "0123456789", password2: "0123456789", kvkk: "on", website: "x" });
  assert.ok(!bot.ok && bot.bot);
});

test("isMemberLogin: üyeler e-postayla, sahip kullanıcı adıyla girer", () => {
  assert.equal(isMemberLogin("ali@x.com"), true);
  assert.equal(isMemberLogin("umut"), false);
});
