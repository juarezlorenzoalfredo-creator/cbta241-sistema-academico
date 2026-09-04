begin;

-- Publication header counts are part of the immutable publication evidence.
alter table public.grade_publications
  drop constraint if exists grade_publications_counts_consistent;
alter table public.grade_publications
  add constraint grade_publications_counts_consistent
  check (row_count = numeric_count + np_count);

-- Composite identity lets every published grade prove it belongs to the same
-- assignment/evaluation publication it references.
alter table public.grade_publications
  drop constraint if exists grade_publications_identity_unique;
alter table public.grade_publications
  add constraint grade_publications_identity_unique
  unique(id,assignment_id,evaluation_period_id);

alter table public.grades drop constraint if exists grades_publication_fk;
alter table public.grades drop constraint if exists grades_publication_context_fk;
alter table public.grades
  add constraint grades_publication_context_fk
  foreign key(publication_id,assignment_id,evaluation_period_id)
  references public.grade_publications(id,assignment_id,evaluation_period_id);

alter table public.grades drop constraint if exists grades_check1;
alter table public.grades drop constraint if exists grades_publication_state_consistency;
alter table public.grades
  add constraint grades_publication_state_consistency
  check (
    (state='DRAFT' and published_at is null and published_by is null and publication_id is null)
    or
    (state='PUBLISHED' and published_at is not null and published_by is not null and publication_id is not null)
  );

-- Audit rows are append-only through trusted workflows only.
revoke execute on function public.write_audit(text,text,uuid,jsonb,jsonb,text,jsonb) from public, anon, authenticated;
revoke insert,update,delete,truncate on public.audit_logs from anon, authenticated;

commit;
