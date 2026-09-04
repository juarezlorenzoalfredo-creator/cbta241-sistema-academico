begin;

-- SECURITY HARDENING: remove default PUBLIC execute on security-definer functions.
revoke execute on all functions in schema public from public;

-- Helpers required by RLS for authenticated users.
grant execute on function public.current_user_has_role(public.app_role) to authenticated;
grant execute on function public.current_primary_role() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_teacher_id() to authenticated;
grant execute on function public.teacher_owns_assignment(uuid) to authenticated;
grant execute on function public.student_owns_sse(uuid) to authenticated;
grant execute on function public.assignment_covers_sse(uuid,uuid) to authenticated;

-- Re-grant controlled workflows only.
grant execute on function public.save_grade_draft(uuid,uuid,public.grade_kind,numeric,integer) to authenticated;
grant execute on function public.publish_assignment_grades(uuid,uuid,text) to authenticated;
grant execute on function public.correct_published_grade(uuid,public.grade_kind,numeric,text,integer) to authenticated;
grant execute on function public.request_grade_correction(uuid,public.grade_kind,numeric,text) to authenticated;
grant execute on function public.resolve_grade_correction_request(uuid,boolean,text) to authenticated;
grant execute on function public.authorize_extraordinary(uuid,text) to authenticated;
grant execute on function public.capture_extraordinary(uuid,numeric,integer) to authenticated;
grant execute on function public.publish_extraordinary(uuid,integer) to authenticated;
grant execute on function public.transition_evaluation_period(uuid,public.evaluation_state,text,integer) to authenticated;
grant execute on function public.verify_academic_document(text) to anon,authenticated;

-- Administrative workflows keep audit writes server-side and atomic.
create or replace function public.create_academic_period_workflow(
  p_kind public.period_kind,
  p_start_year integer,
  p_make_current boolean default true
) returns public.academic_periods
language plpgsql security definer
set search_path=public,auth
as $$
declare v_period public.academic_periods; v_start date; v_end date;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_start_year<2000 or p_start_year>2200 then raise exception 'INVALID_YEAR'; end if;
  if p_kind='AUG_JAN' then
    v_start=make_date(p_start_year,8,1); v_end=make_date(p_start_year+1,1,31);
  else
    v_start=make_date(p_start_year,2,1); v_end=make_date(p_start_year,7,31);
  end if;
  if p_make_current then update public.academic_periods set is_current=false where is_current; end if;
  insert into public.academic_periods(kind,start_year,starts_on,ends_on,is_current)
  values(p_kind,p_start_year,v_start,v_end,p_make_current) returning * into v_period;
  insert into public.evaluation_periods(academic_period_id,partial_number,state) values
    (v_period.id,1,'PLANNED'),(v_period.id,2,'PLANNED'),(v_period.id,3,'PLANNED');
  update public.institution_settings set current_period_id=v_period.id,updated_by=auth.uid() where singleton_key='CBTA241' and p_make_current;
  perform public.write_audit('ACADEMIC_PERIOD_CREATED','academic_periods',v_period.id,null,to_jsonb(v_period));
  return v_period;
end;
$$;

create or replace function public.create_student_record(p_enrollment_number text,p_full_name text)
returns public.students
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.students;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_enrollment_number,'')))<3 or length(trim(coalesce(p_full_name,'')))<2 then raise exception 'INVALID_STUDENT_DATA'; end if;
  insert into public.students(enrollment_number,full_name) values(trim(p_enrollment_number),trim(p_full_name)) returning * into v;
  perform public.write_audit('STUDENT_CREATED','students',v.id,null,to_jsonb(v));
  return v;
end;
$$;

create or replace function public.create_teacher_record(p_employee_number text,p_full_name text)
returns public.teachers
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.teachers;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_full_name,'')))<2 then raise exception 'INVALID_TEACHER_DATA'; end if;
  insert into public.teachers(employee_number,full_name) values(nullif(trim(p_employee_number),''),trim(p_full_name)) returning * into v;
  perform public.write_audit('TEACHER_CREATED','teachers',v.id,null,to_jsonb(v));
  return v;
end;
$$;

create or replace function public.create_subject_record(p_code text,p_name text)
returns public.subjects
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.subjects;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  insert into public.subjects(code,name) values(upper(trim(p_code)),trim(p_name)) returning * into v;
  perform public.write_audit('SUBJECT_CREATED','subjects',v.id,null,to_jsonb(v));
  return v;
end;
$$;

create or replace function public.create_group_record(p_period_id uuid,p_semester_id uuid,p_name text,p_modality text default 'ESCOLARIZADO')
returns public.groups
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.groups;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_modality not in ('ESCOLARIZADO','SAETA') then raise exception 'INVALID_MODALITY'; end if;
  insert into public.groups(academic_period_id,semester_id,name,modality) values(p_period_id,p_semester_id,upper(trim(p_name)),p_modality) returning * into v;
  perform public.write_audit('GROUP_CREATED','groups',v.id,null,to_jsonb(v));
  return v;
end;
$$;

create or replace function public.enroll_student_workflow(p_student_id uuid,p_period_id uuid,p_semester_id uuid,p_group_id uuid,p_subject_ids uuid[])
returns public.enrollments
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.enrollments; v_subject uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if coalesce(array_length(p_subject_ids,1),0)=0 then raise exception 'SUBJECTS_REQUIRED'; end if;
  if not exists(select 1 from public.groups g where g.id=p_group_id and g.academic_period_id=p_period_id and g.semester_id=p_semester_id) then raise exception 'GROUP_PERIOD_SEMESTER_MISMATCH'; end if;
  insert into public.enrollments(student_id,academic_period_id,semester_id,group_id,created_by)
  values(p_student_id,p_period_id,p_semester_id,p_group_id,auth.uid()) returning * into v;
  foreach v_subject in array p_subject_ids loop
    insert into public.student_subject_enrollments(enrollment_id,subject_id) values(v.id,v_subject);
  end loop;
  perform public.write_audit('ENROLLMENT_CREATED','enrollments',v.id,null,to_jsonb(v),null,jsonb_build_object('subject_count',array_length(p_subject_ids,1)));
  return v;
end;
$$;

create or replace function public.assign_teacher_workflow(p_teacher_id uuid,p_subject_id uuid,p_group_id uuid,p_period_id uuid)
returns public.teacher_assignments
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.teacher_assignments;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.groups where id=p_group_id and academic_period_id=p_period_id) then raise exception 'GROUP_PERIOD_MISMATCH'; end if;
  insert into public.teacher_assignments(teacher_id,subject_id,group_id,academic_period_id,created_by)
  values(p_teacher_id,p_subject_id,p_group_id,p_period_id,auth.uid()) returning * into v;
  perform public.write_audit('ASSIGNMENT_CREATED','teacher_assignments',v.id,null,to_jsonb(v));
  return v;
end;
$$;

create or replace function public.close_academic_period_workflow(p_period_id uuid,p_expected_version integer,p_reason text)
returns public.academic_periods
language plpgsql security definer
set search_path=public,auth
as $$
declare v public.academic_periods; v_problem integer;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'CLOSE_REASON_REQUIRED'; end if;
  select * into v from public.academic_periods where id=p_period_id for update;
  if not found then raise exception 'PERIOD_NOT_FOUND'; end if;
  if v.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  select count(*) into v_problem from public.evaluation_periods where academic_period_id=p_period_id and state<>'CLOSED';
  if v_problem>0 then raise exception 'PARTIALS_NOT_CLOSED'; end if;
  select count(*) into v_problem from public.grade_change_requests r join public.grades g on g.id=r.grade_id join public.evaluation_periods ep on ep.id=g.evaluation_period_id where ep.academic_period_id=p_period_id and r.state='PENDING';
  if v_problem>0 then raise exception 'PENDING_CORRECTIONS'; end if;
  select count(*) into v_problem from public.extraordinary_evaluations x join public.student_subject_enrollments sse on sse.id=x.student_subject_enrollment_id join public.enrollments e on e.id=sse.enrollment_id where e.academic_period_id=p_period_id and x.state in ('ELIGIBLE','AUTHORIZED','SCHEDULED','CAPTURED');
  if v_problem>0 then raise exception 'PENDING_EXTRAORDINARIES'; end if;
  update public.academic_periods set is_closed=true,closed_at=now(),closed_by=auth.uid(),is_current=false,version=version+1 where id=p_period_id returning * into v;
  perform public.write_audit('SEMESTER_CLOSED','academic_periods',v.id,null,to_jsonb(v),p_reason);
  return v;
end;
$$;

grant execute on function public.create_academic_period_workflow(public.period_kind,integer,boolean) to authenticated;
grant execute on function public.create_student_record(text,text) to authenticated;
grant execute on function public.create_teacher_record(text,text) to authenticated;
grant execute on function public.create_subject_record(text,text) to authenticated;
grant execute on function public.create_group_record(uuid,uuid,text,text) to authenticated;
grant execute on function public.enroll_student_workflow(uuid,uuid,uuid,uuid,uuid[]) to authenticated;
grant execute on function public.assign_teacher_workflow(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.close_academic_period_workflow(uuid,integer,text) to authenticated;

commit;
