// Herkese açık kreatör başvurusu. Oturum gerekmez; doğrulama, gizli alan (bot) ve basit hız sınırı burada.
import { createHash } from "node:crypto";
import { lockedFor, recordFail } from "@/lib/auth";
import { parseApplication } from "@/lib/application";
import { adminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PER_IP_LIMIT = 5; // aynı adresten 15 dakikada en fazla 5 başvuru (bellekte)

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(req.url).origin !== origin) return Response.json({ error: "Geçersiz istek" }, { status: 403 });

  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "yerel").trim();
  if (lockedFor(`app:${ip}`) > 0) return Response.json({ error: "Çok fazla başvuru gönderildi. Biraz sonra tekrar dene." }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  const parsed = parseApplication(body as Record<string, unknown>);
  if (!parsed.ok && parsed.bot) return Response.json({ ok: true });
  if (!parsed.ok) return Response.json({ error: "Formda düzeltilmesi gereken alanlar var.", fields: parsed.errors }, { status: 422 });

  const db = adminClient();
  if (!db) return Response.json({ error: "Başvuru şu an alınamıyor." }, { status: 503 });

  recordFail(`app:${ip}`, PER_IP_LIMIT);
  const v = parsed.value;
  const now = new Date().toISOString();
  const salt = process.env.SESSION_SECRET ?? "";
  const { error } = await db.from("creator_applications").insert({
    instagram: v.instagram,
    tiktok: v.tiktok,
    niche: v.niche,
    name: v.name,
    email: v.email,
    whatsapp: v.whatsapp,
    city: v.city,
    kvkk_at: now,
    disclosure_at: now,
    // IP'nin kendisi saklanmaz; yalnızca kötüye kullanımı ayırt etmeye yetecek tek yönlü özet.
    ip_hash: createHash("sha256").update(salt + ip).digest("hex").slice(0, 32),
  });
  if (error) {
    console.error("basvuru: kayıt hatası", error.code);
    return Response.json({ error: "Başvuru şu an kaydedilemedi. Biraz sonra tekrar dene." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
