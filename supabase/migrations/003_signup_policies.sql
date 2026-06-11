-- Permite leitura de membership por e-mail (para validar compra no signup)
create policy "read membership by email" on public.memberships
  for select using (true);

-- Permite que o usuário autenticado vincule seu user_id ao membership
-- O frontend faz signUp → signInWithPassword → update (já com sessão ativa)
create policy "update own membership userid" on public.memberships
  for update using (
    auth.uid() is not null
    and email = (select email from auth.users where id = auth.uid())
  );
