// Instagram Graph API: Business Discovery ile başka bir business/creator hesabın herkese açık verisi.
// Sadece sunucuda çalıştır; IG_TOKEN tarayıcıya asla gitmemeli.

const GRAPH = "https://graph.facebook.com/v26.0";
const MEDIA_LIMIT = 12;

/** Instagram kullanıcı adı kuralı. Sorguya gömüldüğü için sıkı doğrulanır. */
export const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

export type IgPost = { likes: number | null; comments: number; at: string };

export type IgProfile = {
  username: string;
  name: string;
  biography: string;
  website: string;
  followers: number;
  mediaCount: number;
  posts: IgPost[];
};

export type IgFailure = "not_found" | "token" | "rate" | "error";
export type IgResult = { ok: true; profile: IgProfile } | { ok: false; kind: IgFailure; message: string };

type GraphError = { message?: string; code?: number; error_subcode?: number };

/** Graph hatasını işimize yarayan türe çevirir. */
export function classifyError(e: GraphError): IgFailure {
  const code = e.code ?? 0;
  if (code === 190 || code === 102) return "token";
  if ([4, 17, 32, 613].includes(code)) return "rate";
  const msg = (e.message ?? "").toLowerCase();
  if (e.error_subcode === 2207013 || msg.includes("invalid user id") || msg.includes("does not exist")) return "not_found";
  return "error";
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function parseDiscovery(json: unknown): IgProfile | null {
  const bd = (json as { business_discovery?: Record<string, unknown> } | null)?.business_discovery;
  if (!bd || typeof bd !== "object") return null;
  const media = (bd.media as { data?: unknown[] } | undefined)?.data ?? [];
  const posts: IgPost[] = media.flatMap((m) => {
    const o = m as Record<string, unknown>;
    if (!o || typeof o !== "object") return [];
    return [
      {
        likes: typeof o.like_count === "number" ? o.like_count : null, // beğeni sayısı gizliyse null
        comments: num(o.comments_count),
        at: str(o.timestamp),
      },
    ];
  });
  return {
    username: str(bd.username),
    name: str(bd.name),
    biography: str(bd.biography),
    website: str(bd.website),
    followers: Math.max(0, Math.round(num(bd.followers_count))),
    mediaCount: Math.max(0, Math.round(num(bd.media_count))),
    posts,
  };
}

export async function discover(username: string, igUserId: string, token: string): Promise<IgResult> {
  if (!USERNAME_RE.test(username)) return { ok: false, kind: "not_found", message: "Geçersiz kullanıcı adı" };
  const fields =
    `business_discovery.username(${username}){username,name,biography,website,followers_count,media_count,` +
    `media.limit(${MEDIA_LIMIT}){like_count,comments_count,timestamp}}`;
  const url = `${GRAPH}/${encodeURIComponent(igUserId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const json = (await res.json()) as { error?: GraphError };
    if (json.error) return { ok: false, kind: classifyError(json.error), message: json.error.message ?? "Bilinmeyen hata" };
    const profile = parseDiscovery(json);
    if (!profile) return { ok: false, kind: "error", message: "Beklenmeyen yanıt" };
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, kind: "error", message: e instanceof Error ? e.name : "Ağ hatası" };
  }
}

export type Engagement = { avgLikes: number; avgComments: number; ratePct: number | null; posts: number };

/** Etkileşim oranı = (ort. beğeni + ort. yorum) ÷ takipçi, yüzde olarak. Beğenisi gizli gönderiler dışarıda kalır. */
export function engagementOf(p: Pick<IgProfile, "followers" | "posts">): Engagement {
  const usable = p.posts.filter((x) => x.likes !== null);
  if (usable.length === 0 || p.followers <= 0) return { avgLikes: 0, avgComments: 0, ratePct: null, posts: usable.length };
  const avgLikes = usable.reduce((s, x) => s + (x.likes ?? 0), 0) / usable.length;
  const avgComments = usable.reduce((s, x) => s + x.comments, 0) / usable.length;
  const ratePct = Math.round(((avgLikes + avgComments) / p.followers) * 10_000) / 100;
  return { avgLikes: Math.round(avgLikes), avgComments: Math.round(avgComments), ratePct, posts: usable.length };
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;

/** Bio'da yazılı e-posta varsa döner. */
export function emailFromBio(bio: string): string | null {
  const m = bio.match(EMAIL_RE);
  return m && m[0].length <= 120 ? m[0].toLowerCase() : null;
}
