-- Acısu United only: save selected match scorers/assists as linked goal events.
create or replace function public.acisu_save_match_goal_events(
  p_match_id uuid,
  p_goal_events jsonb
)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  current_match record;
  has_match_lineup boolean;
begin
  if not exists (
    select 1 from public.acisu_admins a where a.user_id = (select auth.uid())
  ) then
    raise exception 'Yönetici yetkisi gerekli';
  end if;

  if p_goal_events is null or jsonb_typeof(p_goal_events) <> 'array' then
    raise exception 'Gol bilgisi geçersiz';
  end if;

  select m.id, m.played, m.is_live, m.our_score
    into current_match
    from public.acisu_matches m
    where m.id = p_match_id
    for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if current_match.is_live then raise exception 'Canlı maç golleri Canlı Maç sekmesinden yönetilir'; end if;
  if current_match.played and jsonb_array_length(p_goal_events) <> coalesce(current_match.our_score, 0) then
    raise exception 'Gol sayısı maç skoruyla uyuşmuyor';
  end if;
  if not current_match.played and jsonb_array_length(p_goal_events) > 0 then
    raise exception 'Oynanmamış maça gol yazılamaz';
  end if;

  select exists (
    select 1 from public.acisu_match_lineup l where l.match_id = p_match_id
  ) into has_match_lineup;

  if exists (
    select 1
    from jsonb_to_recordset(p_goal_events) as e(scorer_id uuid, assist_id uuid)
    where e.scorer_id is null
       or e.scorer_id = e.assist_id
       or (has_match_lineup and not exists (
         select 1 from public.acisu_match_lineup l
         where l.match_id = p_match_id and l.player_id = e.scorer_id
       ))
       or (not has_match_lineup and not exists (
         select 1 from public.acisu_players p where p.id = e.scorer_id and p.active
       ))
       or (e.assist_id is not null and has_match_lineup and not exists (
         select 1 from public.acisu_match_lineup l
         where l.match_id = p_match_id and l.player_id = e.assist_id
       ))
       or (e.assist_id is not null and not has_match_lineup and not exists (
         select 1 from public.acisu_players p where p.id = e.assist_id and p.active
       ))
  ) then
    raise exception 'Golcü ve asist bu maçın kadrosunda olmalı; golcü kendine asist yapamaz';
  end if;

  delete from public.acisu_goal_log
  where match_id = p_match_id and side = 'acisu';

  insert into public.acisu_goal_log(match_id, side, scorer_id, assist_id)
  select p_match_id, 'acisu', e.scorer_id, e.assist_id
  from jsonb_to_recordset(p_goal_events) as e(scorer_id uuid, assist_id uuid);

  update public.acisu_player_stats
  set goals = 0, assists = 0
  where match_id = p_match_id;

  insert into public.acisu_player_stats(match_id, player_id, played, goals, assists)
  select p_match_id, credits.player_id, true, credits.goals, credits.assists
  from (
    select credited.player_id,
           count(*) filter (where credited.credit = 'goal')::integer as goals,
           count(*) filter (where credited.credit = 'assist')::integer as assists
    from (
      select e.scorer_id as player_id, 'goal'::text as credit
      from jsonb_to_recordset(p_goal_events) as e(scorer_id uuid, assist_id uuid)
      union all
      select e.assist_id as player_id, 'assist'::text as credit
      from jsonb_to_recordset(p_goal_events) as e(scorer_id uuid, assist_id uuid)
      where e.assist_id is not null
    ) credited
    group by credited.player_id
  ) credits
  on conflict (match_id, player_id) do update set
    played = true,
    goals = excluded.goals,
    assists = excluded.assists;

  update public.acisu_matches m
  set goal_scorers = (
    select coalesce(string_agg(
      case when credits.goal_count > 1 then p.name || ' ' || credits.goal_count::text else p.name end,
      ', ' order by p.number
    ), '')
    from (
      select e.scorer_id, count(*)::integer as goal_count
      from jsonb_to_recordset(p_goal_events) as e(scorer_id uuid, assist_id uuid)
      group by e.scorer_id
    ) credits
    join public.acisu_players p on p.id = credits.scorer_id
  )
  where m.id = p_match_id;
end;
$function$;

revoke all on function public.acisu_save_match_goal_events(uuid, jsonb) from public, anon;
grant execute on function public.acisu_save_match_goal_events(uuid, jsonb) to authenticated;
