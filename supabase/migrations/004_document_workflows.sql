begin;

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
declare v_doc public.academic_documents;
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
  perform public.write_audit('DOCUMENT_GENERATED','academic_documents',v_doc.id,null,to_jsonb(v_doc),null,jsonb_build_object('sha256',p_sha256));
  return v_doc;
end;
$$;

create or replace function public.supersede_academic_document(
  p_document_id uuid,
  p_storage_path text,
  p_sha256 text,
  p_reason text
) returns public.academic_documents
language plpgsql security definer
set search_path=public,auth
as $$
declare v_old public.academic_documents; v_doc public.academic_documents; v_next integer;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_old from public.academic_documents where id=p_document_id for update;
  if not found or v_old.state<>'VIGENTE' then raise exception 'CURRENT_DOCUMENT_REQUIRED'; end if;
  v_next:=v_old.current_version+1;
  update public.document_versions set state='SUSTITUIDO',superseded_at=now() where document_id=p_document_id and state='VIGENTE';
  insert into public.document_versions(document_id,version,state,storage_path,sha256,generated_by)
  values(p_document_id,v_next,'VIGENTE',p_storage_path,p_sha256,auth.uid());
  update public.academic_documents set current_version=v_next,issued_at=now(),issued_by=auth.uid() where id=p_document_id returning * into v_doc;
  perform public.write_audit('DOCUMENT_SUPERSEDED','academic_documents',v_doc.id,to_jsonb(v_old),to_jsonb(v_doc),p_reason,jsonb_build_object('sha256',p_sha256));
  return v_doc;
end;
$$;

revoke execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text) from public;
revoke execute on function public.supersede_academic_document(uuid,text,text,text) from public;
grant execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text) to authenticated;
grant execute on function public.supersede_academic_document(uuid,text,text,text) to authenticated;

commit;
