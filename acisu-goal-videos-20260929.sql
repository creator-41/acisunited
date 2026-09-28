-- Acısu United only: optional links to goal videos, attached to a match and scorer.
create table if not exists public.acisu_goal_videos (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.acisu_matches(id) on delete cascade,
  player_id uuid not null references public.acisu_players(id) on delete cascade,
  video_url text not null check (length(video_url) between 10 and 2048 and video_url ~ '^https://[^[:space:]<>"'']+$'),
  title text not null default 'Gol videosu' check (length(title) between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists acisu_goal_videos_match_player_idx on public.acisu_goal_videos(match_id, player_id);
alter table public.acisu_goal_videos enable row level security;
grant select on public.acisu_goal_videos to anon, authenticated;
grant insert, update, delete on public.acisu_goal_videos to authenticated;

create policy "Read published goal videos" on public.acisu_goal_videos
for select to anon, authenticated using (
  (exists (select 1 from public.acisu_matches m where m.id = acisu_goal_videos.match_id and m.published)
   and exists (select 1 from public.acisu_goal_log g where g.match_id = acisu_goal_videos.match_id and g.scorer_id = acisu_goal_videos.player_id and g.side = 'acisu'))
  or exists (select 1 from public.acisu_admins a where a.user_id = (select auth.uid()))
);
create policy "Admin adds goal videos" on public.acisu_goal_videos
for insert to authenticated with check (
  exists (select 1 from public.acisu_admins a where a.user_id = (select auth.uid()))
  and exists (select 1 from public.acisu_goal_log g where g.match_id = acisu_goal_videos.match_id and g.scorer_id = acisu_goal_videos.player_id and g.side = 'acisu')
);
create policy "Admin edits goal videos" on public.acisu_goal_videos
for update to authenticated using (
  exists (select 1 from public.acisu_admins a where a.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.acisu_admins a where a.user_id = (select auth.uid()))
  and exists (select 1 from public.acisu_goal_log g where g.match_id = acisu_goal_videos.match_id and g.scorer_id = acisu_goal_videos.player_id and g.side = 'acisu')
);
create policy "Admin removes goal videos" on public.acisu_goal_videos
for delete to authenticated using (
  exists (select 1 from public.acisu_admins a where a.user_id = (select auth.uid()))
);

create trigger acisu_admin_audit_trigger after insert or update or delete on public.acisu_goal_videos
for each row execute function acisu_private.record_admin_change();

create or replace function acisu_private.remove_reset_goal_videos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.played and not new.played then
    delete from public.acisu_goal_videos where match_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function acisu_private.remove_reset_goal_videos() from public, anon, authenticated;
create trigger acisu_goal_videos_reset after update of played on public.acisu_matches
for each row execute function acisu_private.remove_reset_goal_videos();
