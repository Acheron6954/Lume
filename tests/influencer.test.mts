import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_PLACEHOLDER,
  DEFAULT_MAIL,
  DEFAULT_THRESHOLDS,
  fillTemplate,
  fmtCount,
  fmtPct,
  fmtRate,
  rowToInfluencer,
  needsContact,
  warningsOf,
} from "../lib/influencer.ts";
import { FIXTURE as SAMPLE_INFLUENCERS } from "./fixtures.mts";

test("sayı biçimi Türkçe: 8,2 B / 126 B / 1,3 Mn / 950", () => {
  assert.equal(fmtCount(8200), "8,2 B");
  assert.equal(fmtCount(10000), "10 B");
  assert.equal(fmtCount(126000), "126 B");
  assert.equal(fmtCount(1_250_000), "1,3 Mn");
  assert.equal(fmtCount(950), "950");
  assert.equal(fmtPct(0.444), "%44");
  assert.equal(fmtRate(0.0176), "%1,8");
  assert.equal(fmtRate(0.13), "%13");
});

test("uyarılar: 10 B altı takipçi, %1 altı etkileşim, doğrulanamayan hesap", () => {
  const w = (id: string) => warningsOf(SAMPLE_INFLUENCERS.find((i) => i.id === id)!, DEFAULT_THRESHOLDS);
  assert.deepEqual(w("t-01"), []);
  assert.deepEqual(w("t-02"), []);
  assert.deepEqual(w("t-03"), ["low-followers"]);
  assert.deepEqual(w("t-04"), ["low-engagement"]);
  assert.deepEqual(w("t-05"), ["unverified"]);
  assert.deepEqual(w("t-06"), []); // oran hesaplanamadıysa uyarılmaz
  assert.equal(SAMPLE_INFLUENCERS.filter((i) => warningsOf(i, DEFAULT_THRESHOLDS).length > 0).length, 3);
});

test("eşikte tam değer uyarılmaz; etkileşim kontrolü kapatılabilir", () => {
  const base = SAMPLE_INFLUENCERS[0];
  assert.deepEqual(warningsOf({ ...base, followers: 10000, engagement: 0.01 }, DEFAULT_THRESHOLDS), []);
  assert.deepEqual(warningsOf({ ...base, followers: 0, engagement: 0 }, DEFAULT_THRESHOLDS), ["low-followers", "low-engagement"]);
  assert.deepEqual(warningsOf({ ...base, engagement: 0.0001 }, { ...DEFAULT_THRESHOLDS, minEngagement: 0 }), []);
});

test("tablo satırı → influencer: az gönderide oran yok, doğrulanamayan hesapta veri yok", () => {
  const row = {
    id: "u1", name: null, niche: null, instagram: "ornek.hesap", email: " a@b.co ", followers: 20_000,
    engagement_rate: "2.5", avg_likes: 480, avg_comments: 20, posts_analyzed: 12, scan_status: "ok",
    last_scanned_at: "2026-10-16T14:00:00Z", found_at: "2026-10-16T10:00:00Z",
  };
  const i = rowToInfluencer(row);
  assert.equal(i.name, "ornek.hesap"); // ad yoksa kullanıcı adı
  assert.equal(i.handle, "ornek.hesap");
  assert.equal(i.engagement, 0.025);
  assert.equal(i.email, "a@b.co");
  assert.equal(i.verified, true);
  assert.equal(rowToInfluencer({ ...row, posts_analyzed: 2 }).engagement, null);
  const bad = rowToInfluencer({ ...row, scan_status: "not_business" });
  assert.deepEqual([bad.verified, bad.engagement, bad.avgLikes], [false, null, 0]);
  const empty = rowToInfluencer({ ...row, followers: null, engagement_rate: null, found_at: null, email: null });
  assert.deepEqual([empty.followers, empty.engagement, empty.email], [0, null, undefined]);
});

test("şablon: tüm alanlar dolar, boş iletişim işaretlenir", () => {
  const i = SAMPLE_INFLUENCERS[0];
  const empty = fillTemplate(DEFAULT_MAIL.template, i, DEFAULT_MAIL);
  assert.ok(empty.includes("Merhaba Cilt Günlüğü,"));
  assert.ok(empty.includes("%30 komisyon"));
  assert.ok(empty.includes("cilt bakımı içeriklerini"));
  assert.ok(needsContact(empty) && empty.includes(CONTACT_PLACEHOLDER));
  assert.ok(!/\{[a-z]+\}/.test(empty), "doldurulmamış alan kalmamalı");
  const set = fillTemplate(DEFAULT_MAIL.template, i, { ...DEFAULT_MAIL, contact: "merhaba@lume1.com.tr", commission: 25 });
  assert.ok(set.includes("merhaba@lume1.com.tr") && set.includes("%25 komisyon") && !needsContact(set));
});

test("şablon: $ gibi özel karakterler bozulmaz, bilinmeyen alan olduğu gibi kalır", () => {
  const i = { ...SAMPLE_INFLUENCERS[0], name: "A$&B" };
  assert.ok(fillTemplate("Selam {isim} {bilinmeyen}", i, DEFAULT_MAIL).includes("Selam A$&B {bilinmeyen}"));
});

test("e-posta denetimi", async () => {
  const { isEmail } = await import("../lib/influencer.ts");
  for (const ok of ["a@b.co", " ayse@example.com ", "a.b+c@mail.example.com.tr"]) assert.equal(isEmail(ok), true, ok);
  for (const bad of ["", "a@", "@b.co", "a@b", "a b@c.de", "a@@b.co", "a@b..co", "a@.co"]) assert.equal(isEmail(bad), false, bad);
});
