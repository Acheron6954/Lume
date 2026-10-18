import test from "node:test";
import assert from "node:assert/strict";
import { dmDraft, dmHandle, dmReduce, dmStatus, dmUrl, initialDm, sanitizeDm, type DmState } from "../lib/dm-state";
import { DEFAULT_MAIL } from "../lib/influencer";

const start = (): DmState => dmReduce(initialDm, { type: "add", items: [{ influencerId: "a", channel: "instagram", text: "Merhaba" }] });

test("dmHandle ve dmUrl", () => {
  assert.equal(dmHandle({ handle: "ayse", tiktok: "ayse.tt" }, "tiktok"), "ayse.tt");
  assert.equal(dmHandle({ handle: "ayse" }, "tiktok"), undefined);
  assert.equal(dmUrl("ayse", "instagram"), "https://ig.me/m/ayse");
  assert.equal(dmUrl("ayse.tt", "tiktok"), "https://www.tiktok.com/@ayse.tt");
});

test("dmDraft şablonu doldurur", () => {
  const t = dmDraft("Merhaba {isim}, %{komisyon}", { name: "Ayşe", niche: "", handle: "ayse" }, DEFAULT_MAIL);
  assert.equal(t, "Merhaba Ayşe, %30");
});

test("aynı hesap+kanal ikinci kez eklenmez", () => {
  const s = dmReduce(start(), { type: "add", items: [{ influencerId: "a", channel: "instagram", text: "x" }, { influencerId: "a", channel: "tiktok", text: "y" }] });
  assert.equal(s.items.length, 2);
});

test("onaylanmamış DM 'gönderdim' olamaz", () => {
  const s = dmReduce(start(), { type: "markSent", id: "a:instagram", at: new Date().toISOString() });
  assert.equal(s.items[0].sentAt, undefined);
});

test("onay → gönderildi → yanıt akışı ve durumlar", () => {
  let s = dmReduce(start(), { type: "toggleApprove", id: "a:instagram" });
  assert.equal(dmStatus(s.items[0]), "onayli");
  s = dmReduce(s, { type: "markSent", id: "a:instagram", at: "2026-10-18T10:00:00Z" });
  assert.equal(dmStatus(s.items[0]), "gonderildi");
  s = dmReduce(s, { type: "markReplied", id: "a:instagram", at: "2026-10-19T10:00:00Z" });
  assert.equal(dmStatus(s.items[0]), "yanit");
  s = dmReduce(s, { type: "unmarkSent", id: "a:instagram" });
  assert.equal(s.items[0].repliedAt, undefined);
  assert.equal(dmStatus(s.items[0]), "onayli");
});

test("metin değişince onay düşer; gönderilmiş metin kilitli", () => {
  let s = dmReduce(start(), { type: "toggleApprove", id: "a:instagram" });
  s = dmReduce(s, { type: "edit", id: "a:instagram", text: "Yeni" });
  assert.equal(s.items[0].approved, false);
  s = dmReduce(s, { type: "toggleApprove", id: "a:instagram" });
  s = dmReduce(s, { type: "markSent", id: "a:instagram", at: "2026-10-18T10:00:00Z" });
  s = dmReduce(s, { type: "edit", id: "a:instagram", text: "Değişmesin" });
  assert.equal(s.items[0].text, "Yeni");
});

test("yanıt, gönderilmemiş DM'e işaretlenemez; boş metin onaylanamaz", () => {
  let s = dmReduce(start(), { type: "markReplied", id: "a:instagram", at: "2026-10-18T10:00:00Z" });
  assert.equal(s.items[0].repliedAt, undefined);
  s = dmReduce(s, { type: "edit", id: "a:instagram", text: "  " });
  s = dmReduce(s, { type: "toggleApprove", id: "a:instagram" });
  assert.equal(s.items[0].approved, false);
});

test("sanitizeDm bozuk kaydı temizler", () => {
  const raw = {
    template: "",
    items: [
      { influencerId: "a", channel: "instagram", text: "ok", approved: true, sentAt: "2026-10-18T10:00:00Z", repliedAt: "bozuk" },
      { influencerId: "a", channel: "instagram", text: "kopya" },
      { influencerId: "yok", channel: "instagram", text: "bilinmeyen" },
      { influencerId: "a", channel: "sms", text: "kanal" },
      null,
    ],
  };
  const s = sanitizeDm(raw, new Set(["a"]));
  assert.equal(s.ready, true);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].repliedAt, undefined);
  assert.ok(s.template.length > 10);
  assert.deepEqual(sanitizeDm("çöp", new Set()).items, []);
});
