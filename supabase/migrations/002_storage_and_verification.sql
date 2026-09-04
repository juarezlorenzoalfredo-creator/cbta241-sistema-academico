begin;

-- Private storage only. No public buckets for academic material, signature or seal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('academic-documents','academic-documents',false,10485760,array['application/pdf']),
  ('institution-private','institution-private',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false;

-- Students may read only document versions explicitly associated to themselves.
create policy academic_documents_storage_student_read
on storage.objects for select to authenticated
using (
  bucket_id='academic-documents'
  and exists (
    select 1
    from public.document_versions dv
    join public.academic_documents d on d.id=dv.document_id
    where dv.storage_path=storage.objects.name
      and d.student_id=public.current_student_id()
  )
);

create policy academic_documents_storage_control_all
on storage.objects for all to authenticated
using (
  bucket_id='academic-documents'
  and (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'))
)
with check (
  bucket_id='academic-documents'
  and (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'))
);

create policy institution_private_control_read
on storage.objects for select to authenticated
using (
  bucket_id='institution-private'
  and (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'))
);

create policy institution_private_superadmin_write
on storage.objects for insert to authenticated
with check (
  bucket_id='institution-private'
  and public.current_user_has_role('SUPERADMIN')
);

create policy institution_private_superadmin_update
on storage.objects for update to authenticated
using (bucket_id='institution-private' and public.current_user_has_role('SUPERADMIN'))
with check (bucket_id='institution-private' and public.current_user_has_role('SUPERADMIN'));

create policy institution_private_superadmin_delete
on storage.objects for delete to authenticated
using (bucket_id='institution-private' and public.current_user_has_role('SUPERADMIN'));

-- Public document verification returns intentionally minimized data and no grades.
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
    d.current_version,
    d.state,
    d.issued_at,
    case
      when length(trim(s.full_name)) <= 2 then repeat('*', length(trim(s.full_name)))
      else left(trim(s.full_name),1) || repeat('*', greatest(length(trim(s.full_name))-2,1)) || right(trim(s.full_name),1)
    end,
    s.enrollment_number
  from public.academic_documents d
  join public.students s on s.id=d.student_id
  where d.verification_token_hash=encode(digest(p_token,'sha256'),'hex')
  limit 1;
$$;

revoke all on function public.verify_academic_document(text) from public;
grant execute on function public.verify_academic_document(text) to anon, authenticated;

commit;
