// Panelin ortak durumu: saf fonksiyonlar (React'ten bağımsız, test edilebilir).
import {
  DEFAULT_MAIL,
  DEFAULT_SUBJECT,
  DEFAULT_TEMPLATE,
  DEFAULT_THRESHOLDS,
  fillTemplate,
  isEmail,
  type Influencer,
  type MailSettings,
  type Thresholds,
} from "./influencer";

/** Elle girilen mail: alıcı listede olmayabilir, metin son halidir (şablonla bağı yoktur). */
export type ManualMail = {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  approved: boolean;
};

/** Tekrar iletişime geçilecek influencer. */
export type Recontact = {
  id: string; // influencer id
  note: string;
  at: string; // eklenme zamanı, ISO
};

export type PanelState = {
  excluded: string[]; // etkileşimden çıkarılanlar
  selected: string[]; // mail için seçilenler
  approved: string[]; // mail metni onaylananlar
  edits: Record<string, string>; // elle düzenlenen mail metinleri
  thresholds: Thresholds;
  mail: MailSettings;
  manual: ManualMail[]; // elle girilen mailler
  recontact: Recontact[]; // tekrar iletişim listesi
};

export const initialState: PanelState = {
  excluded: [],
  selected: [],
  approved: [],
  edits: {},
  thresholds: DEFAULT_THRESHOLDS,
  mail: DEFAULT_MAIL,
  manual: [],
  recontact: [],
};

export type ManualFields = Pick<ManualMail, "name" | "email" | "subject" | "body">;

export type Action =
  | { type: "hydrate"; state: PanelState }
  | { type: "exclude"; ids: string[] }
  | { type: "restore"; id: string }
  | { type: "toggleSelect"; id: string }
  | { type: "select"; ids: string[] }
  | { type: "clearSelection" }
  | { type: "thresholds"; value: Partial<Thresholds> }
  | { type: "mail"; value: Partial<MailSettings> }
  | { type: "resetTemplate" }
  | { type: "edit"; id: string; text: string | null }
  | { type: "toggleApprove"; id: string }
  | { type: "addManual"; id: string; fields: ManualFields }
  | { type: "editManual"; id: string; patch: Partial<ManualFields> }
  | { type: "removeManual"; id: string }
  | { type: "toggleApproveManual"; id: string }
  | { type: "addRecontact"; id: string; note: string; at: string }
  | { type: "noteRecontact"; id: string; note: string }
  | { type: "removeRecontact"; id: string };

export const LIMITS = { name: 80, email: 120, subject: 200, body: 5000, note: 200, manual: 200 } as const;

const uniq = (a: string[]) => Array.from(new Set(a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const validDate = (v: string) => !Number.isNaN(new Date(v).getTime());

const cleanFields = (f: ManualFields): ManualFields => ({
  name: f.name.trim().slice(0, LIMITS.name),
  email: f.email.trim().slice(0, LIMITS.email),
  subject: f.subject.slice(0, LIMITS.subject),
  body: f.body.slice(0, LIMITS.body),
});

/** Elle girilen mail onaylanabilir mi? Ad, geçerli adres, konu ve metin dolu olmalı. */
export const manualReady = (m: ManualFields): boolean =>
  m.name.trim().length > 0 && isEmail(m.email) && m.subject.trim().length > 0 && m.body.trim().length > 0;

/** Onaylı mail sayısı: şablondan gelenler + elle girilenler. */
export const approvedCount = (s: PanelState): number => s.approved.length + s.manual.filter((m) => m.approved).length;

export function reduce(s: PanelState, a: Action, known: ReadonlySet<string>): PanelState {
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "exclude": {
      const ids = a.ids.filter((id) => known.has(id));
      const out = new Set(ids);
      return {
        ...s,
        excluded: uniq([...s.excluded, ...ids]),
        selected: s.selected.filter((id) => !out.has(id)),
        approved: s.approved.filter((id) => !out.has(id)),
        recontact: s.recontact.filter((r) => !out.has(r.id)),
      };
    }
    case "restore":
      return { ...s, excluded: s.excluded.filter((id) => id !== a.id) };
    case "toggleSelect": {
      if (!known.has(a.id) || s.excluded.includes(a.id)) return s;
      const on = s.selected.includes(a.id);
      return {
        ...s,
        selected: on ? s.selected.filter((id) => id !== a.id) : [...s.selected, a.id],
        approved: on ? s.approved.filter((id) => id !== a.id) : s.approved,
      };
    }
    case "select":
      return {
        ...s,
        selected: uniq([...s.selected, ...a.ids.filter((id) => known.has(id) && !s.excluded.includes(id))]),
      };
    case "clearSelection":
      return { ...s, selected: [], approved: [] };
    case "thresholds": {
      const t = { ...s.thresholds, ...a.value };
      return {
        ...s,
        thresholds: {
          minFollowers: Math.round(clamp(num(t.minFollowers, DEFAULT_THRESHOLDS.minFollowers), 0, 1_000_000)),
          minEngagement: clamp(num(t.minEngagement, DEFAULT_THRESHOLDS.minEngagement), 0, 0.6),
        },
      };
    }
    case "mail": {
      const m = { ...s.mail, ...a.value };
      return {
        ...s,
        mail: { ...m, commission: Math.round(clamp(num(m.commission, DEFAULT_MAIL.commission), 0, 100)) },
        approved: [], // metin değişti: onaylar yeniden alınır (elle girilen mailler kendi metnini taşır, etkilenmez)
      };
    }
    case "resetTemplate":
      return { ...s, mail: { ...s.mail, template: DEFAULT_TEMPLATE, subject: DEFAULT_SUBJECT }, approved: [] };
    case "edit": {
      const edits = { ...s.edits };
      if (a.text === null) delete edits[a.id];
      else edits[a.id] = a.text;
      return { ...s, edits, approved: s.approved.filter((id) => id !== a.id) };
    }
    case "toggleApprove": {
      if (!s.selected.includes(a.id)) return s;
      const on = s.approved.includes(a.id);
      return { ...s, approved: on ? s.approved.filter((id) => id !== a.id) : [...s.approved, a.id] };
    }
    case "addManual": {
      const f = cleanFields(a.fields);
      if (!a.id || s.manual.some((m) => m.id === a.id) || s.manual.length >= LIMITS.manual) return s;
      if (!f.name || !isEmail(f.email)) return s;
      return { ...s, manual: [...s.manual, { id: a.id, ...f, approved: false }] };
    }
    case "editManual": {
      return {
        ...s,
        manual: s.manual.map((m) => {
          if (m.id !== a.id) return m;
          const f = cleanFields({ ...m, ...a.patch });
          return { ...m, ...f, approved: false }; // metin değişti: onay yeniden alınır
        }),
      };
    }
    case "removeManual":
      return { ...s, manual: s.manual.filter((m) => m.id !== a.id) };
    case "toggleApproveManual":
      return {
        ...s,
        manual: s.manual.map((m) => {
          if (m.id !== a.id) return m;
          if (m.approved) return { ...m, approved: false };
          return manualReady(m) ? { ...m, approved: true } : m;
        }),
      };
    case "addRecontact": {
      if (!known.has(a.id) || s.excluded.includes(a.id) || s.recontact.some((r) => r.id === a.id) || !validDate(a.at)) return s;
      return { ...s, recontact: [...s.recontact, { id: a.id, note: a.note.trim().slice(0, LIMITS.note), at: a.at }] };
    }
    case "noteRecontact":
      return { ...s, recontact: s.recontact.map((r) => (r.id === a.id ? { ...r, note: a.note.slice(0, LIMITS.note) } : r)) };
    case "removeRecontact":
      return { ...s, recontact: s.recontact.filter((r) => r.id !== a.id) };
  }
}

const strList = (v: unknown, known: ReadonlySet<string>): string[] =>
  Array.isArray(v) ? uniq(v.filter((x): x is string => typeof x === "string" && known.has(x))) : [];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** localStorage'dan gelen her şey güvenilmez kabul edilir; bozuk alan varsayılana döner. */
export function sanitize(raw: unknown, known: ReadonlySet<string>): PanelState {
  if (!isObj(raw)) return initialState;
  const r = raw;
  const excluded = strList(r.excluded, known);
  const selected = strList(r.selected, known).filter((id) => !excluded.includes(id));
  const approved = strList(r.approved, known).filter((id) => selected.includes(id));
  const edits: Record<string, string> = {};
  if (isObj(r.edits)) {
    for (const [k, v] of Object.entries(r.edits)) {
      if (known.has(k) && typeof v === "string") edits[k] = v.slice(0, LIMITS.body);
    }
  }
  const t = isObj(r.thresholds) ? r.thresholds : {};
  const m = isObj(r.mail) ? r.mail : {};
  const str = (v: unknown, fb: string, max: number) => (typeof v === "string" ? v.slice(0, max) : fb);

  const manual: ManualMail[] = [];
  if (Array.isArray(r.manual)) {
    const seen = new Set<string>();
    for (const x of r.manual) {
      if (!isObj(x) || typeof x.id !== "string" || !x.id || seen.has(x.id) || manual.length >= LIMITS.manual) continue;
      const f = cleanFields({
        name: str(x.name, "", LIMITS.name),
        email: str(x.email, "", LIMITS.email),
        subject: str(x.subject, "", LIMITS.subject),
        body: str(x.body, "", LIMITS.body),
      });
      seen.add(x.id); // yazılırken yarım kalmış adres de korunur; onaylı sayılması için geçerli olması gerekir
      manual.push({ id: x.id, ...f, approved: x.approved === true && manualReady(f) });
    }
  }

  const recontact: Recontact[] = [];
  if (Array.isArray(r.recontact)) {
    const seen = new Set<string>();
    for (const x of r.recontact) {
      if (!isObj(x) || typeof x.id !== "string" || !known.has(x.id) || excluded.includes(x.id) || seen.has(x.id)) continue;
      if (typeof x.at !== "string" || !validDate(x.at)) continue;
      seen.add(x.id);
      recontact.push({ id: x.id, note: str(x.note, "", LIMITS.note), at: x.at });
    }
  }

  return {
    excluded,
    selected,
    approved,
    edits,
    thresholds: {
      minFollowers: clamp(Math.round(num(t.minFollowers, DEFAULT_THRESHOLDS.minFollowers)), 0, 1_000_000),
      minEngagement: clamp(num(t.minEngagement, DEFAULT_THRESHOLDS.minEngagement), 0, 0.6),
    },
    mail: {
      brand: str(m.brand, DEFAULT_MAIL.brand, 60),
      commission: clamp(Math.round(num(m.commission, DEFAULT_MAIL.commission)), 0, 100),
      contact: str(m.contact, "", 120),
      subject: str(m.subject, DEFAULT_SUBJECT, LIMITS.subject),
      template: str(m.template, DEFAULT_TEMPLATE, LIMITS.body),
    },
    manual,
    recontact,
  };
}

export const draftBody = (s: PanelState, i: Influencer): string => s.edits[i.id] ?? fillTemplate(s.mail.template, i, s.mail);
export const draftSubject = (s: PanelState, i: Influencer): string => fillTemplate(s.mail.subject, i, s.mail);
