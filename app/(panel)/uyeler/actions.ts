"use server";

import { revalidatePath } from "next/cache";
import { decideMember } from "@/lib/members-db";
import { isOwnerSession } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Onayla (salt okunur / yönetici), reddet ya da erişimi kaldır. Yalnızca site sahibi. */
export async function decide(formData: FormData): Promise<void> {
  if (!(await isOwnerSession())) return;
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!UUID.test(id)) return;
  if (action === "viewer" || action === "admin") await decideMember(id, "approved", action);
  else if (action === "reject") await decideMember(id, "rejected", "viewer");
  revalidatePath("/uyeler");
}
