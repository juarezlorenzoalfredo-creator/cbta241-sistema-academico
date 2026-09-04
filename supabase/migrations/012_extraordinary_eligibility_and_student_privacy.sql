begin;

-- Students must never be able to read a captured extraordinary grade before
-- Control Escolar publishes it. Staff retains direct RLS-scoped access.
drop policy if exists extraordinary_select on public.extraordinary_evaluations;
create policy extraordinary_select
on public.extraordinary_evaluations for select to authenticated
using (
  public.current_user_has_role('CONTROL_ESCOLAR')
  or public.current_user_has_role('SUPERADMIN')
  or exists(
    select 1
    from public.student_subject_enrollments sse
    join public.enrollments e on e.id=sse.enrollment_id
    join public.teacher_assignments ta
      on ta.subject_id=sse.subject_id
     and ta.group_id=e.group_id
     and ta.academic_period_id=e.academic_period_id
    where sse.id=extraordinary_evaluations.student_subject_enrollment_id
      and ta.teacher_id=public.current_teacher_id()
      and ta.is_active
      and ta.active_from<=now()
      and (ta.active_until is null or ta.active_until>now())
  )
);

create or replace function public.get_my_extraordinary_overview()
returns table(
  id uuid,
  state public.extraordinary_state,
  numeric_grade numeric,
  authorized_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  subject_name text,
  period_label text
)
language sql
stable
security definer
set search_path=public,auth
as $$
  select
    x.id,
    x.state,
    case when x.published_at is not null then x.numeric_grade else null end,
    x.authorized_at,
    x.scheduled_at,
    x.published_at,
    sub.name,
    ap.label
  from public.extraordinary_evaluations x
  join public.student_subject_enrollments sse on sse.id=x.student_subject_enrollment_id
  join public.enrollments e on e.id=sse.enrollment_id
  join public.subjects sub on sub.id=sse.subject_id
  join public.academic_periods ap on ap.id=e.academic_period_id
  where public.current_user_has_role('ALUMNO')
    and e.student_id=public.current_student_id()
  order by x.created_at desc;
$$;

-- Extraordinary authorization is legal only after all three published partials
-- have produced a final ordinary result below 6.0.
create or replace function public.authorize_extraordinary(p_sse_id uuid, p_reason text)
returns public.extraordinary_evaluations
language plpgsql security definer
set search_path=public,auth
as $$
declare v_avg numeric; v_count integer; v_extra public.extraordinary_evaluations;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;

  select
    count(*) filter(where g.state='PUBLISHED' and g.kind<>'PENDING' and ep.partial_number between 1 and 3),
    round(avg(case g.kind when 'NUMERIC' then g.numeric_grade when 'NP' then 0 else null end)
      filter(where g.state='PUBLISHED' and g.kind<>'PENDING' and ep.partial_number between 1 and 3),1)
  into v_count,v_avg
  from public.grades g
  join public.evaluation_periods ep on ep.id=g.evaluation_period_id
  where g.student_subject_enrollment_id=p_sse_id;

  if v_count<>3 then raise exception 'ORDINARY_RESULT_INCOMPLETE'; end if;
  if v_avg is null or v_avg>=6.0 then raise exception 'NOT_ELIGIBLE_FOR_EXTRAORDINARY'; end if;

  insert into public.extraordinary_evaluations(student_subject_enrollment_id,authorized_by,authorized_at,state)
  values(p_sse_id,auth.uid(),now(),'AUTHORIZED')
  returning * into v_extra;
  perform public.write_audit('EXTRAORDINARY_AUTHORIZED','extraordinary_evaluations',v_extra.id,null,to_jsonb(v_extra),p_reason);
  return v_extra;
exception when unique_violation then
  raise exception 'EXTRAORDINARY_ALREADY_EXISTS';
end;
$$;

revoke execute on function public.get_my_extraordinary_overview() from public;
revoke execute on function public.authorize_extraordinary(uuid,text) from public;
grant execute on function public.get_my_extraordinary_overview() to authenticated;
grant execute on function public.authorize_extraordinary(uuid,text) to authenticated;

commit;
