ALTER TABLE public.acisu_matches
  ADD COLUMN IF NOT EXISTS lineup_formation text NOT NULL DEFAULT '2-3-1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'acisu_matches_lineup_formation_check'
      AND conrelid = 'public.acisu_matches'::regclass
  ) THEN
    ALTER TABLE public.acisu_matches
      ADD CONSTRAINT acisu_matches_lineup_formation_check
      CHECK (lineup_formation IN ('2-3-1', '3-2-1', '2-2-2'));
  END IF;
END $$;

ALTER TABLE public.acisu_match_lineup
  ADD COLUMN IF NOT EXISTS slot_index smallint;

WITH ordered AS (
  SELECT
    lineup.match_id,
    lineup.player_id,
    row_number() OVER (
      PARTITION BY lineup.match_id
      ORDER BY
        CASE WHEN lineup.role = 'ilk11' THEN 0 ELSE 1 END,
        CASE
          WHEN lineup.role = 'ilk11'
            AND lower(player.position) ~ '(kaleci|goalkeeper|^gk$)' THEN 0
          ELSE 1
        END,
        player.number,
        lineup.player_id
    )::smallint AS slot_index
  FROM public.acisu_match_lineup AS lineup
  JOIN public.acisu_players AS player ON player.id = lineup.player_id
  WHERE lineup.slot_index IS NULL
)
UPDATE public.acisu_match_lineup AS lineup
SET slot_index = ordered.slot_index
FROM ordered
WHERE lineup.match_id = ordered.match_id
  AND lineup.player_id = ordered.player_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'acisu_match_lineup_slot_index_check'
      AND conrelid = 'public.acisu_match_lineup'::regclass
  ) THEN
    ALTER TABLE public.acisu_match_lineup
      ADD CONSTRAINT acisu_match_lineup_slot_index_check
      CHECK (slot_index BETWEEN 1 AND 11);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'acisu_match_lineup_match_slot_unique'
      AND conrelid = 'public.acisu_match_lineup'::regclass
  ) THEN
    ALTER TABLE public.acisu_match_lineup
      ADD CONSTRAINT acisu_match_lineup_match_slot_unique
      UNIQUE (match_id, slot_index);
  END IF;
END $$;