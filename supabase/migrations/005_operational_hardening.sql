begin;

-- Gate the semester close on complete, published P1/P2/P3 evidence for every active subject enrollment.
create or replace function public.close_academic_period_workflow(
  p_period_id uuid,
  p_expected_version integer,
  p_reason text
) returns public.academic_periods
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v public.academic_periods;
  v_problem integer;
  v_expected bigint;
  v_published bigint;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'CLOSE_REASON_REQUIRED'; end if;

  select * into v from public.academic_periods where id=p_period_id for update;
  if not found then raise exception 'PERIOD_NOT_FOUND'; end if;
  if v.is_closed then raise exception 'PERIOD_ALREADY_CLOSED'; end if;
  if v.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;

  select count(*) into v_problem
  from public.evaluation_periods
  where academic_period_id=p_period_id and state<>'CLOSED';
  if v_problem>0 then raise exception 'PARTIALS_NOT_CLOSED'; end if;

  select count(*) * 3 into v_expected
  from public.student_subject_enrollments sse
  join public.enrollments e on e.id=sse.enrollment_id
  where e.academic_period_id=p_period_id
    and e.status='ACTIVE'
    and sse.status='ACTIVE';

  select count(*) into v_published
  from public.grades g
  join public.student_subject_enrollments sse on sse.id=g.student_subject_enrollment_id
  join public.enrollments e on e.id=sse.enrollment_id
  join public.evaluation_periods ep on ep.id=g.evaluation_period_id
  where e.academic_period_id=p_period_id
    and e.status='ACTIVE'
    and sse.status='ACTIVE'
    and ep.academic_period_id=p_period_id
    and ep.partial_number between 1 and 3
    and g.state='PUBLISHED'
    and g.kind<>'PENDING';

  if v_published<>v_expected then
    raise exception 'INCOMPLETE_PUBLISHED_GRADES: expected %, published %',v_expected,v_published;
  end if;

  select count(*) into v_problem
  from public.grade_change_requests r
  join public.grades g on g.id=r.grade_id
  join public.evaluation_periods ep on ep.id=g.evaluation_period_id
  where ep.academic_period_id=p_period_id and r.state='PENDING';
  if v_problem>0 then raise exception 'PENDING_CORRECTIONS'; end if;

  select count(*) into v_problem
  from public.extraordinary_evaluations x
  join public.student_subject_enrollments sse on sse.id=x.student_subject_enrollment_id
  join public.enrollments e on e.id=sse.enrollment_id
  where e.academic_period_id=p_period_id
    and x.state in ('ELIGIBLE','AUTHORIZED','SCHEDULED','CAPTURED','PUBLISHED');
  if v_problem>0 then raise exception 'PENDING_EXTRAORDINARIES'; end if;

  update public.academic_periods
  set is_closed=true,closed_at=now(),closed_by=auth.uid(),is_current=false,version=version+1
  where id=p_period_id returning * into v;

  perform public.write_audit(
    'SEMESTER_CLOSED','academic_periods',v.id,null,to_jsonb(v),p_reason,
    jsonb_build_object('expected_published_grades',v_expected,'verified_published_grades',v_published)
  );
  return v;
end;
$$;

-- Institutional configuration is a privileged workflow; sensitive binary assets stay in private Storage.
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
) returns public.institution_settings
language plpgsql security definer
set search_path=public,auth
as $$
declare v_old public.institution_settings; v_new public.institution_settings;
begin
  if not public.current_user_has_role('SUPERADMIN') then
    raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_official_name,'')))<8 or length(trim(coalesce(p_short_name,'')))<3 then
    raise exception 'INVALID_INSTITUTION_NAME';
  end if;
  if length(trim(coalesce(p_timezone,'')))<3 then raise exception 'INVALID_TIMEZONE'; end if;

  select * into v_old from public.institution_settings where singleton_key='CBTA241' for update;
  if not found then raise exception 'INSTITUTION_SETTINGS_NOT_FOUND'; end if;

  update public.institution_settings
  set official_name=trim(p_official_name),
      short_name=trim(p_short_name),
      school_key=nullif(trim(coalesce(p_school_key,'')),''),
      address=nullif(trim(coalesce(p_address,'')),''),
      phone=nullif(trim(coalesce(p_phone,'')),''),
      email=nullif(trim(coalesce(p_email,'')),''),
      director_name=nullif(trim(coalesce(p_director_name,'')),''),
      timezone=trim(p_timezone),
      director_signature_storage_path=coalesce(nullif(trim(coalesce(p_signature_path,'')),''),director_signature_storage_path),
      institutional_seal_storage_path=coalesce(nullif(trim(coalesce(p_seal_path,'')),''),institutional_seal_storage_path),
      updated_by=auth.uid()
  where singleton_key='CBTA241'
  returning * into v_new;

  perform public.write_audit('INSTITUTION_SETTINGS_UPDATED','institution_settings',v_new.id,to_jsonb(v_old),to_jsonb(v_new));
  return v_new;
end;
$$;

-- Notify requester and, on approval, the affected student.
create or replace function public.resolve_grade_correction_request(
  p_request_id uuid,
  p_approve boolean,
  p_resolution_reason text
) returns public.grade_change_requests
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_req public.grade_change_requests;
  v_old public.grades;
  v_new public.grades;
  v_student_user uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_resolution_reason,'')))<5 then raise exception 'RESOLUTION_REASON_REQUIRED'; end if;
  select * into v_req from public.grade_change_requests where id=p_request_id for update;
  if not found or v_req.state<>'PENDING' then raise exception 'PENDING_REQUEST_REQUIRED'; end if;

  if p_approve then
    select * into v_old from public.grades where id=v_req.grade_id for update;
    update public.grades set kind=v_req.requested_kind,
      numeric_grade=case when v_req.requested_kind='NUMERIC' then v_req.requested_numeric_grade else null end,
      updated_by=auth.uid(),version=version+1
    where id=v_req.grade_id returning * into v_new;

    insert into public.grade_change_history(grade_id,actor_id,actor_role,old_kind,old_numeric_grade,new_kind,new_numeric_grade,operation,reason,request_id)
    values(v_new.id,auth.uid(),public.current_primary_role(),v_old.kind,v_old.numeric_grade,v_new.kind,v_new.numeric_grade,'REQUEST_APPROVED',p_resolution_reason,v_req.id);

    update public.grade_change_requests set state='APPROVED',resolved_by=auth.uid(),resolution_reason=p_resolution_reason,resolved_at=now()
      where id=v_req.id returning * into v_req;

    select s.profile_id into v_student_user
    from public.grades g
    join public.student_subject_enrollments sse on sse.id=g.student_subject_enrollment_id
    join public.enrollments e on e.id=sse.enrollment_id
    join public.students s on s.id=e.student_id
    where g.id=v_req.grade_id;

    if v_student_user is not null then
      insert into public.notifications(user_id,type,title,body,metadata)
      values(v_student_user,'GRADE_CORRECTED','Calificación corregida','Control Escolar aprobó una corrección de calificación.',jsonb_build_object('grade_id',v_req.grade_id));
    end if;
  else
    update public.grade_change_requests set state='REJECTED',resolved_by=auth.uid(),resolution_reason=p_resolution_reason,resolved_at=now()
      where id=v_req.id returning * into v_req;
  end if;

  insert into public.notifications(user_id,type,title,body,metadata)
  values(v_req.requested_by,
    case when p_approve then 'GRADE_CHANGE_APPROVED' else 'GRADE_CHANGE_REJECTED' end,
    case when p_approve then 'Solicitud aprobada' else 'Solicitud rechazada' end,
    case when p_approve then 'Control Escolar aprobó tu solicitud de corrección.' else 'Control Escolar rechazó tu solicitud de corrección.' end,
    jsonb_build_object('request_id',v_req.id));

  perform public.write_audit(case when p_approve then 'GRADE_CHANGE_APPROVED' else 'GRADE_CHANGE_REJECTED' end,'grade_change_requests',v_req.id,null,to_jsonb(v_req),p_resolution_reason);
  return v_req;
end;
$$;

create or replace function public.authorize_extraordinary(p_sse_id uuid, p_reason text)
returns public.extraordinary_evaluations
language plpgsql security definer
set search_path=public,auth
as $$
declare v_avg numeric; v_extra public.extraordinary_evaluations; v_student_user uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select round(avg(case g.kind when 'NUMERIC' then g.numeric_grade when 'NP' then 0 else null end),1)
    into v_avg
  from public.grades g
  join public.evaluation_periods ep on ep.id=g.evaluation_period_id
  where g.student_subject_enrollment_id=p_sse_id and g.state='PUBLISHED' and ep.partial_number between 1 and 3;
  select st.profile_id into v_student_user
  from public.student_subject_enrollments sse
  join public.enrollments e on e.id=sse.enrollment_id
  join public.students st on st.id=e.student_id
  where sse.id=p_sse_id;
  if v_avg is null or v_avg>=6.0 then raise exception 'NOT_ELIGIBLE_FOR_EXTRAORDINARY'; end if;
  if (select count(*) from public.grades g join public.evaluation_periods ep on ep.id=g.evaluation_period_id where g.student_subject_enrollment_id=p_sse_id and g.state='PUBLISHED' and ep.partial_number between 1 and 3)<>3 then
    raise exception 'ORDINARY_RESULT_INCOMPLETE';
  end if;
  insert into public.extraordinary_evaluations(student_subject_enrollment_id,authorized_by,authorized_at,state)
  values(p_sse_id,auth.uid(),now(),'AUTHORIZED') returning * into v_extra;
  if v_student_user is not null then
    insert into public.notifications(user_id,type,title,body,metadata)
    values(v_student_user,'EXTRAORDINARY_AUTHORIZED','Extraordinario autorizado','Control Escolar autorizó una evaluación extraordinaria.',jsonb_build_object('extraordinary_id',v_extra.id));
  end if;
  perform public.write_audit('EXTRAORDINARY_AUTHORIZED','extraordinary_evaluations',v_extra.id,null,to_jsonb(v_extra),p_reason);
  return v_extra;
exception when unique_violation then
  raise exception 'EXTRAORDINARY_ALREADY_EXISTS';
end;
$$;

create or replace function public.publish_extraordinary(p_extra_id uuid, p_expected_version integer)
returns public.extraordinary_evaluations
language plpgsql security definer
set search_path=public,auth
as $$
declare v_extra public.extraordinary_evaluations; v_student_user uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_extra from public.extraordinary_evaluations where id=p_extra_id for update;
  if not found or v_extra.state<>'CAPTURED' then raise exception 'CAPTURED_EXTRAORDINARY_REQUIRED'; end if;
  if v_extra.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  update public.extraordinary_evaluations
  set state=case when numeric_grade>=6 then 'ACCREDITED' else 'NOT_ACCREDITED' end,
      published_at=now(),version=version+1
  where id=p_extra_id returning * into v_extra;
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

-- Recreate document registration to surface a private in-app notification without exposing the PDF.
create or replace function public.register_academic_document(
  p_student_id uuid,
  p_period_id uuid,
  p_type public.document_type,
  p_folio text,
  p_token_hash text,
  p_storage_path text,
  p_sha256 text
) returns public.academic_documents
language plpgsql security definer
set search_path=public,auth
as $$
declare v_doc public.academic_documents; v_student_user uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(p_token_hash)<>64 or length(p_sha256)<>64 then raise exception 'INVALID_HASH'; end if;
  if not exists(select 1 from public.enrollments where student_id=p_student_id and academic_period_id=p_period_id) then raise exception 'STUDENT_NOT_ENROLLED_IN_PERIOD'; end if;
  insert into public.academic_documents(student_id,academic_period_id,type,folio,current_version,state,verification_token_hash,issued_by)
  values(p_student_id,p_period_id,p_type,p_folio,1,'VIGENTE',p_token_hash,auth.uid()) returning * into v_doc;
  insert into public.document_versions(document_id,version,state,storage_path,sha256,generated_by)
  values(v_doc.id,1,'VIGENTE',p_storage_path,p_sha256,auth.uid());
  select profile_id into v_student_user from public.students where id=p_student_id;
  if v_student_user is not null then
    insert into public.notifications(user_id,type,title,body,metadata)
    values(v_student_user,'DOCUMENT_AVAILABLE','Documento disponible','Control Escolar emitió un nuevo documento académico.',jsonb_build_object('document_id',v_doc.id,'type',p_type));
  end if;
  perform public.write_audit('DOCUMENT_GENERATED','academic_documents',v_doc.id,null,to_jsonb(v_doc),null,jsonb_build_object('sha256',p_sha256));
  return v_doc;
end;
$$;

revoke execute on function public.update_institution_settings_workflow(text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.update_institution_settings_workflow(text,text,text,text,text,text,text,text,text,text) to authenticated;

-- Existing grants remain intentionally narrow after migration 003.
revoke execute on function public.close_academic_period_workflow(uuid,integer,text) from public;
grant execute on function public.close_academic_period_workflow(uuid,integer,text) to authenticated;
revoke execute on function public.resolve_grade_correction_request(uuid,boolean,text) from public;
grant execute on function public.resolve_grade_correction_request(uuid,boolean,text) to authenticated;
revoke execute on function public.authorize_extraordinary(uuid,text) from public;
grant execute on function public.authorize_extraordinary(uuid,text) to authenticated;
revoke execute on function public.publish_extraordinary(uuid,integer) from public;
grant execute on function public.publish_extraordinary(uuid,integer) to authenticated;
revoke execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text) from public;
grant execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text) to authenticated;

commit;
