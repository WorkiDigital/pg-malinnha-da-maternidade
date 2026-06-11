-- ============================================================
-- 005 — Admin, Settings, Products, RLS
-- ============================================================

-- 1. Tabela de admins
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text unique not null,
  created_at timestamptz default now()
);

-- 2. Função helper is_admin() para RLS
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3. Tabela de configurações (chave-valor)
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- 4. Seeds de configurações
insert into public.settings (key, value) values
  ('welcome',       '{"title":"Bem-vinda, {nome}! 💚","body":"Que alegria ter você aqui. Esse é o seu cantinho para se preparar com calma e confiança. Comece pela sua Malinha da Maternidade — é só tocar para abrir e virar as páginas como num livro de verdade. 📖"}'),
  ('support',       '{"whatsapp":"","enabled":false}')
on conflict (key) do nothing;

-- 5. Tabela de produtos (substitui is_main; adiciona state, badge, is_active)
alter table public.products
  add column if not exists badge           text,
  add column if not exists state           text not null default 'for_sale',
  add column if not exists is_active       boolean not null default true,
  add column if not exists cover_image_url text,
  add column if not exists updated_at      timestamptz default now();

-- garante que is_main ainda existe (retrocompatibilidade)
alter table public.products
  add column if not exists is_main boolean not null default false;

-- 6. RLS — settings
alter table public.settings enable row level security;

create policy "read settings public"
  on public.settings for select using (true);

create policy "admin write settings"
  on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- 7. RLS — products
alter table public.products enable row level security;

drop policy if exists "read products" on public.products;

create policy "read active products"
  on public.products for select using (is_active = true);

create policy "admin write products"
  on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- 8. RLS — admins
alter table public.admins enable row level security;

create policy "admin read admins"
  on public.admins for select using (public.is_admin());

-- 9. RLS — memberships (adicionar políticas admin)
create policy "admin read members"
  on public.memberships for select using (public.is_admin());

create policy "admin write members"
  on public.memberships for update
  using (public.is_admin()) with check (public.is_admin());
