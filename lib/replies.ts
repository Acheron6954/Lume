// Yanıt takibi: saf fonksiyonlar. Gmail'e yalnızca üstbilgi (metadata) düzeyinde bakılır;
// bu dosya ağa çıkmaz. Konuşma çekme işi gmail.ts içindeki fetchThread'dedir.

export type GmailHeader = { name: string; value: string };
export type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string; // ms, metin olarak
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
};
export type GmailThread = { id: string; messages?: GmailMessage[] };

export type Reply = { messageId: string; at: string; from: string; subject: string; snippet: string };
export type ThreadVerdict = { reply: Reply | null; bounced: boolean };

export const FOLLOWUP_DAYS = 7; // bu kadar gündür yanıt yoksa "bekleyen" sayılır

const header = (m: GmailMessage, name: string): string =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value?.trim() ?? "";

/** "Ayşe <ayse@x.com>" → "ayse@x.com" (küçük harf). Adres yoksa boş. */
export function senderAddress(from: string): string {
  const m = /<([^<>\s]+@[^<>\s]+)>/.exec(from) ?? /([^\s<>"]+@[^\s<>"]+)/.exec(from);
  return (m?.[1] ?? "").toLowerCase();
}

/** Mail sunucusunun geri dönüş (ulaşmadı) bildirimi mi? */
export function isBounce(m: GmailMessage): boolean {
  return /^(mailer-daemon|postmaster)@/.test(senderAddress(header(m, "from")));
}

/** Otomatik yanıt (tatilde, bilet açıldı vb.) insan yanıtı sayılmaz. */
export function isAutomatic(m: GmailMessage): boolean {
  const auto = header(m, "auto-submitted").toLowerCase();
  if (auto && auto !== "no") return true;
  if (/^(bulk|auto_reply|junk)$/i.test(header(m, "precedence"))) return true;
  if (header(m, "x-autoreply") || header(m, "x-autorespond")) return true;
  return false;
}

/**
 * Bir konuşmada, bizim gönderdiğimiz maile gelen ilk gerçek yanıtı bulur.
 * Yanıt sayılması için: SENT etiketi yok, gönderen biz değiliz, gönderimden sonra gelmiş, otomatik değil.
 */
export function findReply(thread: GmailThread, ourEmail: string, sentAtMs: number): ThreadVerdict {
  const me = ourEmail.trim().toLowerCase();
  let reply: Reply | null = null;
  let bounced = false;
  const list = [...(thread.messages ?? [])].sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0));
  for (const m of list) {
    if (m.labelIds?.includes("SENT")) continue;
    const at = Number(m.internalDate);
    if (!Number.isFinite(at) || at < sentAtMs) continue;
    const from = senderAddress(header(m, "from"));
    if (!from || from === me) continue;
    if (isBounce(m)) {
      bounced = true;
      continue;
    }
    if (isAutomatic(m)) continue;
    reply = { messageId: m.id, at: new Date(at).toISOString(), from, subject: header(m, "subject").slice(0, 200), snippet: (m.snippet ?? "").slice(0, 500) };
    break;
  }
  return { reply, bounced: reply ? false : bounced };
}

export type SentRow = { influencer_id: string | null; sent_at: string; bounced_at?: string | null };
export type InboundRow = { influencer_id: string; sent_at: string };
export type ReplyStatus = { influencerId: string; sentAt: string; repliedAt: string | null; bouncedAt: string | null };

/** Hesap başına: en son giden mail, ilk gelen yanıt (o maildan sonraki), ulaşmadı işareti. */
export function summarize(sent: SentRow[], inbound: InboundRow[]): ReplyStatus[] {
  const latest = new Map<string, SentRow>();
  for (const s of sent) {
    if (!s.influencer_id) continue;
    const cur = latest.get(s.influencer_id);
    if (!cur || s.sent_at > cur.sent_at) latest.set(s.influencer_id, s);
  }
  const out: ReplyStatus[] = [];
  for (const [id, s] of latest) {
    const firstAfter = inbound
      .filter((r) => r.influencer_id === id && r.sent_at >= s.sent_at)
      .map((r) => r.sent_at)
      .sort()[0];
    out.push({ influencerId: id, sentAt: s.sent_at, repliedAt: firstAfter ?? null, bouncedAt: s.bounced_at ?? null });
  }
  return out.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

/** Yanıt vermeyenler: yanıt yok, ulaşmadı değil, son mailin üstünden en az `days` gün geçmiş. */
export function awaiting(list: ReplyStatus[], now: Date, days = FOLLOWUP_DAYS): ReplyStatus[] {
  const limit = now.getTime() - days * 86_400_000;
  return list.filter((r) => !r.repliedAt && !r.bouncedAt && new Date(r.sentAt).getTime() <= limit);
}

/** Kaç gün önce (tam gün). */
export const daysSince = (iso: string, now: Date): number => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
