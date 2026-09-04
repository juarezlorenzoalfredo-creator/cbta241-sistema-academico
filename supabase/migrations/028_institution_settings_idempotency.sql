-- Prevent duplicate/no-op institutional settings writes from changing updated_at
-- or flooding the audit log. Real changes continue to be audited normally.

create or replace function public.update_institution_settings_workflow(
  p_official_name text,
  p_short_name text,
  p_school_key text,
  p_address text,
  p_phone text,
  p_email text,
  p_director_name text,
  p_timezone text,
  p_signature_path text default null,
  p_seal_path text default null
)
returns public.institution_settings
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_old public.institution_settings;
  v_new public.institution_settings;
  v_official_name text := trim(coalesce(p_official_name, ''));
  v_short_name text := trim(coalesce(p_short_name, ''));
  v_school_key text := nullif(trim(coalesce(p_school_key, '')), '');
  v_address text := nullif(trim(coalesce(p_address, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_director_name text := nullif(trim(coalesce(p_director_name, '')), '');
  v_timezone text := trim(coalesce(p_timezone, ''));
  v_signature_path text := nullif(trim(coalesce(p_signature_path, '')), '');
  v_seal_path text := nullif(trim(coalesce(p_seal_path, '')), '');
begin
  if not public.current_user_has_role('SUPERADMIN') then
    raise exception 'SUPERADMIN_REQUIRED' using errcode = '42501';
  end if;

  if length(v_official_name) < 8 or length(v_short_name) < 3 then
    raise exception 'INVALID_INSTITUTION_NAME';
  end if;
  if length(v_timezone) < 3 then
    raise exception 'INVALID_TIMEZONE';
  end if;

  select *
    into v_old
    from public.institution_settings
   where singleton_key = 'CBTA241'
   for update;

  if not found then
    raise exception 'INSTITUTION_SETTINGS_NOT_FOUND';
  end if;

  -- A resubmission with the same effective values is a successful no-op.
  -- Do not advance updated_at/updated_by and do not create an audit event.
  if v_old.official_name is not distinct from v_official_name
     and v_old.short_name is not distinct from v_short_name
     and v_old.school_key is not distinct from v_school_key
     and v_old.address is not distinct from v_address
     and v_old.phone is not distinct from v_phone
     and v_old.email is not distinct from v_email
     and v_old.director_name is not distinct from v_director_name
     and v_old.timezone is not distinct from v_timezone
     and v_old.director_signature_storage_path is not distinct from coalesce(v_signature_path, v_old.director_signature_storage_path)
     and v_old.institutional_seal_storage_path is not distinct from coalesce(v_seal_path, v_old.institutional_seal_storage_path)
  then
    return v_old;
  end if;

  update public.institution_settings
     set official_name = v_official_name,
         short_name = v_short_name,
         school_key = v_school_key,
         address = v_address,
         phone = v_phone,
         email = v_email,
         director_name = v_director_name,
         timezone = v_timezone,
         director_signature_storage_path = coalesce(v_signature_path, director_signature_storage_path),
         institutional_seal_storage_path = coalesce(v_seal_path, institutional_seal_storage_path),
         updated_by = auth.uid()
   where singleton_key = 'CBTA241'
  returning * into v_new;

  perform public.write_audit(
    'INSTITUTION_SETTINGS_UPDATED',
    'institution_settings',
    v_new.id,
    to_jsonb(v_old),
    to_jsonb(v_new)
  );

  return v_new;
end;
$function$;
