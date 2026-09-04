import { createClient } from '@supabase/supabase-js';
import { PublicHeader } from '@/components/PublicHeader';

export const dynamic = 'force-dynamic';

type VerificationRecord = {
  authentic: boolean;
  institution: string;
  document_type: 'BOLETA_SEMESTRAL' | 'REPORTE_PARCIAL';
  folio: string;
  version: number;
  document_state: 'VIGENTE' | 'SUSTITUIDO' | 'REVOCADO';
  issued_at: string;
  student_name_masked: string;
  enrollment_number: string;
};

export default async function VerifyToken({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let record: VerificationRecord | null = null;

  if (url && key && token.length >= 32) {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await supabase.rpc('verify_academic_document', { p_token: token });
    const result = Array.isArray(data) ? data[0] : data;
    record = (result ?? null) as VerificationRecord | null;
  }

  const isCurrent = record?.document_state === 'VIGENTE';
  const stateLabel = record?.document_state === 'SUSTITUIDO'
    ? 'VERSIÓN SUSTITUIDA'
    : record?.document_state === 'REVOCADO'
      ? 'DOCUMENTO REVOCADO'
      : 'VIGENTE';

  return (
    <div className="public-shell">
      <PublicHeader />
      <main id="contenido" className="login-stage" style={{ gridTemplateColumns: '1fr', maxWidth: '760px' }}>
        <section className="login-panel">
          {record ? (
            <>
              <div className="eyebrow">Documento auténtico</div>
              <h1 style={{ color: 'var(--institution-green)' }}>
                {isCurrent ? 'Verificación vigente' : 'Verificación histórica'}
              </h1>
              {!isCurrent && (
                <div className={record.document_state === 'REVOCADO' ? 'alert alert-danger' : 'alert'}>
                  El QR corresponde a una versión auténtica, pero ya no es la versión vigente. Estado: {stateLabel}.
                </div>
              )}
              <div className="flow-list">
                <div className="flow-row">
                  <strong>Institución</strong><span>{record.institution}</span><span></span>
                  <span className={isCurrent ? 'badge badge-success' : 'badge badge-warn'}>{stateLabel}</span>
                </div>
                <div className="flow-row">
                  <strong>Tipo</strong><span>{record.document_type}</span><span>Versión {record.version}</span><span className="badge">AUTÉNTICO</span>
                </div>
                <div className="flow-row">
                  <strong>Folio</strong><span>{record.folio}</span><span>{new Date(record.issued_at).toLocaleDateString('es-MX')}</span><span></span>
                </div>
                <div className="flow-row">
                  <strong>Alumno</strong><span>{record.student_name_masked}</span><span>Matrícula {record.enrollment_number}</span><span></span>
                </div>
              </div>
              <p className="form-note">Por protección de datos, esta verificación no muestra calificaciones ni permite descargar el documento.</p>
            </>
          ) : (
            <>
              <div className="eyebrow">Verificación</div>
              <h1>No fue posible validar el documento.</h1>
              <div className="alert alert-danger">El token no existe, fue alterado o no corresponde a una versión documental registrada.</div>
            </>
          )}
        </section>
      </main>
      <footer className="footer">CBTA 241 · Servicio público de autenticidad documental</footer>
    </div>
  );
}
