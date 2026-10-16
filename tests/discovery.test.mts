import assert from "node:assert/strict";
import { test } from "node:test";
import { candidatesFrom, handleFromUrl, handlesFromText, pickQueries, QUERY_POOL } from "../lib/discovery";
import { cronAuthorized } from "../lib/auth";

test("profil adresinden kullanıcı adı çıkar, gönderi/reel adreslerini atlar", () => {
  assert.equal(handleFromUrl("https://www.instagram.com/Cilt.Bakim_Ayse/"), "cilt.bakim_ayse");
  assert.equal(handleFromUrl("https://instagram.com/ayse?hl=tr"), "ayse");
  assert.equal(handleFromUrl("https://www.instagram.com/p/Cabc123/"), null);
  assert.equal(handleFromUrl("https://www.instagram.com/reel/Cabc123/"), null);
  assert.equal(handleFromUrl("https://www.instagram.com/explore/tags/makyaj/"), null);
  assert.equal(handleFromUrl("https://example.com/ayse"), null);
});

test("metindeki @kullanıcı adlarını bulur, e-postaları saymaz", () => {
  const found = handlesFromText("Takip et: @ayse.makyaj, @Bakim_Kraliçesi ve info@lume.com.tr, ayrıca instagram.com/zeynep_cilt");
  assert.ok(found.includes("ayse.makyaj"));
  assert.ok(found.includes("zeynep_cilt"));
  assert.ok(!found.some((h) => h.includes("lume")));
  assert.ok(!found.some((h) => h.startsWith("bakim")), "Türkçe harfle bölünen ad yarım alınmaz");
});

test("çok kısa, sadece rakam ve ayrılmış adlar elenir; sondaki nokta atılır", () => {
  assert.deepEqual(handlesFromText("@ab @12345 @instagram @ayse."), ["ayse"]);
});

test("sonuç listesinden benzersiz aday çıkar", () => {
  const out = candidatesFrom([
    { url: "https://www.instagram.com/ayse/", title: "Ayşe", description: "iş birliği @mehmet_g" },
    { url: "https://www.instagram.com/ayse/", description: "tekrar" },
    { url: "https://blog.example.com/liste", description: "En iyiler: @zeynep.k ve @ayse" },
  ]);
  assert.deepEqual([...out].sort(), ["ayse", "mehmet_g", "zeynep.k"]);
});

test("her gün farklı sorgu dilimi seçilir ve havuz içinde döner", () => {
  const a = pickQueries(10, 6);
  const b = pickQueries(11, 6);
  assert.equal(a.length, 6);
  assert.notDeepEqual(a, b);
  assert.ok(a.every((q) => QUERY_POOL.includes(q)));
  assert.equal(new Set(a).size, 6);
});

test("cron yetkisi: yanlış, eksik veya kısa gizli anahtar reddedilir", () => {
  const env = { CRON_SECRET: "x".repeat(32) };
  assert.equal(cronAuthorized(`Bearer ${"x".repeat(32)}`, env), true);
  assert.equal(cronAuthorized(`Bearer ${"y".repeat(32)}`, env), false);
  assert.equal(cronAuthorized(null, env), false);
  assert.equal(cronAuthorized("Bearer short", { CRON_SECRET: "short" }), false);
  assert.equal(cronAuthorized("Bearer undefined", {}), false);
});
