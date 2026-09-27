-- Acısu United sponsor yönetimi
-- Yalnızca mjnnotqrcdotklqtemgm (Acısu) Supabase projesinde çalıştırın.
-- Tekrar çalıştırılabilir; mevcut sponsor kayıtlarını değiştirmez veya silmez.

create table if not exists public.acisu_sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  logo_url text,
  website_url text check (website_url is null or website_url ~ '^https?://'),
  tier text not null default 'supporter' check (tier in ('main','supporter')),
  active boolean not null default true,
  sort_order integer not null default 0,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);
alter table public.acisu_sponsors enable row level security;
revoke all on table public.acisu_sponsors from anon, authenticated;
grant select on table public.acisu_sponsors to anon, authenticated;
grant insert, update, delete on table public.acisu_sponsors to authenticated;

drop policy if exists "Public reads active sponsors" on public.acisu_sponsors;
create policy "Public reads active sponsors" on public.acisu_sponsors
  for select to anon, authenticated
  using (
    (active and (starts_at is null or starts_at <= current_date)
      and (ends_at is null or ends_at >= current_date))
    or exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid()))
  );

drop policy if exists "Admins manage sponsors" on public.acisu_sponsors;
create policy "Admins manage sponsors" on public.acisu_sponsors
  for all to authenticated
  using (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())))
  with check (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('acisu-sponsor-logos','acisu-sponsor-logos',true,5242880,
  array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Acisu admins upload sponsor logos" on storage.objects;
create policy "Acisu admins upload sponsor logos" on storage.objects
  for insert to authenticated with check (
    bucket_id='acisu-sponsor-logos' and exists (
      select 1 from public.acisu_admins a where a.user_id=(select auth.uid())
    )
  );
drop policy if exists "Acisu admins update sponsor logos" on storage.objects;
create policy "Acisu admins update sponsor logos" on storage.objects
  for update to authenticated using (
    bucket_id='acisu-sponsor-logos' and exists (
      select 1 from public.acisu_admins a where a.user_id=(select auth.uid())
    )
  ) with check (
    bucket_id='acisu-sponsor-logos' and exists (
      select 1 from public.acisu_admins a where a.user_id=(select auth.uid())
    )
  );
drop policy if exists "Acisu admins delete sponsor logos" on storage.objects;
create policy "Acisu admins delete sponsor logos" on storage.objects
  for delete to authenticated using (
    bucket_id='acisu-sponsor-logos' and exists (
      select 1 from public.acisu_admins a where a.user_id=(select auth.uid())
    )
  );

-- Mevcut anasayfadaki sponsor kaydını korur; sadece eksikse ekler.
insert into public.acisu_sponsors(name,tier,active,sort_order)
select 'ASAY İNŞAAT','main',true,0
where not exists (select 1 from public.acisu_sponsors where name='ASAY İNŞAAT');
