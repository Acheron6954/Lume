import test from "node:test";
import assert from "node:assert/strict";
import { awaiting, daysSince, findReply, isAutomatic, isBounce, senderAddress, summarize, type GmailMessage } from "../lib/replies";

const ME = "ben@gmail.com";
const T0 = Date.parse("2026-11-01T10:00:00Z");
const msg = (o: { id: string; from: string; at: number; labels?: string[]; extra?: Record<string, string>; snippet?: string; subject?: string }): GmailMessage => ({
  id: o.id,
  labelIds: o.labels ?? ["INBOX"],
  internalDate: String(o.at),
  snippet: o.snippet ?? "",
  payload: { headers: [{ name: "From", value: o.from }, { name: "Subject", value: o.subject ?? "Re: Konu" }, ...Object.entries(o.extra ?? {}).map(([name, value]) => ({ name, value }))] },
});

test("senderAddress adı ayıklar, küçük harfe çevirir", () => {
  assert.equal(senderAddress('"Ayşe Y." <Ayse@Mail.COM>'), "ayse@mail.com");
  assert.equal(senderAddress("ayse@mail.com"), "ayse@mail.com");
  assert.equal(senderAddress("adres yok"), "");
});

test("gerçek yanıt bulunur; kendi gönderimimiz yanıt sayılmaz", () => {
  const th = { id: "t", messages: [msg({ id: "1", from: ME, at: T0, labels: ["SENT"] }), msg({ id: "2", from: "Ayşe <ayse@x.com>", at: T0 + 3_600_000, snippet: "Merhaba, ilgilenirim", subject: "Re: İş birliği" })] };
  const v = findReply(th, ME, T0);
  assert.equal(v.bounced, false);
  assert.equal(v.reply?.messageId, "2");
  assert.equal(v.reply?.from, "ayse@x.com");
  assert.equal(v.reply?.snippet, "Merhaba, ilgilenirim");
  assert.equal(v.reply?.subject, "Re: İş birliği");
  assert.equal(v.reply?.at, new Date(T0 + 3_600_000).toISOString());
});

test("yalnızca bizim mailimizin olduğu konuşmada yanıt yok", () => {
  assert.deepEqual(findReply({ id: "t", messages: [msg({ id: "1", from: ME, at: T0, labels: ["SENT"] })] }, ME, T0), { reply: null, bounced: false });
  assert.deepEqual(findReply({ id: "t" }, ME, T0), { reply: null, bounced: false });
});

test("gönderimden önceki mesaj ve kendi adresimizden gelen yanıt sayılmaz", () => {
  const old = msg({ id: "0", from: "ayse@x.com", at: T0 - 1000 });
  const self = msg({ id: "9", from: ME, at: T0 + 1000 });
  assert.equal(findReply({ id: "t", messages: [old, self] }, ME, T0).reply, null);
});

test("otomatik yanıtlar yanıt sayılmaz", () => {
  const ooo = msg({ id: "2", from: "ayse@x.com", at: T0 + 1000, extra: { "Auto-Submitted": "auto-replied" } });
  const bulk = msg({ id: "3", from: "ayse@x.com", at: T0 + 2000, extra: { Precedence: "bulk" } });
  const ar = msg({ id: "4", from: "ayse@x.com", at: T0 + 3000, extra: { "X-Autoreply": "yes" } });
  const no = msg({ id: "5", from: "ayse@x.com", at: T0 + 4000, extra: { "Auto-Submitted": "no" } });
  assert.equal(isAutomatic(ooo), true);
  assert.equal(isAutomatic(bulk), true);
  assert.equal(isAutomatic(ar), true);
  assert.equal(isAutomatic(no), false);
  assert.equal(findReply({ id: "t", messages: [ooo, bulk, ar] }, ME, T0).reply, null);
  // Otomatik yanıttan sonra gelen insan yanıtı bulunur
  assert.equal(findReply({ id: "t", messages: [ooo, no] }, ME, T0).reply?.messageId, "5");
});

test("ulaşmadı bildirimi (bounce) yanıt değil, bounced olarak işaretlenir", () => {
  const b = msg({ id: "2", from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>", at: T0 + 1000 });
  assert.equal(isBounce(b), true);
  assert.deepEqual(findReply({ id: "t", messages: [b] }, ME, T0), { reply: null, bounced: true });
  // Sonradan insan yanıtı geldiyse bounced değil, yanıt öncelikli
  const r = msg({ id: "3", from: "ayse@x.com", at: T0 + 2000 });
  const v = findReply({ id: "t", messages: [b, r] }, ME, T0);
  assert.equal(v.bounced, false);
  assert.equal(v.reply?.messageId, "3");
});

test("snippet ve konu uzunluğu sınırlanır", () => {
  const long = msg({ id: "2", from: "ayse@x.com", at: T0 + 1000, snippet: "a".repeat(2000), subject: "b".repeat(500) });
  const r = findReply({ id: "t", messages: [long] }, ME, T0).reply!;
  assert.equal(r.snippet.length, 500);
  assert.equal(r.subject.length, 200);
});

test("summarize: hesap başına son mail, ilk yanıt, bounce", () => {
  const sent = [
    { influencer_id: "a", sent_at: "2026-11-01T10:00:00Z" },
    { influencer_id: "a", sent_at: "2026-11-05T10:00:00Z" }, // tekrar iletişim, en son bu
    { influencer_id: "b", sent_at: "2026-11-02T10:00:00Z", bounced_at: "2026-11-02T10:05:00Z" },
    { influencer_id: null, sent_at: "2026-11-03T10:00:00Z" },
  ];
  const inbound = [
    { influencer_id: "a", sent_at: "2026-11-03T10:00:00Z" }, // eski maile yanıt: son maile yanıt sayılmaz
    { influencer_id: "c", sent_at: "2026-11-04T10:00:00Z" }, // gönderimi olmayan hesap
  ];
  const s = summarize(sent, inbound);
  assert.equal(s.length, 2);
  const a = s.find((x) => x.influencerId === "a")!;
  assert.equal(a.sentAt, "2026-11-05T10:00:00Z");
  assert.equal(a.repliedAt, null);
  assert.equal(s.find((x) => x.influencerId === "b")!.bouncedAt, "2026-11-02T10:05:00Z");
  // Son mailden sonra yanıt gelirse yanıtlı sayılır
  const s2 = summarize(sent, [{ influencer_id: "a", sent_at: "2026-11-06T10:00:00Z" }]);
  assert.equal(s2.find((x) => x.influencerId === "a")!.repliedAt, "2026-11-06T10:00:00Z");
});

test("awaiting: 7 gün dolmamış, yanıtlı ve ulaşmayanlar dışarıda", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const rows = [
    { influencerId: "eski", sentAt: "2026-11-01T10:00:00Z", repliedAt: null, bouncedAt: null }, // 8 gün
    { influencerId: "tam", sentAt: "2026-11-02T12:00:00Z", repliedAt: null, bouncedAt: null }, // tam 7 gün: dahil
    { influencerId: "yeni", sentAt: "2026-11-05T10:00:00Z", repliedAt: null, bouncedAt: null }, // 4 gün
    { influencerId: "yanit", sentAt: "2026-10-20T10:00:00Z", repliedAt: "2026-10-21T10:00:00Z", bouncedAt: null },
    { influencerId: "bounce", sentAt: "2026-10-20T10:00:00Z", repliedAt: null, bouncedAt: "2026-10-20T10:01:00Z" },
  ];
  assert.deepEqual(awaiting(rows, now).map((r) => r.influencerId), ["eski", "tam"]);
  assert.deepEqual(awaiting(rows, now, 3).map((r) => r.influencerId), ["eski", "tam", "yeni"]);
  assert.equal(daysSince("2026-11-01T10:00:00Z", now), 8);
  assert.equal(daysSince("2027-01-01T00:00:00Z", now), 0);
});
