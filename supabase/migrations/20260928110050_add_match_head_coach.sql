ALTER TABLE public.acisu_matches
  ADD COLUMN IF NOT EXISTS head_coach_id uuid
  REFERENCES public.acisu_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS acisu_matches_head_coach_id_idx
  ON public.acisu_matches(head_coach_id);