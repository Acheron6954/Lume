-- Yanıt takibi ve DM kayıtları. Yalnızca ekleme yapar; mevcut veriye dokunmaz.

-- 1) Gönderilen maillerin Gmail konuşma kimliği ve ulaşmadı (bounce) işareti
alter table public.sent_mail
  add column if not exists gmail_thread_id text,
  add column if not exists bounced_at timestamptz;

create index if not exists sent_mail_influencer_idx on public.sent_mail (influencer_id, sent_at desc);

-- 2) DM kayıtları (daha önce yalnızca tarayıcıda tutuluyordu)
create table if not exists public.dm_items (
  id text primary key,                       -- "<influencer_id>:<kanal>"
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  channel text not null check (channel in ('instagram', 'tiktok')),
  text text not null default '',
  approved boolean not null default false,
  sent_at timestamptz,
  replied_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (influencer_id, channel)
);

create table if not exists public.dm_settings (
  id text primary key check (id = 'main'),
  template text not null,
  updated_at timestamptz not null default now()
);

-- Tarayıcı anahtarıyla erişilemesin: RLS açık, politika yok. Sunucu service key ile okur/yazar.
alter table public.dm_items enable row level security;
alter table public.dm_settings enable row level security;

-- 3) Sunucu (service_role) yetkileri. Bu tablolar yetkisiz oluşturulmuştu; Gmail bağlama 42501 ile kaydedemiyordu.
-- Yalnızca service_role'a verilir; tarayıcı anahtarı (anon/authenticated) erişemez.
grant select, insert, update, delete on table public.gmail_auth to service_role;
grant select, insert, update, delete on table public.sent_mail to service_role;
grant select, insert, update, delete on table public.dm_items to service_role;
grant select, insert, update, delete on table public.dm_settings to service_role;
