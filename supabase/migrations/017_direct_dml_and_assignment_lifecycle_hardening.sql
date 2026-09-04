begin;

-- Browser/API roles get read-only table access. All domain mutations go through
-- reviewed RPC workflows; the only client-side column updates are display name
-- and notification read timestamp.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(read_at) on public.notifications to authenticated;

-- Remove permissive write policies now that writes are RPC-only.
drop policy if exists user_roles_all_superadmin on public.user_roles;
drop policy if exists academic_periods_control_write on public.academic_periods;
drop policy if exists semesters_control_write on public.semesters;
drop policy if exists generations_control_write on public.generations;
drop policy if exists groups_control_write on public.groups;
drop policy if exists subjects_control_write on public.subjects;
drop policy if exists evaluation_periods_control_write on public.evaluation_periods;
drop policy if exists students_control_write on public.students;
drop policy if exists teachers_control_write on public.teachers;
drop policy if exists enrollments_control_write on public.enrollments;
drop policy if exists assignments_control_write on public.teacher_assignments;
drop policy if exists sse_control_write on public.student_subject_enrollments;
drop policy if exists documents_control_write on public.academic_documents;
drop policy if exists document_versions_control_write on public.document_versions;
drop policy if exists institution_settings_admin on public.institution_settings;

-- Never expose the generic audit writer directly to an authenticated client.
revoke execute on function public.write_audit(text,text,uuid,jsonb,jsonb,text,jsonb) from public, anon, authenticated;

-- Closing and opening responsibilities inside one transaction must still satisfy
-- active_until > active_from. clock_timestamp() is not transaction-stable.
create or replace function public.replace_teacher_assignment_workflow(
  p_assignment_id uuid,
  p_new_teacher_id uuid,
  p_reason text
) returns public.teacher_assignments
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_old public.teacher_assignments;
  v_new public.teacher_assignments;
  v_closed_at timestamptz;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if not exists(select 1 from public.teachers where id=p_new_teacher_id and is_active) then raise exception 'ACTIVE_TEACHER_REQUIRED'; end if;
  select * into v_old from public.teacher_assignments where id=p_assignment_id for update;
  if not found or not v_old.is_active then raise exception 'ACTIVE_ASSIGNMENT_REQUIRED'; end if;
  if v_old.teacher_id=p_new_teacher_id then raise exception 'SAME_TEACHER'; end if;
  if exists(select 1 from public.academic_periods where id=v_old.academic_period_id and is_closed) then raise exception 'PERIOD_CLOSED'; end if;

  v_closed_at := greatest(clock_timestamp(), v_old.active_from + interval '1 microsecond');
  update public.teacher_assignments set is_active=false,active_until=v_closed_at where id=v_old.id;
  insert into public.teacher_assignments(teacher_id,subject_id,group_id,academic_period_id,active_from,created_by)
  values(p_new_teacher_id,v_old.subject_id,v_old.group_id,v_old.academic_period_id,v_closed_at,auth.uid())
  returning * into v_new;

  perform public.write_audit('ASSIGNMENT_CHANGED','teacher_assignments',v_new.id,to_jsonb(v_old),to_jsonb(v_new),p_reason,jsonb_build_object('previous_assignment_id',v_old.id));
  return v_new;
end;
$$;
revoke execute on function public.replace_teacher_assignment_workflow(uuid,uuid,text) from public, anon;
grant execute on function public.replace_teacher_assignment_workflow(uuid,uuid,text) to authenticated;

commit;
