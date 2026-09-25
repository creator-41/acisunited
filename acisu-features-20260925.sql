-- Acısu United projesine özeldir. ANT Turnuva veritabanında çalıştırmayın.
alter table public.acisu_matches add column is_live boolean not null default false;
alter table public.acisu_matches drop constraint scores_match_status;
alter table public.acisu_matches add constraint scores_match_status check (
  not (played and is_live)
  and (
    ((played or is_live) and our_score is not null and their_score is not null)
    or (not played and not is_live and our_score is null and their_score is null)
  )
);

create table public.acisu_player_stats (
  match_id uuid not null references public.acisu_matches(id) on delete cascade,
  player_id uuid not null references public.acisu_players(id) on delete cascade,
  played boolean not null default false,
  goals integer not null default 0 check (goals between 0 and 99),
  assists integer not null default 0 check (assists between 0 and 99),
  yellow_cards integer not null default 0 check (yellow_cards between 0 and 9),
  red_cards integer not null default 0 check (red_cards between 0 and 9),
  primary key (match_id, player_id)
);
create index acisu_player_stats_player_idx on public.acisu_player_stats(player_id);

create table public.acisu_goal_log (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.acisu_matches(id) on delete cascade,
  side text not null check (side in ('acisu','opponent')),
  scorer_id uuid references public.acisu_players(id) on delete set null,
  assist_id uuid references public.acisu_players(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint goal_side_player check (
    (side = 'opponent' and scorer_id is null and assist_id is null)
    or (side = 'acisu' and scorer_id is not null and scorer_id is distinct from assist_id)
  )
);
create index acisu_goal_log_match_idx on public.acisu_goal_log(match_id,created_at);

create table public.acisu_news (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.acisu_matches(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 180),
  body text not null check (length(trim(body)) between 1 and 1500),
  published boolean not null default true,
  auto_generated boolean not null default false,
  created_at timestamptz not null default now()
);
create index acisu_news_recent_idx on public.acisu_news(created_at desc);

create table public.acisu_seasons (
  season_year integer primary key check (season_year between 2020 and 2100),
  matches_count integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  top_scorer text,
  top_assister text,
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now()
);

create table public.acisu_push_subscriptions (
  endpoint text primary key check (length(endpoint) between 20 and 2048 and endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) between 20 and 512),
  auth text not null check (length(auth) between 8 and 512),
  created_at timestamptz not null default now()
);

alter table public.acisu_player_stats enable row level security;
alter table public.acisu_goal_log enable row level security;
alter table public.acisu_news enable row level security;
alter table public.acisu_seasons enable row level security;
alter table public.acisu_push_subscriptions enable row level security;

revoke all on public.acisu_player_stats, public.acisu_goal_log, public.acisu_news,
  public.acisu_seasons, public.acisu_push_subscriptions from anon, authenticated;
grant select on public.acisu_player_stats, public.acisu_goal_log, public.acisu_news,
  public.acisu_seasons to anon, authenticated;
grant insert,update,delete on public.acisu_player_stats, public.acisu_goal_log,
  public.acisu_news, public.acisu_seasons to authenticated;

create policy "Read published match stats" on public.acisu_player_stats
  for select to anon,authenticated using (
    exists (select 1 from public.acisu_matches m where m.id=match_id and m.published)
    or exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid()))
  );
create policy "Admin writes stats" on public.acisu_player_stats
  for all to authenticated
  using (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())))
  with check (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())));

create policy "Read published goals" on public.acisu_goal_log
  for select to anon,authenticated using (
    exists (select 1 from public.acisu_matches m where m.id=match_id and m.published)
    or exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid()))
  );
create policy "Admin writes goals" on public.acisu_goal_log
  for all to authenticated
  using (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())))
  with check (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())));

create policy "Read published news" on public.acisu_news
  for select to anon,authenticated using (published or exists (
    select 1 from public.acisu_admins a where a.user_id=(select auth.uid())
  ));
create policy "Admin writes news" on public.acisu_news
  for all to authenticated
  using (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())))
  with check (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())));

create policy "Read seasons" on public.acisu_seasons
  for select to anon,authenticated using (true);
create policy "Admin writes seasons" on public.acisu_seasons
  for all to authenticated
  using (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())))
  with check (exists (select 1 from public.acisu_admins a where a.user_id=(select auth.uid())));

-- Tek işlemde skor, gol kaydı ve oyuncu istatistikleri güncellenir.
create function public.acisu_record_live_goal(
  p_match_id uuid, p_side text, p_scorer_id uuid default null, p_assist_id uuid default null
) returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists(select 1 from public.acisu_admins a where a.user_id=auth.uid()) then
    raise exception 'Yönetici yetkisi gerekli';
  end if;
  if p_side not in ('acisu','opponent')
     or (p_side='acisu' and (p_scorer_id is null or p_scorer_id=p_assist_id))
     or (p_side='opponent' and (p_scorer_id is not null or p_assist_id is not null)) then
    raise exception 'Geçersiz gol bilgisi';
  end if;
  if p_side='acisu' then
    if not exists(select 1 from public.acisu_players where id=p_scorer_id)
       or (p_assist_id is not null and not exists(select 1 from public.acisu_players where id=p_assist_id)) then
      raise exception 'Oyuncu bulunamadı';
    end if;
  end if;
  update public.acisu_matches
    set our_score=our_score+case when p_side='acisu' then 1 else 0 end,
        their_score=their_score+case when p_side='opponent' then 1 else 0 end
    where id=p_match_id and is_live and not played;
  if not found then raise exception 'Canlı maç bulunamadı'; end if;
  insert into public.acisu_goal_log(match_id,side,scorer_id,assist_id)
    values(p_match_id,p_side,p_scorer_id,p_assist_id);
  if p_scorer_id is not null then
    insert into public.acisu_player_stats(match_id,player_id,played,goals)
      values(p_match_id,p_scorer_id,true,1)
    on conflict(match_id,player_id) do update set
      played=true,goals=public.acisu_player_stats.goals+1;
  end if;
  if p_assist_id is not null then
    insert into public.acisu_player_stats(match_id,player_id,played,assists)
      values(p_match_id,p_assist_id,true,1)
    on conflict(match_id,player_id) do update set
      played=true,assists=public.acisu_player_stats.assists+1;
  end if;
end $$;
revoke all on function public.acisu_record_live_goal(uuid,text,uuid,uuid) from public,anon;
grant execute on function public.acisu_record_live_goal(uuid,text,uuid,uuid) to authenticated;

alter publication supabase_realtime add table public.acisu_matches;
