// Sunucuda influencers tablosunu okur (service key). Tarayıcıya yalnızca sonuç gider.
import { rowToInfluencer, type Influencer, type InfluencerRow } from "./influencer";
import { adminClient } from "./supabase-admin";

const COLUMNS =
  "id, name, niche, instagram, email, followers, engagement_rate, avg_likes, avg_comments, posts_analyzed, scan_status, last_scanned_at, found_at";

export async function loadInfluencers(): Promise<{ influencers: Influencer[]; error: string | null }> {
  const db = adminClient();
  if (!db) return { influencers: [], error: "Veritabanı ayarları eksik (SUPABASE_SERVICE_ROLE_KEY)." };
  const { data, error } = await db
    .from("influencers")
    .select(COLUMNS)
    .not("instagram", "is", null)
    .order("followers", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) return { influencers: [], error: `Veritabanı okunamadı: ${error.message}` };
  return { influencers: ((data ?? []) as InfluencerRow[]).map(rowToInfluencer), error: null };
}
