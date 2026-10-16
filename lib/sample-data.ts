// ÖRNEK VERİ: tasarım aşaması için uydurma hesaplar. Gerçek ajan verisi gelince bu dosya kalkar.
import type { Influencer } from "./influencer";

type Row = [string, string, "instagram" | "tiktok", string, number, number, boolean, string];
// [ad, hesap, platform, alan, takipçi, ort. görüntülenme, mail var mı, bulunma zamanı]
const rows: Row[] = [
  ["Cilt Günlüğü", "ornek.ciltgunlugu", "instagram", "Cilt bakımı", 48200, 21400, true, "2026-10-14T08:10:00Z"],
  ["Makyaj Atölyesi", "ornek.makyajatolyesi", "instagram", "Makyaj", 126000, 31500, true, "2026-10-14T08:12:00Z"],
  ["Rutin Notları", "ornek.rutinnotlari", "tiktok", "Cilt bakımı", 18900, 12100, true, "2026-10-14T09:40:00Z"],
  ["Glow Lab", "ornek.glowlab", "instagram", "Cilt bakımı", 9400, 3100, true, "2026-10-15T07:05:00Z"],
  ["Serum Kulübü", "ornek.serumkulubu", "tiktok", "Cilt bakımı", 71500, 4300, true, "2026-10-15T07:21:00Z"],
  ["Güzellik Köşesi", "ornek.guzellikkosesi", "instagram", "Güzellik", 33800, 9800, true, "2026-10-15T07:48:00Z"],
  ["Pembe Kozmetik", "ornek.pembekozmetik", "instagram", "Makyaj", 15600, 1200, true, "2026-10-15T10:02:00Z"],
  ["Kapalı Gözlerle", "ornek.kapaligozlerle", "tiktok", "Cilt bakımı", 22300, 14900, true, "2026-10-15T10:30:00Z"],
  ["Dermo Sohbet", "ornek.dermosohbet", "instagram", "Cilt bakımı", 58000, 17400, true, "2026-10-16T06:15:00Z"],
  ["Minik Rutin", "ornek.minikrutin", "tiktok", "Cilt bakımı", 7800, 4900, false, "2026-10-16T06:33:00Z"],
  ["Işıltı Defteri", "ornek.iltidefteri", "instagram", "Makyaj", 41200, 13700, true, "2026-10-16T07:02:00Z"],
  ["Pür Cilt", "ornek.purcilt", "tiktok", "Cilt bakımı", 88400, 52900, true, "2026-10-16T07:20:00Z"],
  ["Kozmetik Raf", "ornek.kozmetikraf", "instagram", "Güzellik", 12300, 2100, true, "2026-10-16T07:41:00Z"],
  ["Bakım Saati", "ornek.bakimsaati", "instagram", "Cilt bakımı", 27500, 8200, true, "2026-10-16T08:05:00Z"],
];

export const SAMPLE_INFLUENCERS: Influencer[] = rows.map(
  ([name, handle, platform, niche, followers, avgViews, hasMail, foundAt], idx) => ({
    id: `ornek-${String(idx + 1).padStart(2, "0")}`,
    name,
    handle,
    platform,
    niche,
    followers,
    avgViews,
    email: hasMail ? `ornek${String(idx + 1).padStart(2, "0")}@example.com` : undefined,
    foundAt,
    example: true,
  }),
);

/** Genel bakıştaki küçük çizgiler için süs verisi (gerçek değil). */
export const SAMPLE_TRENDS = {
  found: [2, 3, 3, 5, 6, 9, 14],
  flagged: [0, 1, 1, 2, 2, 3, 4],
  excluded: [0, 0, 0, 1, 1, 1, 1],
  approved: [0, 0, 1, 1, 2, 2, 3],
};

export const SAMPLE_FEED: { time: string; text: string }[] = [
  { time: "08:05", text: "#ciltbakımı etiketinde 3 yeni aday buldu" },
  { time: "07:41", text: "Takipçi ve izlenme oranı hesaplandı, 4 hesap uyarıya alındı" },
  { time: "07:02", text: "İletişim mailleri profil sayfalarından toplandı" },
  { time: "06:15", text: "Günlük tarama başladı" },
];
