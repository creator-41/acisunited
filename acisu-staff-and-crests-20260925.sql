-- Only for the Acısu United Supabase project (mjnnotqrcdotklqtemgm).
create table public.acisu_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  role text not null check (length(trim(role)) between 1 and 40),
  rating integer not null default 70 check (rating between 0 and 99),
  pace integer not null default 70 check (pace between 0 and 99),
  passing integer not null default 70 check (passing between 0 and 99),
  defense integer not null default 70 check (defense between 0 and 99),
  image_url text check (image_url is null or length(image_url) <= 500),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index acisu_staff_order_idx on public.acisu_staff (sort_order, created_at);
alter table public.acisu_staff enable row level security;
grant select on public.acisu_staff to anon, authenticated;
grant insert, update, delete on public.acisu_staff to authenticated;
create policy "Public reads active staff" on public.acisu_staff
  for select to anon, authenticated using (
    active or exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  );
create policy "Admins insert staff" on public.acisu_staff
  for insert to authenticated with check (
    exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  );
create policy "Admins update staff" on public.acisu_staff
  for update to authenticated using (
    exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  );
create policy "Admins delete staff" on public.acisu_staff
  for delete to authenticated using (
    exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  );

alter table public.acisu_matches add column opponent_image_url text
  check (opponent_image_url is null or length(opponent_image_url) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('acisu-site-media', 'acisu-site-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);
create policy "Acisu admins upload site media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'acisu-site-media' and
    exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  );
create policy "Acisu admins list site media" on storage.objects
  for select to authenticated using (
    bucket_id = 'acisu-site-media' and
    exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  );
create policy "Acisu admins delete site media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'acisu-site-media' and
    exists (select 1 from public.acisu_admins where user_id = (select auth.uid()))
  );

insert into public.acisu_staff (name, role, rating, pace, passing, defense, image_url)
values ('Bünyamin', 'T.D.', 95, 90, 96, 94, 'bunyamin.png');
