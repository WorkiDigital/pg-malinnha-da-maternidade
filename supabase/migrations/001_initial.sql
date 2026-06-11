-- ============================================================
-- Espaço da Maternidade — Schema inicial
-- Rodar no Supabase SQL Editor
-- ============================================================

-- Perfis de acesso (1 linha por cliente)
create table if not exists public.memberships (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'active',      -- active | revoked
  product_id    text,
  product_name  text,
  order_id      text,
  source        text default 'kiwify',
  granted_at    timestamptz default now(),
  revoked_at    timestamptz,
  updated_at    timestamptz default now()
);

-- Log de eventos recebidos (auditoria + idempotência)
create table if not exists public.webhook_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text default 'kiwify',
  event_type  text,
  order_id    text,
  email       text,
  raw         jsonb,
  received_at timestamptz default now(),
  unique (provider, order_id, event_type)
);

-- Produtos da vitrine
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price_cents  int,
  checkout_url text,
  cover_emoji  text,
  is_main      boolean default false,
  sort         int default 0
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.memberships enable row level security;
alter table public.products enable row level security;
alter table public.webhook_events enable row level security;

-- usuário só vê o próprio membership
create policy "own membership read" on public.memberships
  for select using (auth.uid() = user_id);

-- vitrine pública
create policy "public read products" on public.products
  for select using (true);

-- webhook_events: somente service_role (sem policy pública)

-- ============================================================
-- Dados iniciais da vitrine
-- ============================================================
insert into public.products (name, description, price_cents, checkout_url, cover_emoji, is_main, sort) values
  ('Malinha da Maternidade',   'O checklist completo da mãe, do bebê e do acompanhante. Leia no formato livro animado.', 1970, null,                                     '🎒', true,  0),
  ('Checklist do Enxoval Completo', 'Tudo o que comprar antes do bebê chegar — com as quantidades certas, sem gastar à toa.', 2490, 'https://pay.kiwify.com.br/CHECKOUT_ENXOVAL', '👶', false, 1),
  ('Plano de Parto Editável',  'Modelo pronto para preencher e levar à maternidade. Suas vontades, registradas.',          1790, 'https://pay.kiwify.com.br/CHECKOUT_PLANO',   '📋', false, 2),
  ('Guia dos Primeiros 30 Dias','O que esperar e como se organizar nos primeiros dias do bebê em casa.',                  1990, 'https://pay.kiwify.com.br/CHECKOUT_GUIA',    '🍼', false, 3);
