begin;

create or replace function public.set_student_active_workflow(
  p_student_id uuid,
  p_active boolean,
  p_reason text
) returns public.students
language plpgsql security definer
set search_path=public,auth
as $$
declare v_old public.students; v_new public.students;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_old from public.students where id=p_student_id for update;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;

  update public.students set is_active=p_active where id=p_student_id returning * into v_new;
  if not p_active then
    update public.student_subject_enrollments sse
      set status='INACTIVE'
    from public.enrollments e
    where e.id=sse.enrollment_id and e.student_id=p_student_id and sse.status='ACTIVE';
    update public.enrollments
      set status='WITHDRAWN',version=version+1
    where student_id=p_student_id and status='ACTIVE';
  end if;

  perform public.write_audit(
    case when p_active then 'STUDENT_REACTIVATED' else 'STUDENT_DEACTIVATED' end,
    'students',p_student_id,to_jsonb(v_old),to_jsonb(v_new),p_reason
  );
  return v_new;
end;
$$;

create or replace function public.set_teacher_active_workflow(
  p_teacher_id uuid,
  p_active boolean,
  p_reason text
) returns public.teachers
language plpgsql security definer
set search_path=public,auth
as $$
declare v_old public.teachers; v_new public.teachers; v_closed integer:=0;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_old from public.teachers where id=p_teacher_id for update;
  if not found then raise exception 'TEACHER_NOT_FOUND'; end if;

  update public.teachers set is_active=p_active where id=p_teacher_id returning * into v_new;
  if not p_active then
    update public.teacher_assignments
      set is_active=false,active_until=coalesce(active_until,now())
    where teacher_id=p_teacher_id and is_active;
    get diagnostics v_closed = row_count;
  end if;

  perform public.write_audit(
    case when p_active then 'TEACHER_REACTIVATED' else 'TEACHER_DEACTIVATED' end,
    'teachers',p_teacher_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,
    jsonb_build_object('assignments_closed',v_closed)
  );
  return v_new;
end;
$$;

-- Assignment creation validates all active boundaries server-side.
create or replace function public.assign_teacher_workflow(
  p_teacher_id uuid,p_subject_id uuid,p_group_id uuid,p_period_id uuid
) returns public.teacher_assignments
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.teacher_assignments;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if not exists(select 1 from public.teachers where id=p_teacher_id and is_active) then raise exception 'ACTIVE_TEACHER_REQUIRED'; end if;
  if not exists(select 1 from public.subjects where id=p_subject_id and is_active) then raise exception 'ACTIVE_SUBJECT_REQUIRED'; end if;
  if not exists(select 1 from public.groups where id=p_group_id and academic_period_id=p_period_id and is_active) then raise exception 'ACTIVE_GROUP_PERIOD_MISMATCH'; end if;
  if exists(select 1 from public.academic_periods where id=p_period_id and is_closed) then raise exception 'PERIOD_CLOSED'; end if;

  insert into public.teacher_assignments(teacher_id,subject_id,group_id,academic_period_id,created_by)
  values(p_teacher_id,p_subject_id,p_group_id,p_period_id,auth.uid()) returning * into v;
  perform public.write_audit('ASSIGNMENT_CREATED','teacher_assignments',v.id,null,to_jsonb(v));
  return v;
exception when unique_violation then
  raise exception 'RESPONSIBLE_TEACHER_ALREADY_ASSIGNED';
end;
$$;

-- Substitution closes the previous responsibility without deleting its history.
create or replace function public.replace_teacher_assignment_workflow(
  p_assignment_id uuid,
  p_new_teacher_id uuid,
  p_reason text
) returns public.teacher_assignments
language plpgsql security definer
set search_path=public,auth
as $$
declare v_old public.teacher_assignments; v_new public.teacher_assignments;
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

  update public.teacher_assignments
  set is_active=false,active_until=now()
  where id=v_old.id;

  insert into public.teacher_assignments(teacher_id,subject_id,group_id,academic_period_id,active_from,created_by)
  values(p_new_teacher_id,v_old.subject_id,v_old.group_id,v_old.academic_period_id,now(),auth.uid())
  returning * into v_new;

  perform public.write_audit(
    'ASSIGNMENT_CHANGED','teacher_assignments',v_new.id,to_jsonb(v_old),to_jsonb(v_new),p_reason,
    jsonb_build_object('previous_assignment_id',v_old.id)
  );
  return v_new;
end;
$$;

revoke execute on function public.set_student_active_workflow(uuid,boolean,text) from public;
revoke execute on function public.set_teacher_active_workflow(uuid,boolean,text) from public;
revoke execute on function public.assign_teacher_workflow(uuid,uuid,uuid,uuid) from public;
revoke execute on function public.replace_teacher_assignment_workflow(uuid,uuid,text) from public;

grant execute on function public.set_student_active_workflow(uuid,boolean,text) to authenticated;
grant execute on function public.set_teacher_active_workflow(uuid,boolean,text) to authenticated;
grant execute on function public.assign_teacher_workflow(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.replace_teacher_assignment_workflow(uuid,uuid,text) to authenticated;

commit;
