import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emailsFrom,
  fetchPage,
  isPrivateIp,
  isPublicHost,
  parseLink,
  pickTikTok,
  runLinkScan,
  scanLink,
  tiktokHandlesFrom,
  type FetchLike,
  type Resolver,
} from "../lib/linkscan.ts";

const PUBLIC_IP = "93.184.216.34";
const publicResolver: Resolver = async (h) => (h === "internal.evil.example" ? ["10.0.0.5"] : [PUBLIC_IP]);

const html = (body: string, status = 200, type = "text/html; charset=utf-8") => new Response(body, { status, headers: { "content-type": type } });
const redirect = (to: string, status = 302) => new Response(null, { status, headers: { location: to } });

test("özel ve yerel IP adresleri reddedilir", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1",
    "::ffff:7f00:1", "2001:db8::1", "64:ff9b::7f00:1", "yok-boyle-ip",
  ]) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "93.184.216.34", "172.15.0.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test("link ayrıştırma: yalnızca güvenli http(s) adresleri", () => {
  assert.equal(parseLink("linktr.ee/ayse")?.href, "https://linktr.ee/ayse");
  assert.equal(parseLink(" https://beacons.ai/x ")?.hostname, "beacons.ai");
  for (const bad of ["", "ftp://x.com", "file:///etc/passwd", "javascript:alert(1)", "https://user:pw@x.com", "http://x.com:8080/", "mailto:a@b.com", "https://" + "a".repeat(300) + ".com"]) {
    assert.equal(parseLink(bad), null, bad);
  }
});

test("alan adı denetimi: localhost, iç ağ ve özel IP'ye çözülenler reddedilir", async () => {
  assert.equal(await isPublicHost("linktr.ee", publicResolver), true);
  assert.equal(await isPublicHost("8.8.8.8", publicResolver), true);
  for (const h of ["localhost", "printer.local", "db.internal", "intranet", "127.0.0.1", "[::1]", "internal.evil.example", ""]) {
    assert.equal(await isPublicHost(h, publicResolver), false, h);
  }
  assert.equal(await isPublicHost("karisik.example", async () => [PUBLIC_IP, "192.168.0.9"]), false, "bir adres bile özelse reddet");
  assert.equal(await isPublicHost("yok.example", async () => []), false);
  assert.equal(
    await isPublicHost("hata.example", async () => {
      throw new Error("ENOTFOUND");
    }),
    false,
  );
});

test("TikTok adı ayrıştırma", () => {
  assert.deepEqual(tiktokHandlesFrom('<a href="https://www.tiktok.com/@Ayse.Cilt">TikTok</a>'), ["ayse.cilt"]);
  assert.deepEqual(tiktokHandlesFrom('{"url":"https:\\/\\/tiktok.com\\/@glow_lab?lang=tr"}'), ["glow_lab"]);
  assert.deepEqual(tiktokHandlesFrom("https://tiktok.com/%40serum.kulubu"), ["serum.kulubu"]);
  assert.deepEqual(tiktokHandlesFrom("tiktok.com/@a_b ve tiktok.com/@a_b ve tiktok.com/@c.d."), ["a_b", "c.d"]);
  assert.deepEqual(tiktokHandlesFrom("https://tiktok.com/@tiktok"), [], "platformun kendi hesabı sayılmaz");
  assert.deepEqual(tiktokHandlesFrom("tiktok.com/@" + "x".repeat(30)), [], "24 karakterden uzun ad geçersiz");
  assert.deepEqual(tiktokHandlesFrom("tiktok.com/@a"), [], "tek harfli ad geçersiz");
  assert.deepEqual(tiktokHandlesFrom("tiktok.com/video/123, vm.tiktok.com/ZM123/"), []);
});

test("TikTok seçimi: belirsizse yanlış hesaba bağlama", () => {
  assert.equal(pickTikTok([], "x"), null);
  assert.equal(pickTikTok(["tek"], "baska"), "tek");
  assert.equal(pickTikTok(["a", "b"], "B"), "b", "Instagram adıyla eşleşeni seç");
  assert.equal(pickTikTok(["a", "b"], "c"), null, "birden fazla ve eşleşme yok: seçme");
  assert.equal(pickTikTok(["a", "b"], null), null);
});

test("mail ayrıştırma: mailto öncelikli, site ve dosya adresleri elenir", () => {
  const page = `
    <img src="logo@2x.png"> <a href="mailto:Is.Birligi@Ornek.com?subject=Merhaba">yaz</a>
    <p>Destek: support@linktr.ee, hata: abc123@sentry.io, noreply@ornek.com</p>
    <p>PR: pr&#64;ajans.com.tr</p> <p>sahte: foo@bar</p>`;
  assert.deepEqual(emailsFrom(page), ["is.birligi@ornek.com", "pr@ajans.com.tr"]);
  assert.deepEqual(emailsFrom("hiç mail yok"), []);
  assert.deepEqual(emailsFrom("a@b.png"), []);
});

test("sayfa getirme: iç ağa yönlendirme reddedilir", async () => {
  const calls: string[] = [];
  const f: FetchLike = async (u) => {
    calls.push(u.href);
    return u.hostname === "kisa.example" ? redirect("http://169.254.169.254/latest/meta-data") : html("sir");
  };
  const r = await fetchPage(new URL("https://kisa.example/x"), { fetchImpl: f, resolver: publicResolver });
  assert.equal(r.ok, false);
  assert.deepEqual(calls, ["https://kisa.example/x"], "iç adrese hiç istek gitmemeli");
});

test("sayfa getirme: göreli yönlendirme izlenir, döngü ve HTML olmayan içerik reddedilir", async () => {
  const ok = await fetchPage(new URL("https://a.example/eski"), {
    resolver: publicResolver,
    fetchImpl: async (u) => (u.pathname === "/eski" ? redirect("/yeni", 301) : html("<p>merhaba</p>")),
  });
  assert.ok(ok.ok && ok.html.includes("merhaba") && ok.url === "https://a.example/yeni");

  const loop = await fetchPage(new URL("https://a.example/1"), { resolver: publicResolver, fetchImpl: async () => redirect("/1") });
  assert.deepEqual(loop, { ok: false, reason: "çok fazla yönlendirme" });

  const pdf = await fetchPage(new URL("https://a.example/f"), { resolver: publicResolver, fetchImpl: async () => html("%PDF", 200, "application/pdf") });
  assert.deepEqual(pdf, { ok: false, reason: "sayfa HTML değil" });

  const nf = await fetchPage(new URL("https://a.example/f"), { resolver: publicResolver, fetchImpl: async () => html("yok", 404) });
  assert.deepEqual(nf, { ok: false, reason: "HTTP 404" });

  const bad = await fetchPage(new URL("https://a.example/f"), { resolver: publicResolver, fetchImpl: async () => redirect("file:///etc/passwd") });
  assert.deepEqual(bad, { ok: false, reason: "yönlendirme geçersiz" });

  const down = await fetchPage(new URL("https://a.example/f"), {
    resolver: publicResolver,
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  assert.deepEqual(down, { ok: false, reason: "TypeError" });
});

test("sayfa getirme: büyük sayfa kırpılır", async () => {
  const chunk = new TextEncoder().encode("x".repeat(100_000));
  const big = new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < 20; i++) c.enqueue(chunk);
        c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/html" } },
  );
  const r = await fetchPage(new URL("https://a.example/"), { resolver: publicResolver, fetchImpl: async () => big });
  assert.ok(r.ok && r.html.length < 700_000 && r.html.length >= 600_000);
});

test("link tarama: doğrudan TikTok adresi, sosyal ağ, Linktree sayfası", async () => {
  assert.deepEqual(await scanLink("https://www.tiktok.com/@ayse.cilt", "ayse", {}), { tiktok: "ayse.cilt", email: null, status: "ok", reason: undefined });
  assert.equal((await scanLink("https://www.tiktok.com/", "ayse", {})).status, "skipped");
  assert.equal((await scanLink("https://instagram.com/x", "x", {})).status, "skipped");
  assert.equal((await scanLink("http://localhost:3000", "x", {})).status, "skipped", "alışılmadık port geçersiz");
  assert.equal((await scanLink("", "x", {})).status, "skipped");

  const page = '<a href="https://tiktok.com/@ayse.cilt">T</a><a href="mailto:ayse@ornek.com">M</a>';
  const deps = { resolver: publicResolver, fetchImpl: (async () => html(page)) as FetchLike };
  assert.deepEqual(await scanLink("linktr.ee/ayse", "ayse", deps), { tiktok: "ayse.cilt", email: "ayse@ornek.com", status: "ok", reason: undefined });

  const two = '<a href="https://tiktok.com/@marka">M</a><a href="https://tiktok.com/@baska">B</a>';
  const amb = await scanLink("linktr.ee/ayse", "ayse", { resolver: publicResolver, fetchImpl: async () => html(two) });
  assert.equal(amb.status, "ambiguous");
  assert.equal(amb.tiktok, null);
  const match = await scanLink("linktr.ee/baska", "baska", { resolver: publicResolver, fetchImpl: async () => html(two) });
  assert.equal(match.tiktok, "baska");

  const internal = await scanLink("https://internal.evil.example/", "x", { resolver: publicResolver, fetchImpl: async () => html("x") });
  assert.equal(internal.status, "failed");
});

type Patch = { id: string; patch: Record<string, string> };
function fakeDb(rows: unknown[]) {
  const updates: Patch[] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "not", "eq", "or", "order"]) q[m] = () => q;
  q.limit = () => Promise.resolve({ data: rows, error: null });
  const db = {
    from: () => ({
      select: () => q,
      update: (patch: Record<string, string>) => ({
        eq: (_col: string, id: string) => {
          updates.push({ id, patch });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, updates };
}

test("toplu tarama: yalnızca boş alanları doldurur, hatada kısa süre sonra yeniden dener", async () => {
  const NOW = Date.parse("2026-10-18T12:00:00Z");
  const rows = [
    { id: "1", instagram: "ayse", tiktok: null, email: "var@ornek.com", other_url: "linktr.ee/ayse" }, // mail dolu: dokunma
    { id: "2", instagram: "can", tiktok: "can.tt", email: null, other_url: "beacons.ai/can" }, // tiktok dolu: dokunma
    { id: "3", instagram: "bozuk", tiktok: null, email: null, other_url: "https://kapali.example" }, // sayfa açılmıyor
  ];
  const { db, updates } = fakeDb(rows);
  const page = '<a href="https://tiktok.com/@ayse.cilt">T</a><a href="mailto:yeni@ornek.com">M</a>';
  const out = await runLinkScan(db, {
    batch: 10,
    now: NOW,
    deps: { resolver: publicResolver, fetchImpl: async (u) => (u.hostname === "kapali.example" ? html("hata", 500) : html(page)) },
  });

  const by = Object.fromEntries(updates.map((u) => [u.id, u.patch]));
  assert.equal(by["1"].tiktok, "ayse.cilt");
  assert.equal(by["1"].email, undefined, "dolu mailin üzerine yazılmaz");
  assert.equal(by["2"].tiktok, undefined, "dolu TikTok'un üzerine yazılmaz");
  assert.equal(by["2"].email, "yeni@ornek.com");
  assert.equal(by["3"].tiktok, undefined);
  assert.equal(by["1"].link_scanned_at, "2026-10-18T12:00:00.000Z");
  assert.equal(by["3"].link_scanned_at, "2026-09-21T12:00:00.000Z", "hatalı link 3 gün sonra yeniden denenir (30 - 3 gün öncesi damga)");
  assert.deepEqual({ picked: out.picked, tiktok: out.tiktok, email: out.email, failed: out.failed }, { picked: 3, tiktok: 1, email: 1, failed: 1 });
  assert.equal(out.errors[0].message, "HTTP 500");
});
