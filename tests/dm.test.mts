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

/* ---------- Sunucuya kaydetme ---------- */
import { dmDiff, itemToRow, parseDmPatch, rowToItem } from "../lib/dm-state";

const UID = "123e4567-e89b-12d3-a456-426614174000";
const item = (o: Partial<import("../lib/dm-state").DmItem> = {}) => ({ id: `${UID}:instagram`, influencerId: UID, channel: "instagram" as const, text: "Merhaba", approved: false, note: "", ...o });

test("dmDiff: yeni, değişen ve silinen", () => {
  const a = item();
  const b = item({ id: `${UID}:tiktok`, channel: "tiktok" });
  assert.deepEqual(dmDiff([], [a]), { upsert: [a], remove: [] });
  assert.deepEqual(dmDiff([a], [a]), { upsert: [], remove: [] });
  assert.deepEqual(dmDiff([a], [{ ...a, approved: true }]).upsert.map((x) => x.approved), [true]);
  assert.deepEqual(dmDiff([a, b], [b]), { upsert: [], remove: [a.id] });
  // alan sırası ya da tanımsız alanlar sahte fark üretmez
  assert.deepEqual(dmDiff([a], [{ ...a, sentAt: undefined }]), { upsert: [], remove: [] });
});

test("parseDmPatch: geçerli yama ve normalizasyon", () => {
  const p = parseDmPatch({ upsert: [{ ...item(), sentAt: "2026-11-01T10:00:00Z", repliedAt: "2026-11-02T10:00:00Z" }], remove: [`${UID.toUpperCase()}:tiktok`], template: "Şablon {isim}" });
  assert.ok(p);
  assert.equal(p!.upsert[0].approved, true); // gönderilmiş DM onaylı sayılır
  assert.equal(p!.upsert[0].repliedAt, "2026-11-02T10:00:00Z");
  assert.deepEqual(p!.remove, [`${UID}:tiktok`]);
  assert.equal(p!.template, "Şablon {isim}");
  assert.deepEqual(parseDmPatch({}), { upsert: [], remove: [] });
  // gönderilmemiş DM'de yanıt tarihi atılır
  assert.equal(parseDmPatch({ upsert: [{ ...item(), repliedAt: "2026-11-02T10:00:00Z" }] })!.upsert[0].repliedAt, undefined);
});

test("parseDmPatch: bozuk girdiyi tamamen reddeder", () => {
  assert.equal(parseDmPatch(null), null);
  assert.equal(parseDmPatch("x"), null);
  assert.equal(parseDmPatch({ upsert: "x" }), null);
  assert.equal(parseDmPatch({ upsert: [{ ...item(), id: "kötü" }] }), null);
  assert.equal(parseDmPatch({ upsert: [{ ...item(), channel: "mail" }] }), null);
  assert.equal(parseDmPatch({ upsert: [{ ...item(), influencerId: "baska" }] }), null); // id ile uyuşmuyor
  assert.equal(parseDmPatch({ upsert: [{ ...item(), text: "x".repeat(1001) }] }), null);
  assert.equal(parseDmPatch({ upsert: [{ ...item(), note: "x".repeat(201) }] }), null);
  assert.equal(parseDmPatch({ upsert: [{ ...item(), sentAt: "tarih değil" }] }), null);
  assert.equal(parseDmPatch({ upsert: [item(), item()] }), null); // aynı kayıt iki kez
  assert.equal(parseDmPatch({ remove: ["x'; drop table dm_items;--"] }), null);
  assert.equal(parseDmPatch({ template: "   " }), null);
  assert.equal(parseDmPatch({ upsert: Array.from({ length: 501 }, (_, i) => item({ id: `${UID.slice(0, -3)}${String(i).padStart(3, "0")}:instagram` })) }), null);
});

test("itemToRow ve rowToItem gidiş-dönüş", () => {
  const a = item({ approved: true, sentAt: "2026-11-01T10:00:00.000Z", note: "not" });
  const row = itemToRow(a);
  assert.equal(row.influencer_id, UID);
  assert.equal(row.sent_at, "2026-11-01T10:00:00.000Z");
  assert.equal(row.replied_at, null);
  assert.deepEqual(rowToItem(row), { ...a, repliedAt: undefined });
  assert.deepEqual(rowToItem({ id: a.id, influencer_id: UID, channel: "tiktok", text: null, approved: null, sent_at: null, replied_at: null, note: null }), { id: a.id, influencerId: UID, channel: "tiktok", text: "", approved: false, sentAt: undefined, repliedAt: undefined, note: "" });
});
