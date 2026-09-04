begin;

create or replace function public.set_teacher_active_workflow(
  p_teacher_id uuid,
  p_active boolean,
  p_reason text
) returns public.teachers
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_old public.teachers;
  v_new public.teachers;
  v_closed integer:=0;
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
       set is_active=false,
           active_until=coalesce(
             active_until,
             greatest(clock_timestamp(), active_from + interval '1 microsecond')
           )
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

revoke execute on function public.set_teacher_active_workflow(uuid,boolean,text) from public, anon;
grant execute on function public.set_teacher_active_workflow(uuid,boolean,text) to authenticated;

commit;
