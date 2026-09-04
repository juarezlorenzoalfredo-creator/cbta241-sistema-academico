begin;

-- Students may see only published partial values, and the ordinary average is
-- intentionally withheld until all three partials have been published.
create or replace view public.student_grade_overview with (security_invoker=true) as
select
  sse.id as student_subject_enrollment_id,
  e.student_id,
  e.academic_period_id,
  sub.id as subject_id,
  sub.name as subject_name,
  max(case when ep.partial_number=1 then case g.kind when 'NUMERIC' then to_char(g.numeric_grade,'FM990.0') when 'NP' then 'NP' else null end end) as p1,
  max(case when ep.partial_number=2 then case g.kind when 'NUMERIC' then to_char(g.numeric_grade,'FM990.0') when 'NP' then 'NP' else null end end) as p2,
  max(case when ep.partial_number=3 then case g.kind when 'NUMERIC' then to_char(g.numeric_grade,'FM990.0') when 'NP' then 'NP' else null end end) as p3,
  case
    when count(*) filter(where g.state='PUBLISHED' and ep.partial_number between 1 and 3)=3
      then round(avg(case g.kind when 'NUMERIC' then g.numeric_grade when 'NP' then 0 else null end) filter(where g.state='PUBLISHED' and ep.partial_number between 1 and 3),1)
    else null
  end as published_average,
  count(*) filter(where g.state='PUBLISHED' and ep.partial_number between 1 and 3) as published_partial_count,
  xe.numeric_grade as extraordinary_grade,
  xe.state as extraordinary_state
from public.student_subject_enrollments sse
join public.enrollments e on e.id=sse.enrollment_id
join public.subjects sub on sub.id=sse.subject_id
left join public.grades g on g.student_subject_enrollment_id=sse.id and g.state='PUBLISHED'
left join public.evaluation_periods ep on ep.id=g.evaluation_period_id
left join public.extraordinary_evaluations xe on xe.student_subject_enrollment_id=sse.id and xe.published_at is not null
group by sse.id,e.student_id,e.academic_period_id,sub.id,sub.name,xe.numeric_grade,xe.state;

-- Staff-only overview exposes provisional averages required for preventive risk
-- monitoring after P1/P2. The WHERE clause is an additional role boundary while
-- security_invoker preserves underlying table RLS.
create or replace view public.staff_grade_overview with (security_invoker=true) as
select
  sse.id as student_subject_enrollment_id,
  e.student_id,
  e.academic_period_id,
  sub.id as subject_id,
  sub.name as subject_name,
  round(avg(case g.kind when 'NUMERIC' then g.numeric_grade when 'NP' then 0 else null end) filter(where g.state='PUBLISHED' and ep.partial_number between 1 and 3),1) as provisional_average,
  count(*) filter(where g.state='PUBLISHED' and ep.partial_number between 1 and 3) as published_partial_count
from public.student_subject_enrollments sse
join public.enrollments e on e.id=sse.enrollment_id
join public.subjects sub on sub.id=sse.subject_id
left join public.grades g on g.student_subject_enrollment_id=sse.id and g.state='PUBLISHED'
left join public.evaluation_periods ep on ep.id=g.evaluation_period_id
where public.current_user_has_role('DOCENTE')
   or public.current_user_has_role('CONTROL_ESCOLAR')
   or public.current_user_has_role('SUPERADMIN')
group by sse.id,e.student_id,e.academic_period_id,sub.id,sub.name;

grant select on public.staff_grade_overview to authenticated;

commit;
