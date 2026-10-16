import test from "node:test";
import assert from "node:assert/strict";
import { USERNAME_RE, classifyError, emailFromBio, engagementOf, parseDiscovery } from "../lib/instagram.ts";

test("kullanıcı adı doğrulama: sorguya zarar verecek karakterler geçmez", () => {
  assert.ok(USERNAME_RE.test("aysegul.nart_1"));
  for (const bad of ["", "a b", "x)", "a{b", "x".repeat(31), "a/b", "a,b", "ü"]) assert.equal(USERNAME_RE.test(bad), false, bad);
});

test("hata sınıflama", () => {
  assert.equal(classifyError({ code: 190 }), "token");
  assert.equal(classifyError({ code: 4 }), "rate");
  assert.equal(classifyError({ code: 613 }), "rate");
  assert.equal(classifyError({ code: 110, message: "Invalid user id" }), "not_found");
  assert.equal(classifyError({ code: 100, error_subcode: 2207013 }), "not_found");
  assert.equal(classifyError({ code: 10, message: "(#10) Application does not have permission" }), "error");
});

test("yanıt ayrıştırma + etkileşim oranı", () => {
  const p = parseDiscovery({
    business_discovery: {
      username: "x",
      name: "X",
      biography: "iş birliği: Merhaba@Ornek.com",
      followers_count: 10_000,
      media_count: 50,
      media: { data: [{ like_count: 300, comments_count: 20, timestamp: "t" }, { like_count: 100, comments_count: 10, timestamp: "t" }, { comments_count: 5, timestamp: "t" }] },
    },
  });
  assert.ok(p);
  assert.equal(p.followers, 10_000);
  const e = engagementOf(p);
  assert.equal(e.posts, 2); // beğenisi gizli gönderi sayılmaz
  assert.equal(e.avgLikes, 200);
  assert.equal(e.avgComments, 15);
  assert.equal(e.ratePct, 2.15);
  assert.equal(emailFromBio(p.biography), "merhaba@ornek.com");
});

test("boş/bozuk veri güvenli", () => {
  assert.equal(parseDiscovery({}), null);
  assert.equal(parseDiscovery(null), null);
  const e = engagementOf({ followers: 0, posts: [] });
  assert.equal(e.ratePct, null);
  assert.equal(emailFromBio("mail yok"), null);
});
