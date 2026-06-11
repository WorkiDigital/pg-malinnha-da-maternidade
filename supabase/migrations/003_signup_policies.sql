-- Permite leitura de membership por e-mail (para validar compra no signup)
create policy "read membership by email" on public.memberships
  for select using (true);

-- Permite que o próprio usuário atualize seu user_id no membership
create policy "update own membership userid" on public.memberships
  for update using (email = (select email from auth.users where id = auth.uid()));
