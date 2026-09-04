begin;

-- Every immutable document version receives its own verification token hash.
-- This allows an old QR to continue proving authenticity while clearly reporting
-- that the referenced version was superseded or revoked.
alter table public.document_versions
  add column if not exists verification_token_hash text;

update public.document_versions dv
set verification_token_hash = d.verification_token_hash
from public.academic_documents d
where d.id = dv.document_id
  and dv.version = d.current_version
  and dv.verification_token_hash is null;

create unique index if not exists document_versions_verification_token_hash_unique
  on public.document_versions(verification_token_hash)
  where verification_token_hash is not null;

alter table public.document_versions
  drop constraint if exists document_versions_verification_token_hash_length;
alter table public.document_versions
  add constraint document_versions_verification_token_hash_length
  check (verification_token_hash is null or length(verification_token_hash)=64);

-- Registration writes the token on both the document head and immutable v1.
create or replace function public.register_academic_document(
  p_student_id uuid,
  p_period_id uuid,
  p_type public.document_type,
  p_scope_key text,
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
  if p_type='BOLETA_SEMESTRAL' and p_scope_key<>'SEMESTER' then raise exception 'INVALID_DOCUMENT_SCOPE'; end if;
  if p_type='REPORTE_PARCIAL' and p_scope_key not in ('P1','P2','P3') then raise exception 'INVALID_DOCUMENT_SCOPE'; end if;
  if not exists(select 1 from public.enrollments where student_id=p_student_id and academic_period_id=p_period_id) then
    raise exception 'STUDENT_NOT_ENROLLED_IN_PERIOD';
  end if;

  insert into public.academic_documents(student_id,academic_period_id,type,scope_key,folio,current_version,state,verification_token_hash,issued_by)
  values(p_student_id,p_period_id,p_type,p_scope_key,p_folio,1,'VIGENTE',p_token_hash,auth.uid())
  returning * into v_doc;

  insert into public.document_versions(document_id,version,state,storage_path,sha256,verification_token_hash,generated_by)
  values(v_doc.id,1,'VIGENTE',p_storage_path,p_sha256,p_token_hash,auth.uid());

  select profile_id into v_student_user from public.students where id=p_student_id;
  if v_student_user is not null then
    insert into public.notifications(user_id,type,title,body,metadata)
    values(v_student_user,'DOCUMENT_AVAILABLE','Documento disponible','Control Escolar emitió un nuevo documento académico.',jsonb_build_object('document_id',v_doc.id,'type',p_type,'scope',p_scope_key,'version',1));
  end if;

  perform public.write_audit('DOCUMENT_GENERATED','academic_documents',v_doc.id,null,to_jsonb(v_doc),null,jsonb_build_object('sha256',p_sha256,'scope',p_scope_key,'version',1));
  return v_doc;
exception when unique_violation then
  raise exception 'DOCUMENT_SCOPE_ALREADY_EXISTS_USE_SUPERSEDE';
end;
$$;

-- Replace the old supersede signature. Each new version gets a fresh QR token,
-- while the previous version keeps its old token and becomes SUSTITUIDO.
drop function if exists public.supersede_academic_document(uuid,text,text,text);

create or replace function public.supersede_academic_document(
  p_document_id uuid,
  p_storage_path text,
  p_sha256 text,
  p_token_hash text,
  p_reason text
) returns public.academic_documents
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_old public.academic_documents;
  v_doc public.academic_documents;
  v_next integer;
  v_student_user uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if length(p_token_hash)<>64 or length(p_sha256)<>64 then raise exception 'INVALID_HASH'; end if;

  select * into v_old from public.academic_documents where id=p_document_id for update;
  if not found or v_old.state<>'VIGENTE' then raise exception 'CURRENT_DOCUMENT_REQUIRED'; end if;

  v_next:=v_old.current_version+1;

  update public.document_versions
  set state='SUSTITUIDO',superseded_at=now()
  where document_id=p_document_id and version=v_old.current_version and state='VIGENTE';

  insert into public.document_versions(document_id,version,state,storage_path,sha256,verification_token_hash,generated_by)
  values(p_document_id,v_next,'VIGENTE',p_storage_path,p_sha256,p_token_hash,auth.uid());

  update public.academic_documents
  set current_version=v_next,
      state='VIGENTE',
      verification_token_hash=p_token_hash,
      issued_at=now(),
      issued_by=auth.uid()
  where id=p_document_id
  returning * into v_doc;

  select profile_id into v_student_user from public.students where id=v_doc.student_id;
  if v_student_user is not null then
    insert into public.notifications(user_id,type,title,body,metadata)
    values(v_student_user,'DOCUMENT_AVAILABLE','Documento actualizado','Control Escolar emitió una nueva versión de un documento académico.',jsonb_build_object('document_id',v_doc.id,'type',v_doc.type,'scope',v_doc.scope_key,'version',v_next));
  end if;

  perform public.write_audit('DOCUMENT_SUPERSEDED','academic_documents',v_doc.id,to_jsonb(v_old),to_jsonb(v_doc),p_reason,jsonb_build_object('sha256',p_sha256,'version',v_next));
  return v_doc;
end;
$$;

create or replace function public.revoke_academic_document(
  p_document_id uuid,
  p_reason text
) returns public.academic_documents
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_old public.academic_documents;
  v_doc public.academic_documents;
  v_student_user uuid;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then
    raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;

  select * into v_old from public.academic_documents where id=p_document_id for update;
  if not found or v_old.state<>'VIGENTE' then raise exception 'CURRENT_DOCUMENT_REQUIRED'; end if;

  update public.document_versions
  set state='REVOCADO',superseded_at=coalesce(superseded_at,now())
  where document_id=p_document_id and version=v_old.current_version and state='VIGENTE';

  update public.academic_documents
  set state='REVOCADO',issued_at=now(),issued_by=auth.uid()
  where id=p_document_id returning * into v_doc;

  select profile_id into v_student_user from public.students where id=v_doc.student_id;
  if v_student_user is not null then
    insert into public.notifications(user_id,type,title,body,metadata)
    values(v_student_user,'DOCUMENT_REVOKED','Documento revocado','Control Escolar revocó un documento académico. Consulta el estado vigente de tu expediente.',jsonb_build_object('document_id',v_doc.id,'type',v_doc.type,'scope',v_doc.scope_key,'version',v_doc.current_version));
  end if;

  perform public.write_audit('DOCUMENT_REVOKED','academic_documents',v_doc.id,to_jsonb(v_old),to_jsonb(v_doc),p_reason,jsonb_build_object('version',v_doc.current_version));
  return v_doc;
end;
$$;

-- Verification is version-aware. A superseded or revoked version still proves
-- historical authenticity, but its state is explicit and must not be presented
-- as currently valid by the UI.
create or replace function public.verify_academic_document(p_token text)
returns table(
  authentic boolean,
  institution text,
  document_type public.document_type,
  folio text,
  version integer,
  document_state public.document_state,
  issued_at timestamptz,
  student_name_masked text,
  enrollment_number text
)
language sql
stable
security definer
set search_path=public,extensions
as $$
  select
    true,
    'CBTA 241'::text,
    d.type,
    d.folio,
    dv.version,
    dv.state,
    dv.generated_at,
    case
      when length(trim(s.full_name)) <= 2 then repeat('*', length(trim(s.full_name)))
      else left(trim(s.full_name),1) || repeat('*', greatest(length(trim(s.full_name))-2,1)) || right(trim(s.full_name),1)
    end,
    s.enrollment_number
  from public.document_versions dv
  join public.academic_documents d on d.id=dv.document_id
  join public.students s on s.id=d.student_id
  where dv.verification_token_hash=encode(digest(p_token,'sha256'),'hex')
  limit 1;
$$;

-- Strengthen semester close: every ordinary failure must have a resolved
-- extraordinary outcome (or an explicitly cancelled case) before closure.
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

  with ordinary as (
    select sse.id,
           round(avg(case g.kind when 'NUMERIC' then g.numeric_grade when 'NP' then 0 else null end),1) as average_grade,
           count(*) as published_count
    from public.student_subject_enrollments sse
    join public.enrollments e on e.id=sse.enrollment_id
    join public.grades g on g.student_subject_enrollment_id=sse.id and g.state='PUBLISHED'
    join public.evaluation_periods ep on ep.id=g.evaluation_period_id and ep.partial_number between 1 and 3
    where e.academic_period_id=p_period_id and e.status='ACTIVE' and sse.status='ACTIVE'
    group by sse.id
  )
  select count(*) into v_problem
  from ordinary o
  left join public.extraordinary_evaluations x on x.student_subject_enrollment_id=o.id
  where o.published_count=3
    and o.average_grade<6.0
    and (x.id is null or x.state not in ('ACCREDITED','NOT_ACCREDITED','CANCELLED'));

  if v_problem>0 then raise exception 'UNRESOLVED_ORDINARY_FAILURES'; end if;

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

revoke execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text,text) from public;
revoke execute on function public.supersede_academic_document(uuid,text,text,text,text) from public;
revoke execute on function public.revoke_academic_document(uuid,text) from public;
revoke execute on function public.verify_academic_document(text) from public;
revoke execute on function public.close_academic_period_workflow(uuid,integer,text) from public;

grant execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text,text) to authenticated;
grant execute on function public.supersede_academic_document(uuid,text,text,text,text) to authenticated;
grant execute on function public.revoke_academic_document(uuid,text) to authenticated;
grant execute on function public.verify_academic_document(text) to anon,authenticated;
grant execute on function public.close_academic_period_workflow(uuid,integer,text) to authenticated;

commit;
