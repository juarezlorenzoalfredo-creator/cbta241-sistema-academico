begin;

-- Successful session lifecycle events are written through a narrow authenticated
-- workflow. The actor and role are derived from auth.uid(); callers cannot forge them.
create or replace function public.log_session_event(p_action text)
returns void
language plpgsql security definer
set search_path=public,auth
as $$
declare v_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_action not in ('LOGIN','LOGOUT') then
    raise exception 'INVALID_SESSION_EVENT';
  end if;
  v_role := public.current_primary_role();
  insert into public.audit_logs(actor_id,actor_role,action,entity,entity_id,metadata)
  values(auth.uid(),v_role,p_action,'AUTH',auth.uid(),jsonb_build_object('source','application'));
end $$;

revoke execute on function public.log_session_event(text) from public;
grant execute on function public.log_session_event(text) to authenticated;

commit;
