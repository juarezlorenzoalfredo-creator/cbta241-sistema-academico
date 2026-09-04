begin;

-- Institution signature/seal paths are sensitive metadata. Only the operational
-- roles that configure or issue official documents may read the settings row.
drop policy if exists institution_settings_read on public.institution_settings;
create policy institution_settings_read
on public.institution_settings for select to authenticated
using (
  public.current_user_has_role('CONTROL_ESCOLAR')
  or public.current_user_has_role('SUPERADMIN')
);

-- Students can read only the currently valid document head. Revoked documents
-- remain available to Control Escolar/Superadmin for audit, and historical QR
-- verification continues through the minimized SECURITY DEFINER function.
drop policy if exists documents_select on public.academic_documents;
create policy documents_select
on public.academic_documents for select to authenticated
using (
  public.current_user_has_role('CONTROL_ESCOLAR')
  or public.current_user_has_role('SUPERADMIN')
  or (student_id=public.current_student_id() and state='VIGENTE')
);

-- Students receive only the current VIGENTE immutable version. Historical
-- versions remain preserved but are not directly downloadable by students.
drop policy if exists document_versions_select on public.document_versions;
create policy document_versions_select
on public.document_versions for select to authenticated
using (
  exists(
    select 1
    from public.academic_documents d
    where d.id=document_versions.document_id
      and (
        public.current_user_has_role('CONTROL_ESCOLAR')
        or public.current_user_has_role('SUPERADMIN')
        or (
          d.student_id=public.current_student_id()
          and d.state='VIGENTE'
          and document_versions.version=d.current_version
          and document_versions.state='VIGENTE'
        )
      )
  )
);

-- Align Storage with the document/version policies. A student must not be able
-- to fetch a revoked/superseded PDF by retaining an old object path.
drop policy if exists academic_documents_storage_student_read on storage.objects;
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
      and d.state='VIGENTE'
      and dv.version=d.current_version
      and dv.state='VIGENTE'
  )
);

commit;
