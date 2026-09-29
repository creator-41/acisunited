alter table public.acisu_match_lineup
  add column if not exists is_captain boolean not null default false;

alter table public.acisu_match_lineup
  add constraint acisu_lineup_captain_is_starter
  check (not is_captain or role = 'ilk11');

create unique index if not exists acisu_match_one_captain_idx
  on public.acisu_match_lineup (match_id)
  where is_captain;
