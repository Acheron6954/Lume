-- Herkese açık site: kreatör başvuruları ve panel üyelikleri (onaylı giriş).
-- RLS açık, politika yok: tarayıcı anahtarı erişemez; yalnızca sunucu (service_role) okur/yazar.
create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  instagram text,
  tiktok text,
  niche text not null,
  name text not null,
  email text not null,
  whatsapp text,
  city text not null,
  kvkk_at timestamptz not null,
  disclosure_at timestamptz not null,
  ip_hash text,
  status text not null default 'yeni' check (status in ('yeni','incelendi','kabul','red')),
  created_at timestamptz not null default now(),
  check (instagram is not null or tiktok is not null)
);
create index if not exists creator_applications_created_idx on public.creator_applications (created_at desc);
create index if not exists creator_applications_email_idx on public.creator_applications (lower(email));
alter table public.creator_applications enable row level security;
grant select, insert, update, delete on table public.creator_applications to service_role;

create table if not exists public.panel_members (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  pass_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  role text not null default 'viewer' check (role in ('viewer','admin')),
  kvkk_at timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists panel_members_email_key on public.panel_members (lower(email));
alter table public.panel_members enable row level security;
grant select, insert, update, delete on table public.panel_members to service_role;
