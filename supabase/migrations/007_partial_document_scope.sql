begin;

alter table public.academic_documents add column if not exists scope_key text not null default 'SEMESTER';

do $$
declare v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  where c.conrelid='public.academic_documents'::regclass
    and c.contype='u'
    and pg_get_constraintdef(c.oid) ilike '%student_id%academic_period_id%type%current_version%'
  limit 1;
  if v_name is not null then execute format('alter table public.academic_documents drop constraint %I',v_name); end if;
end $$;

create unique index if not exists academic_documents_scope_unique
on public.academic_documents(student_id,academic_period_id,type,scope_key);

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
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(p_token_hash)<>64 or length(p_sha256)<>64 then raise exception 'INVALID_HASH'; end if;
  if p_type='BOLETA_SEMESTRAL' and p_scope_key<>'SEMESTER' then raise exception 'INVALID_DOCUMENT_SCOPE'; end if;
  if p_type='REPORTE_PARCIAL' and p_scope_key not in ('P1','P2','P3') then raise exception 'INVALID_DOCUMENT_SCOPE'; end if;
  if not exists(select 1 from public.enrollments where student_id=p_student_id and academic_period_id=p_period_id) then raise exception 'STUDENT_NOT_ENROLLED_IN_PERIOD'; end if;
  insert into public.academic_documents(student_id,academic_period_id,type,scope_key,folio,current_version,state,verification_token_hash,issued_by)
  values(p_student_id,p_period_id,p_type,p_scope_key,p_folio,1,'VIGENTE',p_token_hash,auth.uid()) returning * into v_doc;
  insert into public.document_versions(document_id,version,state,storage_path,sha256,generated_by)
  values(v_doc.id,1,'VIGENTE',p_storage_path,p_sha256,auth.uid());
  select profile_id into v_student_user from public.students where id=p_student_id;
  if v_student_user is not null then
    insert into public.notifications(user_id,type,title,body,metadata)
    values(v_student_user,'DOCUMENT_AVAILABLE','Documento disponible','Control Escolar emitió un nuevo documento académico.',jsonb_build_object('document_id',v_doc.id,'type',p_type,'scope',p_scope_key));
  end if;
  perform public.write_audit('DOCUMENT_GENERATED','academic_documents',v_doc.id,null,to_jsonb(v_doc),null,jsonb_build_object('sha256',p_sha256,'scope',p_scope_key));
  return v_doc;
exception when unique_violation then
  raise exception 'DOCUMENT_SCOPE_ALREADY_EXISTS_USE_SUPERSEDE';
end;
$$;

revoke execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text,text) from public;
grant execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text,text) to authenticated;

commit;
