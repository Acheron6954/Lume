// Panel üyeleri: yalnızca sunucuda (service key). Şifreler scrypt hash'li saklanır.
import { hashPassword, verifyPassword } from "./auth";
import type { MemberRole, MemberStatus, Registration } from "./members";
import { adminClient } from "./supabase-admin";

export type Member = { id: string; email: string; name: string; status: MemberStatus; role: MemberRole; created_at: string; decided_at: string | null };

// Kullanıcı bulunamasa da şifre kontrolü çalışsın diye (süre farkından ipucu çıkmasın) sabit bir hash.
const DUMMY_HASH = hashPassword("lume-dummy-password-never-used");

/** Yeni kayıt "pending" olarak eklenir. Adres zaten varsa sessizce hiçbir şey yapmaz (kim kayıtlı sızmasın). */
export async function registerMember(r: Registration): Promise<"ok" | "error"> {
  const db = adminClient();
  if (!db) return "error";
  const { error } = await db.from("panel_members").insert({ email: r.email, name: r.name, pass_hash: hashPassword(r.password), kvkk_at: new Date().toISOString() });
  if (error && error.code !== "23505") return "error";
  return "ok";
}

/** E-posta + şifre doğruysa üyenin durumunu ve rolünü döner; değilse null. */
export async function checkMember(email: string, password: string): Promise<{ status: MemberStatus; role: MemberRole; email: string } | null> {
  const db = adminClient();
  if (!db) {
    verifyPassword(password, DUMMY_HASH);
    return null;
  }
  const { data } = await db.from("panel_members").select("email, pass_hash, status, role").eq("email", email.trim().toLowerCase()).maybeSingle();
  const ok = verifyPassword(password, data?.pass_hash ?? DUMMY_HASH);
  if (!data || !ok) return null;
  return { status: data.status as MemberStatus, role: data.role as MemberRole, email: data.email as string };
}

/** Oturumdaki üye hâlâ onaylı mı? (Erişimi kaldırılan üye bir sonraki sayfa açılışında dışarıda kalır.) */
export async function memberStillApproved(email: string): Promise<MemberRole | null> {
  const db = adminClient();
  if (!db) return null;
  const { data } = await db.from("panel_members").select("status, role").eq("email", email.trim().toLowerCase()).maybeSingle();
  return data?.status === "approved" ? (data.role as MemberRole) : null;
}

export async function listMembers(): Promise<{ members: Member[]; error: boolean }> {
  const db = adminClient();
  if (!db) return { members: [], error: true };
  const { data, error } = await db.from("panel_members").select("id, email, name, status, role, created_at, decided_at").order("created_at", { ascending: false }).limit(500);
  return { members: (data ?? []) as Member[], error: !!error };
}

export async function decideMember(id: string, status: MemberStatus, role: MemberRole): Promise<boolean> {
  const db = adminClient();
  if (!db) return false;
  const { error } = await db.from("panel_members").update({ status, role, decided_at: new Date().toISOString() }).eq("id", id);
  return !error;
}
