-- RC5: harden the one-time superadmin binding so a confirmed Auth identity is required.
create or replace function public.bootstrap_first_superadmin(p_user_id uuid, p_email text, p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles;
  v_auth_email text;
  v_confirmed_at timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if exists(select 1 from public.user_roles where role='SUPERADMIN') then
    raise exception 'SUPERADMIN_ALREADY_BOOTSTRAPPED' using errcode='42501';
  end if;

  select lower(email), email_confirmed_at
    into v_auth_email, v_confirmed_at
  from auth.users
  where id=p_user_id;

  if v_auth_email is null then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;
  if v_confirmed_at is null then
    raise exception 'AUTH_EMAIL_NOT_CONFIRMED';
  end if;
  if v_auth_email <> lower(trim(coalesce(p_email,''))) then
    raise exception 'AUTH_EMAIL_MISMATCH';
  end if;
  if length(trim(coalesce(p_display_name,'')))<2 then
    raise exception 'DISPLAY_NAME_REQUIRED';
  end if;

  insert into public.profiles(id,display_name,email,is_active)
  values(p_user_id,trim(p_display_name),v_auth_email,true)
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
    jsonb_build_object('bootstrap',true,'channel','service_role','auth_confirmed',true)
  );

  return v_profile;
end;
$$;

revoke all on function public.bootstrap_first_superadmin(uuid,text,text) from public, anon, authenticated;
grant execute on function public.bootstrap_first_superadmin(uuid,text,text) to service_role;
