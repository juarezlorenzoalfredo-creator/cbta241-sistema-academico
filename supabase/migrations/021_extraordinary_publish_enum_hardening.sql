begin;
create or replace function public.publish_extraordinary(
  p_extra_id uuid,
  p_expected_version integer
) returns public.extraordinary_evaluations
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_extra public.extraordinary_evaluations;
  v_student_user uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  select * into v_extra from public.extraordinary_evaluations where id=p_extra_id for update;
  if not found or v_extra.state<>'CAPTURED' then raise exception 'CAPTURED_EXTRAORDINARY_REQUIRED'; end if;
  if v_extra.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;

  update public.extraordinary_evaluations
  set state=case
        when numeric_grade>=6 then 'ACCREDITED'::public.extraordinary_state
        else 'NOT_ACCREDITED'::public.extraordinary_state
      end,
      published_at=clock_timestamp(),
      version=version+1
  where id=p_extra_id
  returning * into v_extra;

  select st.profile_id into v_student_user
  from public.student_subject_enrollments sse
  join public.enrollments e on e.id=sse.enrollment_id
  join public.students st on st.id=e.student_id
  where sse.id=v_extra.student_subject_enrollment_id;

  if v_student_user is not null then
    insert into public.notifications(user_id,type,title,body,metadata)
    values(v_student_user,'EXTRAORDINARY_PUBLISHED','Resultado extraordinario publicado','Ya está disponible el resultado de tu evaluación extraordinaria.',jsonb_build_object('extraordinary_id',v_extra.id));
  end if;

  perform public.write_audit('EXTRAORDINARY_PUBLISHED','extraordinary_evaluations',v_extra.id,null,to_jsonb(v_extra));
  return v_extra;
end;
$$;
revoke execute on function public.publish_extraordinary(uuid,integer) from public, anon;
grant execute on function public.publish_extraordinary(uuid,integer) to authenticated;
commit;
