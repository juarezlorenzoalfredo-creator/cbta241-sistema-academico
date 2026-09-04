begin;
create or replace function public.transition_evaluation_period(
  p_id uuid,
  p_state public.evaluation_state,
  p_reason text,
  p_expected_version integer
) returns public.evaluation_periods
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_ep public.evaluation_periods;
  v_opened_at timestamptz;
  v_closed_at timestamptz;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_state='REOPENED' and length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'REOPEN_REASON_REQUIRED';
  end if;

  select * into v_ep from public.evaluation_periods where id=p_id for update;
  if not found then raise exception 'EVALUATION_NOT_FOUND'; end if;
  if v_ep.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;

  v_opened_at := v_ep.opens_at;
  if p_state in ('OPEN','REOPENED') and v_opened_at is null then
    v_opened_at := clock_timestamp();
  end if;

  if p_state='CLOSED' then
    v_closed_at := case
      when v_opened_at is null then clock_timestamp()
      else greatest(clock_timestamp(), v_opened_at + interval '1 microsecond')
    end;
  elsif p_state in ('OPEN','REOPENED') then
    v_closed_at := null;
  else
    v_closed_at := v_ep.closes_at;
  end if;

  update public.evaluation_periods
  set state=p_state,
      opens_at=v_opened_at,
      closes_at=v_closed_at,
      last_transition_reason=p_reason,
      last_transition_by=auth.uid(),
      version=version+1
  where id=p_id
  returning * into v_ep;

  perform public.write_audit(
    case p_state
      when 'OPEN' then 'EVALUATION_PERIOD_OPENED'
      when 'CLOSED' then 'EVALUATION_PERIOD_CLOSED'
      when 'REOPENED' then 'EVALUATION_PERIOD_REOPENED'
      else 'EVALUATION_PERIOD_UPDATED'
    end,
    'evaluation_periods',v_ep.id,null,to_jsonb(v_ep),p_reason
  );
  return v_ep;
end;
$$;
revoke execute on function public.transition_evaluation_period(uuid,public.evaluation_state,text,integer) from public, anon;
grant execute on function public.transition_evaluation_period(uuid,public.evaluation_state,text,integer) to authenticated;
commit;
