// Sunucu tarafı Supabase istemcisi (service key). RLS'i aşar: asla tarayıcıya veya NEXT_PUBLIC değişkenine koyma.
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
