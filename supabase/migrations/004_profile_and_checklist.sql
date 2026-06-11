-- Novas colunas de perfil e progresso em memberships
alter table public.memberships
  add column if not exists nickname          text,
  add column if not exists baby_name         text,
  add column if not exists last_period_date  date,
  add column if not exists due_date          date,
  add column if not exists last_page         int default 1;

-- Tabela de progresso do checklist interativo
create table if not exists public.checklist_progress (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_key   text not null,
  checked    boolean not null default false,
  checked_at timestamptz,
  constraint checklist_progress_user_item unique (user_id, item_key)
);

alter table public.checklist_progress enable row level security;

create policy "own checklist read"
  on public.checklist_progress for select
  using (auth.uid() = user_id);

create policy "own checklist insert"
  on public.checklist_progress for insert
  with check (auth.uid() = user_id);

create policy "own checklist update"
  on public.checklist_progress for update
  using (auth.uid() = user_id);
