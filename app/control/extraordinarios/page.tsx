import { PageTitle } from '@/components/PageTitle';
import { authorizeExtraordinaryAction, publishExtraordinaryAction } from '@/features/control/actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type OverviewRow = {
  student_subject_enrollment_id: string;
  published_average: number | string;
  published_partial_count: number | string;
  extraordinary_grade: number | string | null;
};
type DetailRow = {
  id: string;
  subjects: { name: string } | null;
  enrollments: { students: { full_name: string; enrollment_number: string } | null; groups: { name: string } | null } | null;
};
type ExtraordinaryRow = {
  id: string;
  state: string;
  numeric_grade: number | string | null;
  version: number;
  authorized_at: string | null;
  captured_at: string | null;
  student_subject_enrollment_id: string;
};

export default async function Extra() {
  await requireAuth(['CONTROL_ESCOLAR']);
  const supabase = await createSupabaseServerClient();
  const [{ data: extrasRaw }, { data: overviewRaw }] = await Promise.all([
    supabase.from('extraordinary_evaluations').select('id,state,numeric_grade,version,authorized_at,captured_at,student_subject_enrollment_id').order('created_at', { ascending: false }),
    supabase.from('student_grade_overview').select('student_subject_enrollment_id,published_average,published_partial_count,extraordinary_grade').eq('published_partial_count', 3).lt('published_average', 6)
  ]);
  const extras = (extrasRaw ?? []) as unknown as ExtraordinaryRow[];
  const overview = (overviewRaw ?? []) as unknown as OverviewRow[];
  const eligible = overview.filter((row) => row.extraordinary_grade === null);
  const ids = eligible.map((row) => row.student_subject_enrollment_id);
  const { data: detailsRaw } = ids.length
    ? await supabase.from('student_subject_enrollments').select('id,subjects(name),enrollments(students(full_name,enrollment_number),groups(name))').in('id', ids)
    : { data: [] };
  const details = (detailsRaw ?? []) as unknown as DetailRow[];
  const detailMap = new Map(details.map((detail) => [detail.id, detail]));

  return (
    <>
      <PageTitle eyebrow="Única oportunidad" title="Extraordinarios" description="El extraordinario es independiente de P1/P2/P3. La calificación ordinaria nunca se reemplaza ni se destruye." />
      <section className="section">
        <div className="section-heading"><div><h2>Elegibles por reprobación ordinaria</h2><p>Tres parciales publicados, promedio ordinario menor a 6.0 y sin extraordinario previo.</p></div></div>
        <div className="flow-list">
          {eligible.map((row) => {
            const detail = detailMap.get(row.student_subject_enrollment_id);
            return (
              <div className="flow-row" key={row.student_subject_enrollment_id}>
                <div><div className="primary">{detail?.enrollments?.students?.full_name ?? 'Alumno'}</div><div className="secondary">{detail?.enrollments?.students?.enrollment_number} · {detail?.subjects?.name} · Grupo {detail?.enrollments?.groups?.name}</div></div>
                <div><strong className="grade-fail">{Number(row.published_average).toFixed(1)}</strong> ordinario</div>
                <div><span className="badge badge-warn">ELEGIBLE</span></div>
                <div><form action={authorizeExtraordinaryAction} className="inline-resolution-form"><input type="hidden" name="sse_id" value={row.student_subject_enrollment_id} /><input aria-label="Motivo para autorizar extraordinario" name="reason" minLength={5} maxLength={500} placeholder="Motivo / fundamento" required /><button className="btn btn-primary">Autorizar</button></form></div>
              </div>
            );
          })}
        </div>
        {eligible.length === 0 && <div className="empty-state">No hay nuevos casos elegibles.</div>}
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Expedientes extraordinarios</h2><p>Solo Control Escolar publica el resultado final.</p></div></div>
        <div className="flow-list">
          {extras.map((record) => (
            <div className="flow-row" key={record.id}>
              <div><div className="primary">Extraordinario {record.id.slice(0, 8)}</div><div className="secondary">SSE {record.student_subject_enrollment_id.slice(0, 8)}</div></div>
              <div>{record.numeric_grade !== null ? Number(record.numeric_grade).toFixed(1) : 'Sin captura'}</div>
              <div><span className={`badge ${record.state === 'ACCREDITED' ? 'badge-success' : record.state === 'NOT_ACCREDITED' ? 'badge-danger' : 'badge-warn'}`}>{record.state}</span></div>
              <div>{record.state === 'CAPTURED' ? <form action={publishExtraordinaryAction}><input type="hidden" name="extra_id" value={record.id} /><input type="hidden" name="version" value={record.version} /><button className="btn btn-primary">Publicar resultado</button></form> : null}</div>
            </div>
          ))}
        </div>
        {extras.length === 0 && <div className="empty-state">No hay extraordinarios creados.</div>}
      </section>
    </>
  );
}
