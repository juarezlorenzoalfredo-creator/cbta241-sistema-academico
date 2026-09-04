begin;

-- Auth users are created with Supabase Admin API on the server. This RPC binds the already-created auth.user
-- to the academic identity and role while preserving an auditable actor from the Superadmin session.
create or replace function public.provision_user_profile_workflow(
  p_user_id uuid,
  p_email text,
  p_display_name text,
  p_role public.app_role,
  p_student_id uuid default null,
  p_teacher_id uuid default null
) returns public.profiles
language plpgsql security definer
set search_path=public,auth
as $$
declare v_profile public.profiles;
begin
  if not public.current_user_has_role('SUPERADMIN') then
    raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'AUTH_USER_NOT_FOUND'; end if;
  if length(trim(coalesce(p_display_name,'')))<2 then raise exception 'DISPLAY_NAME_REQUIRED'; end if;
  if position('@' in coalesce(p_email,''))<2 then raise exception 'VALID_EMAIL_REQUIRED'; end if;
  if p_role='ALUMNO' and p_student_id is null then raise exception 'STUDENT_LINK_REQUIRED'; end if;
  if p_role='DOCENTE' and p_teacher_id is null then raise exception 'TEACHER_LINK_REQUIRED'; end if;
  if p_role<>'ALUMNO' and p_student_id is not null then raise exception 'STUDENT_LINK_NOT_ALLOWED'; end if;
  if p_role<>'DOCENTE' and p_teacher_id is not null then raise exception 'TEACHER_LINK_NOT_ALLOWED'; end if;

  insert into public.profiles(id,display_name,email,is_active)
  values(p_user_id,trim(p_display_name),lower(trim(p_email)),true)
  on conflict(id) do update
  set display_name=excluded.display_name,email=excluded.email,is_active=true
  returning * into v_profile;

  -- One operational role is provisioned by this workflow. Additional privilege must be an explicit later action.
  delete from public.user_roles where user_id=p_user_id;
  insert into public.user_roles(user_id,role,granted_by) values(p_user_id,p_role,auth.uid());

  if p_role='ALUMNO' then
    if exists(select 1 from public.students where id=p_student_id and profile_id is not null and profile_id<>p_user_id) then
      raise exception 'STUDENT_ALREADY_LINKED';
    end if;
    update public.students set profile_id=p_user_id where id=p_student_id;
    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  elsif p_role='DOCENTE' then
    if exists(select 1 from public.teachers where id=p_teacher_id and profile_id is not null and profile_id<>p_user_id) then
      raise exception 'TEACHER_ALREADY_LINKED';
    end if;
    update public.teachers set profile_id=p_user_id where id=p_teacher_id;
    if not found then raise exception 'TEACHER_NOT_FOUND'; end if;
  end if;

  perform public.write_audit('USER_PROVISIONED','profiles',p_user_id,null,to_jsonb(v_profile),null,jsonb_build_object('role',p_role));
  return v_profile;
end;
$$;

create or replace function public.set_user_active_workflow(
  p_user_id uuid,
  p_active boolean,
  p_reason text
) returns public.profiles
language plpgsql security definer
set search_path=public,auth
as $$
declare v_old public.profiles; v_new public.profiles;
begin
  if not public.current_user_has_role('SUPERADMIN') then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501'; end if;
  if p_user_id=auth.uid() and not p_active then raise exception 'CANNOT_DISABLE_SELF'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_old from public.profiles where id=p_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  update public.profiles set is_active=p_active where id=p_user_id returning * into v_new;
  perform public.write_audit(case when p_active then 'USER_REACTIVATED' else 'USER_DEACTIVATED' end,'profiles',p_user_id,to_jsonb(v_old),to_jsonb(v_new),p_reason);
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
declare v_old jsonb;
begin
  if not public.current_user_has_role('SUPERADMIN') then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501'; end if;
  if p_user_id=auth.uid() and p_role<>'SUPERADMIN' then raise exception 'CANNOT_REMOVE_OWN_SUPERADMIN'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'PROFILE_NOT_FOUND'; end if;
  if p_role='ALUMNO' and not exists(select 1 from public.students where profile_id=p_user_id) then raise exception 'STUDENT_LINK_REQUIRED'; end if;
  if p_role='DOCENTE' and not exists(select 1 from public.teachers where profile_id=p_user_id) then raise exception 'TEACHER_LINK_REQUIRED'; end if;
  select coalesce(jsonb_agg(role::text),'[]'::jsonb) into v_old from public.user_roles where user_id=p_user_id;
  delete from public.user_roles where user_id=p_user_id;
  insert into public.user_roles(user_id,role,granted_by) values(p_user_id,p_role,auth.uid());
  perform public.write_audit('ROLE_CHANGED','profiles',p_user_id,v_old,jsonb_build_array(p_role::text),p_reason);
end;
$$;

revoke execute on function public.provision_user_profile_workflow(uuid,text,text,public.app_role,uuid,uuid) from public;
revoke execute on function public.set_user_active_workflow(uuid,boolean,text) from public;
revoke execute on function public.replace_user_role_workflow(uuid,public.app_role,text) from public;
grant execute on function public.provision_user_profile_workflow(uuid,text,text,public.app_role,uuid,uuid) to authenticated;
grant execute on function public.set_user_active_workflow(uuid,boolean,text) to authenticated;
grant execute on function public.replace_user_role_workflow(uuid,public.app_role,text) to authenticated;

commit;
