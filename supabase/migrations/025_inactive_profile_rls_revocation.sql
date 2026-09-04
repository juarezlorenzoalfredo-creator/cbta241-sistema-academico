begin;

-- Account deactivation must revoke database visibility immediately, even while an
-- already-issued JWT is still cryptographically valid. Every identity helper used
-- by RLS therefore requires the application profile itself to remain active.
create or replace function public.current_primary_role()
returns public.app_role
language sql stable security definer
set search_path=public,auth
as $$
  select ur.role
  from public.user_roles ur
  join public.profiles p on p.id=ur.user_id and p.is_active
  where ur.user_id=auth.uid()
  order by case ur.role
    when 'SUPERADMIN' then 1 when 'CONTROL_ESCOLAR' then 2 when 'DOCENTE' then 3 else 4 end
  limit 1;
$$;

create or replace function public.current_student_id()
returns uuid
language sql stable security definer
set search_path=public,auth
as $$
  select s.id
  from public.students s
  join public.profiles p on p.id=s.profile_id and p.is_active
  where s.profile_id=auth.uid() and s.is_active
  limit 1;
$$;

create or replace function public.current_teacher_id()
returns uuid
language sql stable security definer
set search_path=public,auth
as $$
  select t.id
  from public.teachers t
  join public.profiles p on p.id=t.profile_id and p.is_active
  where t.profile_id=auth.uid() and t.is_active
  limit 1;
$$;

revoke execute on function public.current_primary_role() from public,anon;
revoke execute on function public.current_student_id() from public,anon;
revoke execute on function public.current_teacher_id() from public,anon;
grant execute on function public.current_primary_role() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_teacher_id() to authenticated;

commit;
