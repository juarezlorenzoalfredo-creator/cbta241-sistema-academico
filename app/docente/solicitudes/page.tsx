import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RequestRow = {
  id: string;
  state: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string;
  requested_kind: 'NUMERIC' | 'NP';
  requested_numeric_grade: number | string | null;
  requested_at: string;
  resolution_reason: string | null;
};

export default async function Requests() {
  const context = await requireAuth(['DOCENTE']);
  const supabase = await createSupabaseServerClient();
  const { data: rawRequests } = await supabase.from('grade_change_requests').select('id,state,reason,requested_kind,requested_numeric_grade,requested_at,resolution_reason,grades(id,kind,numeric_grade)').eq('requested_by', context.userId).order('requested_at', { ascending: false });
  const requests = (rawRequests ?? []) as unknown as RequestRow[];

  return (
    <>
      <PageTitle eyebrow="Trazabilidad" title="Solicitudes de corrección" description="Después de 72 horas la modificación directa queda bloqueada y la solicitud debe ser resuelta por Control Escolar." />
      <div className="flow-list">
        {requests.map((request) => (
          <div className="flow-row" key={request.id}>
            <div><div className="primary">Solicitud {request.id.slice(0, 8)}</div><div className="secondary">{request.reason}</div></div>
            <div>{request.requested_kind === 'NUMERIC' ? Number(request.requested_numeric_grade).toFixed(1) : request.requested_kind}</div>
            <div>{new Date(request.requested_at).toLocaleString('es-MX')}</div>
            <div><span className={`badge ${request.state === 'APPROVED' ? 'badge-success' : request.state === 'REJECTED' ? 'badge-danger' : 'badge-warn'}`}>{request.state}</span></div>
          </div>
        ))}
      </div>
      {requests.length === 0 && <div className="empty-state">No has enviado solicitudes de corrección.</div>}
    </>
  );
}
