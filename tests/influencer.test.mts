import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_PLACEHOLDER,
  DEFAULT_MAIL,
  DEFAULT_THRESHOLDS,
  fillTemplate,
  fmtCount,
  fmtPct,
  needsContact,
  viewRatio,
  warningsOf,
} from "../lib/influencer.ts";
import { SAMPLE_INFLUENCERS } from "../lib/sample-data.ts";

test("sayı biçimi Türkçe: 8,2 B / 126 B / 1,3 Mn / 950", () => {
  assert.equal(fmtCount(8200), "8,2 B");
  assert.equal(fmtCount(10000), "10 B");
  assert.equal(fmtCount(126000), "126 B");
  assert.equal(fmtCount(1_250_000), "1,3 Mn");
  assert.equal(fmtCount(950), "950");
  assert.equal(fmtPct(0.444), "%44");
});

test("uyarılar: 10 B altı takipçi ve %10 altı izlenme oranı", () => {
  const w = (id: string) => warningsOf(SAMPLE_INFLUENCERS.find((i) => i.id === id)!, DEFAULT_THRESHOLDS);
  assert.deepEqual(w("ornek-01"), []);
  assert.deepEqual(w("ornek-04"), ["low-followers"]); // 9,4 B, oran %33
  assert.deepEqual(w("ornek-05"), ["low-ratio"]); // 71 B, oran %6
  assert.deepEqual(w("ornek-07"), ["low-ratio"]); // 15,6 B, oran %8
  assert.deepEqual(w("ornek-10"), ["low-followers"]); // 7,8 B, oran %63
  const flagged = SAMPLE_INFLUENCERS.filter((i) => warningsOf(i, DEFAULT_THRESHOLDS).length > 0);
  assert.equal(flagged.length, 4);
});

test("eşikte tam değer uyarılmaz, sıfır takipçi çökertmez", () => {
  const base = SAMPLE_INFLUENCERS[0];
  assert.deepEqual(warningsOf({ ...base, followers: 10000, avgViews: 1000 }, DEFAULT_THRESHOLDS), []);
  assert.equal(viewRatio({ followers: 0, avgViews: 50 }), 0);
  assert.deepEqual(warningsOf({ ...base, followers: 0, avgViews: 0 }, DEFAULT_THRESHOLDS), ["low-followers", "low-ratio"]);
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

test("örnek veri: tüm hesaplar ÖRNEK işaretli, id'ler benzersiz", () => {
  assert.ok(SAMPLE_INFLUENCERS.every((i) => i.example && i.handle.startsWith("ornek.")));
  assert.equal(new Set(SAMPLE_INFLUENCERS.map((i) => i.id)).size, SAMPLE_INFLUENCERS.length);
  assert.ok(SAMPLE_INFLUENCERS.every((i) => !i.email || i.email.endsWith("@example.com")));
});

test("e-posta denetimi", async () => {
  const { isEmail } = await import("../lib/influencer.ts");
  for (const ok of ["a@b.co", " ayse@example.com ", "a.b+c@mail.example.com.tr"]) assert.equal(isEmail(ok), true, ok);
  for (const bad of ["", "a@", "@b.co", "a@b", "a b@c.de", "a@@b.co", "a@b..co", "a@.co"]) assert.equal(isEmail(bad), false, bad);
});
