-- Policy: só membros ativos podem acessar o bucket ebooks
create policy "active members read ebooks"
  on storage.objects for select
  using (
    bucket_id = 'ebooks'
    and exists (
      select 1 from public.memberships
      where user_id = auth.uid()
      and status = 'active'
    )
  );
