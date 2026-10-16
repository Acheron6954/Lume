// Testlerde kullanılan sahte hesaplar (uygulamaya girmez).
import type { Influencer } from "../lib/influencer.ts";

const base = { platform: "instagram" as const, verified: true, foundAt: "2026-10-14T08:10:00Z", avgLikes: 100, avgComments: 5 };

export const FIXTURE: Influencer[] = [
  { ...base, id: "t-01", name: "Cilt Günlüğü", handle: "t.ciltgunlugu", niche: "Cilt bakımı", followers: 48_200, engagement: 0.03, email: "t01@example.com" },
  { ...base, id: "t-02", name: "Makyaj Atölyesi", handle: "t.makyaj", niche: "Makyaj", followers: 126_000, engagement: 0.02 },
  { ...base, id: "t-03", name: "Glow Lab", handle: "t.glow", niche: "Cilt bakımı", followers: 9_400, engagement: 0.05 }, // düşük takipçi
  { ...base, id: "t-04", name: "Serum Kulübü", handle: "t.serum", niche: "Cilt bakımı", followers: 71_500, engagement: 0.004 }, // düşük etkileşim
  { ...base, id: "t-05", name: "Hayalet", handle: "t.hayalet", niche: "", followers: 17_700, engagement: null, verified: false, avgLikes: 0, avgComments: 0 }, // doğrulanamadı
  { ...base, id: "t-06", name: "Az Veri", handle: "t.azveri", niche: "Güzellik", followers: 25_000, engagement: null }, // az gönderi: oran yok, uyarı yok
];
