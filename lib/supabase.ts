import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Kritik Hata: Supabase ortam değişkenleri (.env.local) bulunamadı!")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)