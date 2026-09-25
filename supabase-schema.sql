-- Acısu United: ayrı bir Supabase projesinde bir kez çalıştırın.
create table public.acisu_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.acisu_players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  number integer not null unique check (number between 0 and 99),
  position text not null check (length(trim(position)) between 1 and 20),
  rating integer not null default 70 check (rating between 0 and 99),
  pace integer not null default 70 check (pace between 0 and 99),
  passing integer not null default 70 check (passing between 0 and 99),
  defense integer not null default 70 check (defense between 0 and 99),
  image_url text check (image_url is null or length(image_url) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.acisu_matches (
  id uuid primary key default gen_random_uuid(),
  opponent text not null check (length(trim(opponent)) between 1 and 100),
  match_at timestamptz not null,
  time_confirmed boolean not null default true,
  venue text not null default '' check (length(venue) <= 150),
  home boolean not null default true,
  played boolean not null default false,
  our_score integer check (our_score between 0 and 99),
  their_score integer check (their_score between 0 and 99),
  goal_scorers text not null default '' check (length(goal_scorers) <= 500),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint scores_match_status check (
    (played and our_score is not null and their_score is not null)
    or (not played and our_score is null and their_score is null)
  )
);

create table public.acisu_match_lineup (
  match_id uuid not null references public.acisu_matches(id) on delete cascade,
  player_id uuid not null references public.acisu_players(id) on delete cascade,
  role text not null check (role in ('ilk11', 'yedek')),
  primary key (match_id, player_id)
);

create index acisu_matches_date_idx on public.acisu_matches (match_at desc);
create index acisu_lineup_player_idx on public.acisu_match_lineup (player_id);

alter table public.acisu_admins enable row level security;
alter table public.acisu_players enable row level security;
alter table public.acisu_matches enable row level security;
alter table public.acisu_match_lineup enable row level security;

revoke all on public.acisu_admins, public.acisu_players, public.acisu_matches, public.acisu_match_lineup from anon, authenticated;
grant select on public.acisu_players, public.acisu_matches, public.acisu_match_lineup to anon;
grant select on public.acisu_admins, public.acisu_players, public.acisu_matches, public.acisu_match_lineup to authenticated;
grant select on public.acisu_admins to anon;
grant insert, update, delete on public.acisu_players, public.acisu_matches, public.acisu_match_lineup to authenticated;

create policy "Admin sees own membership" on public.acisu_admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Public reads active players" on public.acisu_players
  for select to anon, authenticated
  using (active or exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins insert players" on public.acisu_players
  for insert to authenticated
  with check (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins update players" on public.acisu_players
  for update to authenticated
  using (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins delete players" on public.acisu_players
  for delete to authenticated
  using (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));

create policy "Public reads published matches" on public.acisu_matches
  for select to anon, authenticated
  using (published or exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins insert matches" on public.acisu_matches
  for insert to authenticated
  with check (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins update matches" on public.acisu_matches
  for update to authenticated
  using (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins delete matches" on public.acisu_matches
  for delete to authenticated
  using (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));

create policy "Public reads published lineups" on public.acisu_match_lineup
  for select to anon, authenticated
  using (exists (
    select 1 from public.acisu_matches m
    where m.id = match_id and (m.published or exists (
      select 1 from public.acisu_admins where user_id = (select auth.uid())
    ))
  ));
create policy "Admins insert lineup" on public.acisu_match_lineup
  for insert to authenticated
  with check (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins update lineup" on public.acisu_match_lineup
  for update to authenticated
  using (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));
create policy "Admins delete lineup" on public.acisu_match_lineup
  for delete to authenticated
  using (exists (select 1 from public.acisu_admins where user_id = (select auth.uid())));

-- Mevcut taslak kadrosunu ve son maçını ilk yayında koru.
insert into public.acisu_players (name, number, position, rating, pace, passing, defense, image_url) values
('Mert Ali', 1, 'KL', 88, 82, 84, 89, 'mert_ali.png'),
('Utku', 4, 'STP', 85, 78, 75, 88, 'utku.png'),
('Yasir', 7, 'OS', 89, 86, 88, 82, 'yasir.png'),
('Muhammed', 8, 'OS', 86, 84, 85, 80, 'muhammed.png'),
('Hamza', 9, 'FOR', 92, 94, 86, 45, 'hamza.png'),
('Enes', 10, 'OS', 90, 88, 91, 72, 'enes.png'),
('Emrullah', 20, 'DEF', 96, 97, 95, 96, 'emrullah.png'),
('Recep', 41, 'DEF', 86, 81, 78, 89, 'recep.png'),
('Yusuf', 99, 'FOR', 88, 91, 80, 48, 'yusuf.png');

-- Eski taslakta maç saati bulunmuyor; tarih temsili olarak 12:00 saklanır,
-- time_confirmed=false olduğu için sitede yalnızca tarih gösterilir.
insert into public.acisu_matches
  (opponent, match_at, time_confirmed, venue, home, played, our_score, their_score, goal_scorers)
values ('FACİA', '2026-09-16 12:00:00+03', false, 'Kartepe Sporium Kompleksi',
        true, true, 5, 6, 'Hamza 4, Yasir 1');

-- Oyuncu fotoğrafları için yalnızca Acısu yöneticileri yükleme ve silme yapabilir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('acisu-player-photos', 'acisu-player-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Acisu admins upload player photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'acisu-player-photos' and exists (
      select 1 from public.acisu_admins a where a.user_id = (select auth.uid())
    )
  );
create policy "Acisu admins list player photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'acisu-player-photos' and exists (
      select 1 from public.acisu_admins a where a.user_id = (select auth.uid())
    )
  );
create policy "Acisu admins delete player photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'acisu-player-photos' and exists (
      select 1 from public.acisu_admins a where a.user_id = (select auth.uid())
    )
  );
