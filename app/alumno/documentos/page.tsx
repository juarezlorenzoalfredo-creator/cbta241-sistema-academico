import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type DocumentRow = {
  id: string;
  type: 'BOLETA_SEMESTRAL' | 'REPORTE_PARCIAL';
  folio: string;
  current_version: number;
  state: 'VIGENTE' | 'SUSTITUIDO' | 'REVOCADO';
  issued_at: string;
};

export default async function Documents() {
  const context = await requireAuth(['ALUMNO']);
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase.from('students').select('id').eq('profile_id', context.userId).maybeSingle();
  const { data: rawDocs } = student
    ? await supabase.from('academic_documents').select('id,type,folio,current_version,state,issued_at').eq('student_id', student.id).order('issued_at', { ascending: false })
    : { data: [] };
  const docs = (rawDocs ?? []) as unknown as DocumentRow[];

  return (
    <>
      <PageTitle eyebrow="Documentos oficiales" title="Mis documentos" description="Las boletas y reportes son versionados. Una corrección conserva las versiones anteriores y su estado histórico." />
      <div className="flow-list">
        {docs.map((document) => (
          <div className="flow-row" key={document.id}>
            <div><div className="primary">{document.type === 'BOLETA_SEMESTRAL' ? 'Boleta semestral' : 'Reporte parcial'}</div><div className="secondary">Folio {document.folio}</div></div>
            <div>Versión {document.current_version}</div>
            <div>{new Date(document.issued_at).toLocaleDateString('es-MX')}</div>
            <div className="document-actions">
              <span className={`badge ${document.state === 'VIGENTE' ? 'badge-success' : document.state === 'REVOCADO' ? 'badge-danger' : 'badge-warn'}`}>{document.state}</span>
              {document.state === 'VIGENTE' && <a className="btn btn-ghost" href={`/api/documents/${document.id}`}>Descargar</a>}
            </div>
          </div>
        ))}
      </div>
      {docs.length === 0 && <div className="empty-state">Aún no hay documentos emitidos para tu expediente.</div>}
    </>
  );
}
