// DM kayıtları (taslak, onay, gönderildi, yanıt). Yalnızca yönetici; DM'ler buradan gönderilmez, yalnızca kaydedilir.
import { cookies } from "next/headers";
import { SESSION_COOKIE, readConfig, readSession } from "@/lib/auth";
import { itemToRow, parseDmPatch, rowToItem, type DmRow } from "@/lib/dm-state";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function admin() {
  const cfg = readConfig();
  const store = await cookies();
  const session = cfg ? readSession(store.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (!session) return { error: Response.json({ error: "Giriş gerekli" }, { status: 401 }) };
  if (session.role !== "admin") return { error: Response.json({ error: "Bu hesap salt okunur." }, { status: 403 }) };
  const db = adminClient();
  if (!db) return { error: Response.json({ error: "Supabase ayarları eksik" }, { status: 500 }) };
  return { db };
}

export async function GET() {
  const a = await admin();
  if (!a.db) return a.error;
  const { data, error } = await a.db.from("dm_items").select("id, influencer_id, channel, text, approved, sent_at, replied_at, note").order("created_at", { ascending: true }).limit(2000);
  if (error) return Response.json({ error: "DM kayıtları okunamadı" }, { status: 500 });
  const { data: set } = await a.db.from("dm_settings").select("template").eq("id", "main").maybeSingle();
  return Response.json({ template: set?.template ?? null, items: ((data ?? []) as DmRow[]).map(rowToItem) });
}

export async function POST(req: Request) {
  const a = await admin();
  if (!a.db) return a.error;
  const patch = parseDmPatch(await req.json().catch(() => null));
  if (!patch) return Response.json({ error: "Geçersiz istek" }, { status: 400 });

  if (patch.upsert.length) {
    const { error } = await a.db.from("dm_items").upsert(patch.upsert.map(itemToRow), { onConflict: "id" });
    if (error) return Response.json({ error: "Kaydedilemedi" }, { status: error.code === "23503" ? 409 : 500 });
  }
  if (patch.remove.length) {
    const { error } = await a.db.from("dm_items").delete().in("id", patch.remove);
    if (error) return Response.json({ error: "Silinemedi" }, { status: 500 });
  }
  if (patch.template !== undefined) {
    const { error } = await a.db.from("dm_settings").upsert({ id: "main", template: patch.template, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return Response.json({ error: "Şablon kaydedilemedi" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
