import test from "node:test";
import assert from "node:assert/strict";
import { approvedCount, draftBody, initialState, reduce, sanitize, type Action, type PanelState } from "../lib/panel-state.ts";
import { FIXTURE as SAMPLE_INFLUENCERS } from "./fixtures.mts";

const known = new Set(SAMPLE_INFLUENCERS.map((i) => i.id));
const run = (s: PanelState, ...as: Action[]) => as.reduce((st, a) => reduce(st, a, known), s);

test("seçim: bilinmeyen ve çıkarılmış hesaplar seçilemez", () => {
  let s = run(initialState, { type: "exclude", ids: ["t-04"] });
  s = run(s, { type: "select", ids: ["t-01", "t-04", "yok-id"] });
  assert.deepEqual(s.selected, ["t-01"]);
  s = run(s, { type: "toggleSelect", id: "t-04" });
  assert.deepEqual(s.selected, ["t-01"]);
});

test("çıkarma: seçimden ve onaydan da düşer, geri alınabilir", () => {
  let s = run(initialState, { type: "select", ids: ["t-01", "t-02"] }, { type: "toggleApprove", id: "t-01" });
  assert.deepEqual(s.approved, ["t-01"]);
  s = run(s, { type: "exclude", ids: ["t-01"] });
  assert.deepEqual(s.selected, ["t-02"]);
  assert.deepEqual(s.approved, []);
  s = run(s, { type: "restore", id: "t-01" });
  assert.deepEqual(s.excluded, []);
});

test("onay: yalnızca seçili hesap onaylanır; metin düzenlenirse onay kalkar", () => {
  let s = run(initialState, { type: "toggleApprove", id: "t-01" });
  assert.deepEqual(s.approved, []);
  s = run(s, { type: "select", ids: ["t-01"] }, { type: "toggleApprove", id: "t-01" });
  assert.deepEqual(s.approved, ["t-01"]);
  s = run(s, { type: "edit", id: "t-01", text: "Merhaba!" });
  assert.deepEqual(s.approved, []);
  assert.equal(draftBody(s, SAMPLE_INFLUENCERS[0]), "Merhaba!");
  s = run(s, { type: "edit", id: "t-01", text: null });
  assert.ok(draftBody(s, SAMPLE_INFLUENCERS[0]).startsWith("Merhaba Cilt Günlüğü"));
});

test("şablon veya ayar değişince tüm onaylar sıfırlanır, komisyon 0-100 aralığına çekilir", () => {
  let s = run(initialState, { type: "select", ids: ["t-01"] }, { type: "toggleApprove", id: "t-01" });
  s = run(s, { type: "mail", value: { contact: "merhaba@lume1.com.tr", commission: 400 } });
  assert.deepEqual(s.approved, []);
  assert.equal(s.mail.commission, 100);
  assert.ok(draftBody(s, SAMPLE_INFLUENCERS[0]).includes("merhaba@lume1.com.tr"));
});

test("eşikler sınırlanır", () => {
  const s = run(initialState, { type: "thresholds", value: { minFollowers: -5, minEngagement: 9 } });
  assert.equal(s.thresholds.minFollowers, 0);
  assert.equal(s.thresholds.minEngagement, 0.6);
  assert.equal(run(initialState, { type: "thresholds", value: { minFollowers: NaN } }).thresholds.minFollowers, 10000);
});

test("localStorage'dan gelen bozuk veri güvenli şekilde temizlenir", () => {
  assert.deepEqual(sanitize(null, known), initialState);
  assert.deepEqual(sanitize("x", known), initialState);
  const s = sanitize(
    {
      excluded: ["t-04", 5, "yok"],
      selected: ["t-04", "t-01"],
      approved: ["t-02", "t-01"],
      edits: { "t-01": "x".repeat(9000), yok: "a", "t-02": 3 },
      thresholds: { minFollowers: "çok", minEngagement: -1 },
      mail: { brand: 5, commission: "30", contact: "a@b.c" },
    },
    known,
  );
  assert.deepEqual(s.excluded, ["t-04"]);
  assert.deepEqual(s.selected, ["t-01"]);
  assert.deepEqual(s.approved, ["t-01"]);
  assert.equal(s.edits["t-01"].length, 5000);
  assert.deepEqual(Object.keys(s.edits), ["t-01"]);
  assert.equal(s.thresholds.minFollowers, 10000);
  assert.equal(s.thresholds.minEngagement, 0);
  assert.equal(s.mail.brand, "Lume");
  assert.equal(s.mail.commission, 30);
  assert.equal(s.mail.contact, "a@b.c");
});

test("elle mail: geçersiz adres eklenmez, geçerli eklenir, düzenleyince onay kalkar", () => {
  const f = { name: "Ayşe", email: "ayse@example.com", subject: "Merhaba", body: "Metin" };
  let s = run(initialState, { type: "addManual", id: "m1", fields: { ...f, email: "ayse@" } });
  assert.equal(s.manual.length, 0);
  s = run(s, { type: "addManual", id: "m1", fields: { ...f, name: "  " } });
  assert.equal(s.manual.length, 0);
  s = run(s, { type: "addManual", id: "m1", fields: f }, { type: "addManual", id: "m1", fields: f });
  assert.equal(s.manual.length, 1); // aynı id iki kez eklenmez
  s = run(s, { type: "toggleApproveManual", id: "m1" });
  assert.equal(s.manual[0].approved, true);
  assert.equal(approvedCount(s), 1);
  s = run(s, { type: "editManual", id: "m1", patch: { body: "Yeni metin" } });
  assert.equal(s.manual[0].approved, false);
  assert.equal(s.manual[0].body, "Yeni metin");
});

test("elle mail: eksik alanla onaylanamaz; onay şablon değişikliğinden etkilenmez; silinebilir", () => {
  const f = { name: "Ayşe", email: "ayse@example.com", subject: "Konu", body: "Metin" };
  let s = run(initialState, { type: "addManual", id: "m1", fields: f }, { type: "editManual", id: "m1", patch: { email: "bozuk" } });
  s = run(s, { type: "toggleApproveManual", id: "m1" });
  assert.equal(s.manual[0].approved, false);
  s = run(s, { type: "editManual", id: "m1", patch: { email: "ayse@example.com" } }, { type: "toggleApproveManual", id: "m1" });
  assert.equal(s.manual[0].approved, true);
  s = run(s, { type: "mail", value: { brand: "Başka" } });
  assert.equal(s.manual[0].approved, true);
  s = run(s, { type: "removeManual", id: "m1" });
  assert.equal(s.manual.length, 0);
});

test("elle mail: uzun alanlar kırpılır", () => {
  const long = "x".repeat(6000);
  const s = run(initialState, { type: "addManual", id: "m1", fields: { name: "A".repeat(200), email: "a@b.co", subject: long, body: long } });
  assert.equal(s.manual[0].name.length, 80);
  assert.equal(s.manual[0].subject.length, 200);
  assert.equal(s.manual[0].body.length, 5000);
});

test("tekrar iletişim: bilinmeyen/çıkarılmış/yinelenen eklenmez, çıkarılınca listeden düşer", () => {
  const at = "2026-10-16T10:00:00Z";
  let s = run(initialState,
    { type: "addRecontact", id: "yok", note: "", at },
    { type: "addRecontact", id: "t-01", note: " yanıt vermedi ", at },
    { type: "addRecontact", id: "t-01", note: "ikinci", at },
    { type: "addRecontact", id: "t-02", note: "", at: "geçersiz-tarih" });
  assert.deepEqual(s.recontact, [{ id: "t-01", note: "yanıt vermedi", at }]);
  s = run(s, { type: "noteRecontact", id: "t-01", note: "yeni not" });
  assert.equal(s.recontact[0].note, "yeni not");
  s = run(s, { type: "exclude", ids: ["t-01"] });
  assert.deepEqual(s.recontact, []);
  s = run(s, { type: "addRecontact", id: "t-01", note: "", at });
  assert.deepEqual(s.recontact, []); // çıkarılmış hesap eklenemez
  s = run(initialState, { type: "addRecontact", id: "t-02", note: "", at }, { type: "removeRecontact", id: "t-02" });
  assert.deepEqual(s.recontact, []);
});

test("sanitize: eski kayıtta yeni alanlar yoksa boş gelir; bozuk elle mail ve tekrar iletişim temizlenir", () => {
  const old = sanitize({ excluded: [], selected: ["t-01"], approved: [] }, known);
  assert.deepEqual(old.manual, []);
  assert.deepEqual(old.recontact, []);
  const s = sanitize({
    manual: [
      { id: "m1", name: "Ayşe", email: "ayse@example.com", subject: "K", body: "B", approved: true },
      { id: "m1", name: "Kopya", email: "k@example.com", subject: "K", body: "B" },
      { id: "m2", name: "Yarım", email: "ab", subject: "K", body: "B", approved: true },
      { id: 5, name: "x" }, "çöp", null,
    ],
    recontact: [
      { id: "t-02", note: "n", at: "2026-10-16T10:00:00Z" },
      { id: "t-02", note: "kopya", at: "2026-10-16T10:00:00Z" },
      { id: "yok", note: "", at: "2026-10-16T10:00:00Z" },
      { id: "t-03", note: "", at: "bozuk" },
    ],
  }, known);
  assert.deepEqual(s.manual.map((m) => [m.id, m.approved]), [["m1", true], ["m2", false]]);
  assert.deepEqual(s.recontact.map((r) => r.id), ["t-02"]);
});
