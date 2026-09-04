begin;

-- Bootstrap is intentionally SERVICE_ROLE-only because no application Superadmin
-- exists yet to authorize the first profile/role binding. Auth user creation stays
-- in Supabase Auth Admin API; this RPC only performs the transactional DB binding.
create or replace function public.bootstrap_first_superadmin(
  p_user_id uuid,
  p_email text,
  p_display_name text
) returns public.profiles
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_profile public.profiles;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if exists(select 1 from public.user_roles where role='SUPERADMIN') then
    raise exception 'SUPERADMIN_ALREADY_BOOTSTRAPPED' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;
  if length(trim(coalesce(p_display_name,'')))<2 then
    raise exception 'DISPLAY_NAME_REQUIRED';
  end if;
  if position('@' in coalesce(p_email,''))<2 then
    raise exception 'VALID_EMAIL_REQUIRED';
  end if;
  if exists(select 1 from public.profiles where id<>p_user_id and lower(email)=lower(trim(p_email))) then
    raise exception 'PROFILE_EMAIL_ALREADY_USED';
  end if;

  insert into public.profiles(id,display_name,email,is_active)
  values(p_user_id,trim(p_display_name),lower(trim(p_email)),true)
  on conflict(id) do update
    set display_name=excluded.display_name,
        email=excluded.email,
        is_active=true
  returning * into v_profile;

  delete from public.user_roles where user_id=p_user_id;
  insert into public.user_roles(user_id,role,granted_by)
  values(p_user_id,'SUPERADMIN',null);

  insert into public.audit_logs(actor_id,actor_role,action,entity,entity_id,after_data,metadata)
  values(
    p_user_id,
    'SUPERADMIN',
    'FIRST_SUPERADMIN_BOOTSTRAPPED',
    'profiles',
    p_user_id,
    to_jsonb(v_profile),
    jsonb_build_object('bootstrap',true,'channel','service_role')
  );

  return v_profile;
end;
$$;

revoke execute on function public.bootstrap_first_superadmin(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bootstrap_first_superadmin(uuid,text,text) to service_role;

commit;
