import { DocumentIssueForm } from '@/components/DocumentIssueForm';
import { PageTitle } from '@/components/PageTitle';
import { PartialReportIssueForm } from '@/components/PartialReportIssueForm';
import { revokeDocumentAction } from '@/features/control/actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Student = { id: string; full_name: string; enrollment_number: string };
type Period = { id: string; label: string; is_closed: boolean };
type StudentRelation = { full_name: string; enrollment_number: string } | null;
type DocumentRow = {
  id: string;
  folio: string;
  type: string;
  scope_key: string;
  current_version: number;
  state: 'VIGENTE' | 'SUSTITUIDO' | 'REVOCADO';
  students: StudentRelation;
};

export default async function ControlDocuments() {
  await requireAuth(['CONTROL_ESCOLAR']);
  const supabase = await createSupabaseServerClient();
  const [{ data: studentsRaw }, { data: periodsRaw }, { data: docsRaw }, { data: settings }] = await Promise.all([
    supabase.from('students').select('id,full_name,enrollment_number').eq('is_active', true).order('full_name').limit(500),
    supabase.from('academic_periods').select('id,label,is_closed').order('ends_on', { ascending: false }),
    supabase.from('academic_documents').select('id,folio,type,scope_key,current_version,state,issued_at,students(full_name,enrollment_number)').order('issued_at', { ascending: false }).limit(100),
    supabase.from('institution_settings').select('director_name,director_signature_storage_path,institutional_seal_storage_path').eq('singleton_key', 'CBTA241').maybeSingle()
  ]);

  const students = (studentsRaw ?? []) as unknown as Student[];
  const periods = (periodsRaw ?? []) as unknown as Period[];
  const docs = (docsRaw ?? []) as unknown as DocumentRow[];
  const studentOptions = students.map((student) => ({ id: student.id, label: `${student.enrollment_number} · ${student.full_name}` }));
  const allPeriodOptions = periods.map((period) => ({ id: period.id, label: period.label }));
  const closedPeriodOptions = periods.filter((period) => period.is_closed).map((period) => ({ id: period.id, label: period.label }));
  const ready = Boolean(settings?.director_name && settings?.director_signature_storage_path && settings?.institutional_seal_storage_path);

  return (
    <>
      <PageTitle
        eyebrow="Documentos inmutables"
        title="Reportes y boletas"
        description="Cada emisión conserva folio, alcance, versión, hash SHA-256 y QR de verificación. Una corrección crea otra versión; nunca sobrescribe la anterior."
      />
      {!ready && <div className="alert">Superadmin debe configurar Director, firma y sello institucional privados. El sistema bloquea documentos oficiales mientras falten esos activos.</div>}

      <section className="section">
        <div className="section-heading"><div><h2>Reporte parcial</h2><p>Solo se emite cuando el parcial está cerrado y todas las calificaciones del alumno están publicadas.</p></div></div>
        <PartialReportIssueForm students={studentOptions} periods={allPeriodOptions} />
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Boleta semestral</h2><p>Solo se emite para periodos cerrados con expediente ordinario y extraordinarios resueltos.</p></div></div>
        <DocumentIssueForm students={studentOptions} periods={closedPeriodOptions} />
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Emisiones recientes</h2><p>Una nueva emisión sobre el mismo alcance requiere motivo y genera V2, V3… El QR de cada versión conserva su estado histórico.</p></div></div>
        <div className="flow-list">
          {docs.map((document) => (
            <div className="flow-row" key={document.id}>
              <div>
                <div className="primary">{document.students?.full_name ?? 'Alumno'}</div>
                <div className="secondary">{document.folio}</div>
              </div>
              <div>{document.type === 'REPORTE_PARCIAL' ? document.scope_key : 'SEMESTRE'} · V{document.current_version}</div>
              <div><span className={`badge ${document.state === 'VIGENTE' ? 'badge-success' : document.state === 'REVOCADO' ? 'badge-danger' : 'badge-warn'}`}>{document.state}</span></div>
              <div className="document-actions">
                <a className="btn btn-ghost" href={`/api/documents/${document.id}`}>Descargar actual</a>
                {document.state === 'VIGENTE' && (
                  <form action={revokeDocumentAction} className="inline-action-form">
                    <input type="hidden" name="document_id" value={document.id} />
                    <input aria-label="Motivo de revocación" name="reason" minLength={5} maxLength={500} placeholder="Motivo para revocar" required />
                    <button className="btn btn-danger">Revocar</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
        {docs.length === 0 && <div className="empty-state">Todavía no se han emitido documentos.</div>}
      </section>
    </>
  );
}
