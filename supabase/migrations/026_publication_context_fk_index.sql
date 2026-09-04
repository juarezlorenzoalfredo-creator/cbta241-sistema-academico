begin;

-- Cover the composite FK used to bind each published grade to the exact
-- assignment/evaluation publication header. This avoids FK maintenance scans.
create index if not exists grades_publication_context_idx
  on public.grades(publication_id,assignment_id,evaluation_period_id)
  where publication_id is not null;

commit;
