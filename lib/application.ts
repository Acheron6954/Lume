// Kreatör başvurusu: istemci ve sunucunun ortak kullandığı doğrulama. Ağa çıkmaz.
import { isEmail } from "./influencer";

export const NICHES = ["Cilt bakımı", "Makyaj", "Saç bakımı", "Yaşam tarzı", "Diğer"] as const;
export type Niche = (typeof NICHES)[number];

export type Application = {
  instagram: string | null;
  tiktok: string | null;
  niche: Niche;
  name: string;
  email: string;
  whatsapp: string | null;
  city: string;
  kvkk: true;
  disclosure: true;
};

export type ApplicationInput = Partial<Record<keyof Application | "website", unknown>>;

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

/** "@Ad.Soyad", "instagram.com/ad.soyad/", "https://www.tiktok.com/@ad" → "ad.soyad". Geçersizse null. */
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/^(www\.|m\.)/, "");
  v = v.replace(/^(instagram\.com|tiktok\.com)\//, "");
  v = v.replace(/^@/, "").split(/[/?#]/)[0].replace(/^@/, "");
  return HANDLE_RE.test(v) ? v : null;
}

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Türkiye numarası ya da uluslararası biçim: yalnızca rakam ve başta +; 10–15 hane. */
export function normalizePhone(raw: unknown): string | null {
  const v = clean(raw, 40);
  if (!v) return null;
  const digits = v.replace(/[\s().-]/g, "");
  return /^\+?\d{10,15}$/.test(digits) ? digits : null;
}

export type FieldErrors = Partial<Record<keyof Application, string>>;

/**
 * Başvuruyu doğrular. Dolu gizli alan (website) = bot: { bot: true }.
 * Hatalar Türkçe ve alan alanına; hiç hata yoksa temiz kayıt döner.
 */
export function parseApplication(input: ApplicationInput): { ok: true; value: Application } | { ok: false; errors: FieldErrors; bot?: boolean } {
  if (typeof input.website === "string" && input.website.trim()) return { ok: false, errors: {}, bot: true };
  const errors: FieldErrors = {};

  const igRaw = clean(input.instagram, 120);
  const ttRaw = clean(input.tiktok, 120);
  const instagram = igRaw ? normalizeHandle(igRaw) : null;
  const tiktok = ttRaw ? normalizeHandle(ttRaw) : null;
  if (igRaw && !instagram) errors.instagram = "Geçerli bir Instagram kullanıcı adı yaz.";
  if (ttRaw && !tiktok) errors.tiktok = "Geçerli bir TikTok kullanıcı adı yaz.";
  if (!igRaw && !ttRaw) errors.instagram = "Instagram ya da TikTok kullanıcı adından en az birini yaz.";

  const niche = NICHES.find((n) => n === input.niche);
  if (!niche) errors.niche = "İçerik alanını seç.";

  const name = clean(input.name, 80);
  if (name.length < 2) errors.name = "Adını ve soyadını yaz.";

  const email = clean(input.email, 160).toLowerCase();
  if (!isEmail(email)) errors.email = "Geçerli bir e-posta adresi yaz.";

  const waRaw = clean(input.whatsapp, 40);
  const whatsapp = waRaw ? normalizePhone(waRaw) : null;
  if (waRaw && !whatsapp) errors.whatsapp = "Numarayı rakamlarla, alan koduyla yaz.";

  const city = clean(input.city, 60);
  if (city.length < 2) errors.city = "Şehrini yaz.";

  if (input.kvkk !== true) errors.kvkk = "Devam etmek için aydınlatma metnini onaylaman gerekiyor.";
  if (input.disclosure !== true) errors.disclosure = "Reklam etiketi şartını kabul etmen gerekiyor.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { instagram, tiktok, niche: niche as Niche, name, email, whatsapp, city, kvkk: true, disclosure: true } };
}

/** Formun her adımında hangi alanlar kontrol edilir. */
export const STEP_FIELDS: Record<1 | 2 | 3, (keyof Application)[]> = {
  1: ["instagram", "tiktok", "niche"],
  2: ["name", "email", "whatsapp", "city"],
  3: ["kvkk", "disclosure"],
};
