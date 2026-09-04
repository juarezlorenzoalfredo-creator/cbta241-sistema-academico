import { PageTitle } from '@/components/PageTitle';
import { transitionEvaluationAction } from '@/features/control/actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type EvaluationRow = {
  id: string;
  partial_number: number;
  state: 'PLANNED' | 'OPEN' | 'CLOSED' | 'REOPENED';
  opens_at: string | null;
  version: number;
};

export default async function Evaluations() {
  await requireAuth(['CONTROL_ESCOLAR']);
  const supabase = await createSupabaseServerClient();
  const { data: period } = await supabase.from('academic_periods').select('id,label').eq('is_current', true).maybeSingle();
  const { data: rawEvaluations } = period
    ? await supabase.from('evaluation_periods').select('*').eq('academic_period_id', period.id).order('partial_number')
    : { data: [] };
  const evaluations = (rawEvaluations ?? []) as unknown as EvaluationRow[];

  return (
    <>
      <PageTitle eyebrow="Ciclo de evaluación" title="Parciales" description={period ? period.label : 'Crea un periodo actual para administrar P1, P2 y P3.'} />
      <div className="flow-list">
        {evaluations.map((evaluation) => (
          <div className="flow-row" key={evaluation.id}>
            <div><div className="primary">Parcial {evaluation.partial_number}</div><div className="secondary">Versión de control {evaluation.version}</div></div>
            <div><span className={`badge ${evaluation.state === 'OPEN' || evaluation.state === 'REOPENED' ? 'badge-success' : evaluation.state === 'CLOSED' ? '' : 'badge-warn'}`}>{evaluation.state}</span></div>
            <div>{evaluation.opens_at ? `Abrió ${new Date(evaluation.opens_at).toLocaleString('es-MX')}` : 'Sin apertura'}</div>
            <div>
              <form action={transitionEvaluationAction} className="inline-resolution-form">
                <input type="hidden" name="evaluation_id" value={evaluation.id} />
                <input type="hidden" name="version" value={evaluation.version} />
                <select aria-label="Nuevo estado del parcial" name="state" defaultValue={evaluation.state === 'OPEN' ? 'CLOSED' : 'OPEN'}>
                  <option value="OPEN">Abrir</option>
                  <option value="CLOSED">Cerrar</option>
                  <option value="REOPENED">Reabrir</option>
                </select>
                <input aria-label="Motivo del cambio de estado" name="reason" maxLength={500} placeholder="Motivo (obligatorio al reabrir)" />
                <button className="btn btn-ghost">Aplicar</button>
              </form>
            </div>
          </div>
        ))}
      </div>
      {evaluations.length === 0 && <div className="empty-state">No hay evaluaciones configuradas.</div>}
    </>
  );
}
