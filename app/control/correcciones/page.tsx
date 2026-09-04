import { PageTitle } from '@/components/PageTitle';
import { resolveCorrectionAction } from '@/features/control/actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type CorrectionRequest = {
  id: string;
  reason: string;
  requested_kind: 'NUMERIC' | 'NP';
  requested_numeric_grade: number | string | null;
  requested_at: string;
  state: string;
};

export default async function Corrections() {
  await requireAuth(['CONTROL_ESCOLAR']);
  const supabase = await createSupabaseServerClient();
  const { data: rawRequests } = await supabase
    .from('grade_change_requests')
    .select('id,reason,requested_kind,requested_numeric_grade,requested_at,state,grades(id,kind,numeric_grade,student_subject_enrollment_id)')
    .eq('state', 'PENDING')
    .order('requested_at');
  const requests = (rawRequests ?? []) as unknown as CorrectionRequest[];

  return (
    <>
      <PageTitle eyebrow="Excepciones auditables" title="Correcciones" description="Toda resolución exige motivo. Aprobar actualiza la calificación publicada, conserva el valor anterior y notifica al alumno." />
      <div className="flow-list">
        {requests.map((request) => (
          <div className="flow-row" key={request.id}>
            <div><div className="primary">Solicitud {request.id.slice(0, 8)}</div><div className="secondary">{request.reason}</div></div>
            <div>{request.requested_kind === 'NUMERIC' ? Number(request.requested_numeric_grade).toFixed(1) : request.requested_kind}</div>
            <div>{new Date(request.requested_at).toLocaleString('es-MX')}</div>
            <div>
              <form action={resolveCorrectionAction} className="inline-resolution-form">
                <input type="hidden" name="request_id" value={request.id} />
                <select aria-label="Decisión de la solicitud" name="decision"><option value="approve">Aprobar</option><option value="reject">Rechazar</option></select>
                <input aria-label="Motivo de resolución" name="reason" minLength={5} maxLength={500} placeholder="Motivo de resolución" required />
                <button className="btn btn-primary">Resolver</button>
              </form>
            </div>
          </div>
        ))}
      </div>
      {requests.length === 0 && <div className="empty-state">No existen solicitudes pendientes.</div>}
    </>
  );
}
