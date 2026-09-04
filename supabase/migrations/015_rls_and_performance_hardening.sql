begin;

-- Cover foreign keys used frequently by RLS, document generation, audit and
-- semester close workflows.
create index if not exists academic_documents_period_idx on public.academic_documents(academic_period_id);
create index if not exists academic_documents_issued_by_idx on public.academic_documents(issued_by);
create index if not exists academic_periods_closed_by_idx on public.academic_periods(closed_by);
create index if not exists document_versions_generated_by_idx on public.document_versions(generated_by);
create index if not exists enrollments_period_idx on public.enrollments(academic_period_id);
create index if not exists enrollments_created_by_idx on public.enrollments(created_by);
create index if not exists enrollments_semester_idx on public.enrollments(semester_id);
create index if not exists evaluation_periods_transition_by_idx on public.evaluation_periods(last_transition_by);
create index if not exists extraordinary_authorized_by_idx on public.extraordinary_evaluations(authorized_by);
create index if not exists extraordinary_captured_by_idx on public.extraordinary_evaluations(captured_by);
create index if not exists grade_change_history_actor_idx on public.grade_change_history(actor_id);
create index if not exists grade_change_requests_requested_by_idx on public.grade_change_requests(requested_by);
create index if not exists grade_change_requests_resolved_by_idx on public.grade_change_requests(resolved_by);
create index if not exists grade_publications_eval_idx on public.grade_publications(evaluation_period_id);
create index if not exists grade_publications_published_by_idx on public.grade_publications(published_by);
create index if not exists grades_created_by_idx on public.grades(created_by);
create index if not exists grades_eval_idx on public.grades(evaluation_period_id);
create index if not exists grades_publication_idx on public.grades(publication_id);
create index if not exists grades_published_by_idx on public.grades(published_by);
create index if not exists grades_updated_by_idx on public.grades(updated_by);
create index if not exists groups_generation_idx on public.groups(generation_id);
create index if not exists groups_semester_idx on public.groups(semester_id);
create index if not exists institution_settings_current_period_idx on public.institution_settings(current_period_id);
create index if not exists institution_settings_updated_by_idx on public.institution_settings(updated_by);
create index if not exists sse_subject_idx on public.student_subject_enrollments(subject_id);
create index if not exists teacher_assignments_period_idx on public.teacher_assignments(academic_period_id);
create index if not exists teacher_assignments_created_by_idx on public.teacher_assignments(created_by);
create index if not exists teacher_assignments_group_idx on public.teacher_assignments(group_id);
create index if not exists user_roles_granted_by_idx on public.user_roles(granted_by);

-- Avoid reevaluating auth.uid() once per row at scale.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id=(select auth.uid()) or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated using (
  user_id=(select auth.uid()) or public.current_user_has_role('SUPERADMIN') or public.current_user_has_role('CONTROL_ESCOLAR')
);

drop policy if exists change_requests_select on public.grade_change_requests;
create policy change_requests_select on public.grade_change_requests for select to authenticated using (
  requested_by=(select auth.uid()) or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

commit;
