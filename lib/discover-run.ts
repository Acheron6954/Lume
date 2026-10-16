// Arama + listeye ekleme. Mail/DM ile ilgisi yok: sadece aday kaydı açar.
import type { SupabaseClient } from "@supabase/supabase-js";
import { braveSearch, candidatesFrom, pickQueries } from "./discovery";

const MAX_NEW_PER_RUN = 60;
const GAP_MS = 1100; // Brave: saniyede 1 istek

export type DiscoveryOutcome = {
  queries: number;
  candidates: number; // aramalarda bulunan benzersiz kullanıcı adı
  added: number; // listede olmayıp yeni eklenen
  stoppedBy: string | null;
  errors: string[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function knownHandles(db: SupabaseClient): Promise<Set<string>> {
  const known = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("influencers").select("instagram").not("instagram", "is", null).range(from, from + 999);
    if (error) throw new Error(`Veritabanı: ${error.message}`);
    for (const r of data ?? []) known.add(String(r.instagram).toLowerCase());
    if ((data?.length ?? 0) < 1000) break;
  }
  return known;
}

export async function runDiscovery(db: SupabaseClient, braveKey: string, opts: { queryCount: number; now?: number }): Promise<DiscoveryOutcome> {
  const out: DiscoveryOutcome = { queries: 0, candidates: 0, added: 0, stoppedBy: null, errors: [] };
  const dayIndex = Math.floor((opts.now ?? Date.now()) / 86_400_000);
  const found = new Set<string>();

  for (const q of pickQueries(dayIndex, opts.queryCount)) {
    if (out.queries > 0) await sleep(GAP_MS);
    const r = await braveSearch(q, braveKey);
    out.queries++;
    if (!r.ok) {
      out.errors.push(`${q}: ${r.message}`);
      if (r.kind !== "error") {
        out.stoppedBy = r.message;
        break;
      }
      continue;
    }
    for (const h of candidatesFrom(r.hits)) found.add(h);
  }
  out.candidates = found.size;

  const known = await knownHandles(db);
  const fresh = [...found].filter((h) => !known.has(h)).slice(0, MAX_NEW_PER_RUN);
  if (fresh.length === 0) return out;

  const now = new Date().toISOString();
  const rows = fresh.map((h) => ({ name: h, instagram: h, source: "arama:brave", found_at: now, updated_at: now }));
  const { error } = await db.from("influencers").insert(rows);
  if (!error) {
    out.added = rows.length;
    return out;
  }
  // Toplu eklemede çakışma olursa tek tek dene, çakışanları atla.
  for (const row of rows) {
    const { error: e } = await db.from("influencers").insert(row);
    if (!e) out.added++;
  }
  return out;
}
