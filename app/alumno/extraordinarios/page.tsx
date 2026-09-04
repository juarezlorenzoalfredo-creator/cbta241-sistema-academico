import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ExtraRow = {
  id: string;
  state: string;
  numeric_grade: number | string | null;
  authorized_at: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  subject_name: string;
  period_label: string;
};

export default async function StudentExtraordinary() {
  await requireAuth(['ALUMNO']);
  const supabase = await createSupabaseServerClient();
  const { data: rowsRaw } = await supabase.rpc('get_my_extraordinary_overview');
  const rows = (rowsRaw ?? []) as unknown as ExtraRow[];

  return <>
    <PageTitle eyebrow="Evaluación independiente" title="Extraordinarios" description="El extraordinario no reemplaza ni elimina tu resultado ordinario. La calificación extraordinaria se mantiene oculta hasta su publicación oficial." />
    <div className="flow-list">
      {rows.map((row) => <div className="flow-row" key={row.id}>
        <div><div className="primary">{row.subject_name}</div><div className="secondary">{row.period_label}</div></div>
        <div>{row.published_at && row.numeric_grade !== null ? Number(row.numeric_grade).toFixed(1) : 'Resultado no publicado'}</div>
        <div>{row.published_at ? new Date(row.published_at).toLocaleDateString('es-MX') : row.scheduled_at ? `Programado ${new Date(row.scheduled_at).toLocaleDateString('es-MX')}` : 'En proceso'}</div>
        <span className={`badge ${row.state === 'ACCREDITED' ? 'badge-success' : row.state === 'NOT_ACCREDITED' ? 'badge-danger' : 'badge-warn'}`}>{row.state}</span>
      </div>)}
    </div>
    {rows.length === 0 && <div className="empty-state">No tienes extraordinarios registrados.</div>}
  </>;
}
