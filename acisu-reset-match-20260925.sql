-- Acısu United için. Yalnızca public.acisu_matches oynanmış satırlarını sıfırlar.
-- ANT Turnuva veritabanında çalıştırmayın.
create or replace function public.acisu_reset_match(p_match_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  deleted_goals integer := 0;
  deleted_stats integer := 0;
  hidden_news integer := 0;
begin
  if not exists (
    select 1 from public.acisu_admins a where a.user_id = (select auth.uid())
  ) then
    raise exception 'Yönetici yetkisi gerekli';
  end if;

  if not exists (
    select 1 from public.acisu_matches m
    where m.id = p_match_id and m.played and not m.is_live
  ) then
    raise exception 'Sıfırlanacak oynanmış maç bulunamadı';
  end if;

  delete from public.acisu_goal_log where match_id = p_match_id;
  get diagnostics deleted_goals = row_count;

  delete from public.acisu_player_stats where match_id = p_match_id;
  get diagnostics deleted_stats = row_count;

  update public.acisu_news
  set published = false
  where match_id = p_match_id and auto_generated;
  get diagnostics hidden_news = row_count;

  update public.acisu_matches
  set played = false, is_live = false,
      our_score = null, their_score = null, goal_scorers = ''
  where id = p_match_id and played and not is_live;

  if not found then
    raise exception 'Maç sıfırlanamadı';
  end if;

  return jsonb_build_object(
    'goal_events_deleted', deleted_goals,
    'player_stat_rows_deleted', deleted_stats,
    'auto_news_unpublished', hidden_news
  );
end;
$function$;

revoke all on function public.acisu_reset_match(uuid) from public, anon, authenticated;
grant execute on function public.acisu_reset_match(uuid) to authenticated;
