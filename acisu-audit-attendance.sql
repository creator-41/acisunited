-- Acısu United only. Admin activity and anonymous match attendance.
create schema if not exists acisu_private;
revoke all on schema acisu_private from public;

create table if not exists public.acisu_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null check (action in ('INSERT','UPDATE','DELETE','LOGIN')),
  entity text not null,
  record_id text,
  summary text,
  created_at timestamptz not null default now()
);
create index if not exists acisu_admin_audit_created_at_idx
  on public.acisu_admin_audit (created_at desc);
alter table public.acisu_admin_audit enable row level security;
revoke all on public.acisu_admin_audit from public, anon, authenticated;
grant select on public.acisu_admin_audit to authenticated;
drop policy if exists "Acisu admins read audit" on public.acisu_admin_audit;
create policy "Acisu admins read audit" on public.acisu_admin_audit
  for select to authenticated
  using (exists (
    select 1 from public.acisu_admins a where a.user_id = (select auth.uid())
  ));

create or replace function acisu_private.record_admin_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb;
  v_actor uuid := auth.uid();
  v_email text;
begin
  if tg_op = 'UPDATE' and to_jsonb(new) = to_jsonb(old) then return new; end if;
  if tg_op = 'DELETE' then v_row := to_jsonb(old);
  else v_row := to_jsonb(new); end if;
  if v_actor is not null then
    select email into v_email from auth.users where id = v_actor;
  end if;
  insert into public.acisu_admin_audit(actor_id, actor_email, action, entity, record_id, summary)
  values (
    v_actor, v_email, tg_op, tg_table_name,
    coalesce(v_row->>'id', v_row->>'match_id', v_row->>'player_id'),
    left(coalesce(v_row->>'name', v_row->>'opponent', v_row->>'title',
      v_row->>'season_year', v_row->>'match_id', ''), 180)
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function acisu_private.record_admin_change() from public, anon, authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'acisu_players','acisu_staff','acisu_matches','acisu_match_lineup',
    'acisu_goal_log','acisu_player_stats','acisu_news','acisu_sponsors','acisu_seasons'
  ] loop
    execute format('drop trigger if exists acisu_admin_audit_trigger on public.%I', v_table);
    execute format(
      'create trigger acisu_admin_audit_trigger after insert or update or delete on public.%I
       for each row execute function acisu_private.record_admin_change()', v_table
    );
  end loop;
end;
$$;

create or replace function public.acisu_record_admin_login()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.acisu_admins where user_id = v_actor
  ) then raise exception 'Yönetici yetkisi gerekli'; end if;
  insert into public.acisu_admin_audit(actor_id, actor_email, action, entity, summary)
  select id, email, 'LOGIN', 'admin', 'Yönetim paneline giriş' from auth.users where id = v_actor;
end;
$$;
revoke all on function public.acisu_record_admin_login() from public, anon, authenticated;
grant execute on function public.acisu_record_admin_login() to authenticated;

create table if not exists public.acisu_match_attendance (
  match_id uuid not null references public.acisu_matches(id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (match_id, visitor_id)
);
create index if not exists acisu_match_attendance_match_idx
  on public.acisu_match_attendance (match_id);
alter table public.acisu_match_attendance enable row level security;
revoke all on public.acisu_match_attendance from public, anon, authenticated;
grant select on public.acisu_match_attendance to authenticated;
drop policy if exists "Acisu admins read attendance" on public.acisu_match_attendance;
create policy "Acisu admins read attendance" on public.acisu_match_attendance
  for select to authenticated
  using (exists (
    select 1 from public.acisu_admins a where a.user_id = (select auth.uid())
  ));

create or replace function public.acisu_attendance_status(p_match_id uuid, p_visitor_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_count integer; v_going boolean;
begin
  if not exists (select 1 from public.acisu_matches where id = p_match_id and published) then
    return jsonb_build_object('count', 0, 'going', false);
  end if;
  select count(*)::integer, count(*) filter (where visitor_id = p_visitor_id) > 0
    into v_count, v_going
    from public.acisu_match_attendance where match_id = p_match_id;
  return jsonb_build_object('count', v_count, 'going', v_going);
end;
$$;
revoke all on function public.acisu_attendance_status(uuid,uuid) from public, anon, authenticated;
grant execute on function public.acisu_attendance_status(uuid,uuid) to anon, authenticated;

create or replace function public.acisu_set_attendance(
  p_match_id uuid, p_visitor_id uuid, p_going boolean
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if p_visitor_id is null or p_match_id is null or p_going is null then
    raise exception 'Eksik katılım bilgisi';
  end if;
  if not exists (
    select 1 from public.acisu_matches
    where id = p_match_id and published and not played and not is_live and match_at > now()
  ) then raise exception 'Bu maç için katılım kapalı'; end if;
  if p_going then
    insert into public.acisu_match_attendance(match_id, visitor_id)
    values (p_match_id, p_visitor_id) on conflict do nothing;
  else
    delete from public.acisu_match_attendance
    where match_id = p_match_id and visitor_id = p_visitor_id;
  end if;
  return public.acisu_attendance_status(p_match_id, p_visitor_id);
end;
$$;
revoke all on function public.acisu_set_attendance(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.acisu_set_attendance(uuid,uuid,boolean) to anon, authenticated;
