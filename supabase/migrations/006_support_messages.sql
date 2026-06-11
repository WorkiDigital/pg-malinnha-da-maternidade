-- ============================================================
-- 006 — Suporte ao Cliente (support_messages)
-- ============================================================

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text not null,
  nickname    text,
  message     text not null,
  status      text not null default 'open',  -- 'open' | 'resolved'
  admin_reply text,
  replied_at  timestamptz,
  created_at  timestamptz default now()
);

alter table public.support_messages enable row level security;

-- Cliente vê apenas as próprias mensagens
create policy "own support read"
  on public.support_messages for select
  using (auth.uid() = user_id);

-- Admin vê todas as mensagens
create policy "admin support read"
  on public.support_messages for select
  using (public.is_admin());

-- Cliente autenticado pode inserir (vinculado ao seu user_id)
create policy "auth support insert"
  on public.support_messages for insert
  with check (auth.uid() = user_id);

-- Somente admin pode atualizar (reply + status)
create policy "admin support update"
  on public.support_messages for update
  using (public.is_admin()) with check (public.is_admin());
