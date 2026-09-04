begin;

create or replace function public.set_user_active_workflow(
  p_user_id uuid,
  p_active boolean,
  p_reason text
) returns public.profiles
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_old public.profiles;
  v_new public.profiles;
  v_is_superadmin boolean;
  v_other_active_superadmins integer;
begin
  if not public.current_user_has_role('SUPERADMIN') then
    raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_user_id=auth.uid() and not p_active then
    raise exception 'CANNOT_DISABLE_SELF';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_old from public.profiles where id=p_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  select exists(
    select 1 from public.user_roles where user_id=p_user_id and role='SUPERADMIN'
  ) into v_is_superadmin;

  if not p_active and v_is_superadmin then
    select count(*) into v_other_active_superadmins
    from public.user_roles ur
    join public.profiles p on p.id=ur.user_id
    where ur.role='SUPERADMIN' and ur.user_id<>p_user_id and p.is_active;
    if v_other_active_superadmins=0 then
      raise exception 'CANNOT_DISABLE_LAST_ACTIVE_SUPERADMIN' using errcode='42501';
    end if;
  end if;

  update public.profiles set is_active=p_active where id=p_user_id returning * into v_new;
  perform public.write_audit(
    case when p_active then 'USER_REACTIVATED' else 'USER_DEACTIVATED' end,
    'profiles',p_user_id,to_jsonb(v_old),to_jsonb(v_new),p_reason
  );
  return v_new;
end;
$$;

create or replace function public.replace_user_role_workflow(
  p_user_id uuid,
  p_role public.app_role,
  p_reason text
) returns void
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_old jsonb;
  v_is_superadmin boolean;
  v_other_active_superadmins integer;
begin
  if not public.current_user_has_role('SUPERADMIN') then
    raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_user_id=auth.uid() and p_role<>'SUPERADMIN' then
    raise exception 'CANNOT_REMOVE_OWN_SUPERADMIN';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'PROFILE_NOT_FOUND'; end if;
  if p_role='ALUMNO' and not exists(select 1 from public.students where profile_id=p_user_id) then raise exception 'STUDENT_LINK_REQUIRED'; end if;
  if p_role='DOCENTE' and not exists(select 1 from public.teachers where profile_id=p_user_id) then raise exception 'TEACHER_LINK_REQUIRED'; end if;

  select exists(select 1 from public.user_roles where user_id=p_user_id and role='SUPERADMIN') into v_is_superadmin;
  if v_is_superadmin and p_role<>'SUPERADMIN' then
    select count(*) into v_other_active_superadmins
    from public.user_roles ur
    join public.profiles p on p.id=ur.user_id
    where ur.role='SUPERADMIN' and ur.user_id<>p_user_id and p.is_active;
    if v_other_active_superadmins=0 then
      raise exception 'CANNOT_REMOVE_LAST_ACTIVE_SUPERADMIN' using errcode='42501';
    end if;
  end if;

  select coalesce(jsonb_agg(role::text),'[]'::jsonb) into v_old
  from public.user_roles where user_id=p_user_id;
  delete from public.user_roles where user_id=p_user_id;
  insert into public.user_roles(user_id,role,granted_by) values(p_user_id,p_role,auth.uid());
  perform public.write_audit('ROLE_CHANGED','profiles',p_user_id,v_old,jsonb_build_array(p_role::text),p_reason);
end;
$$;

revoke execute on function public.set_user_active_workflow(uuid,boolean,text) from public,anon;
revoke execute on function public.replace_user_role_workflow(uuid,public.app_role,text) from public,anon;
grant execute on function public.set_user_active_workflow(uuid,boolean,text) to authenticated;
grant execute on function public.replace_user_role_workflow(uuid,public.app_role,text) to authenticated;

commit;
