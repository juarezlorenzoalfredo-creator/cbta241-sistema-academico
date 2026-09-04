import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type GradeOverview = {
  student_subject_enrollment_id: string;
  subject_name: string;
  p1: string | null;
  p2: string | null;
  p3: string | null;
  published_average: number | string | null;
  published_partial_count: number | string;
  extraordinary_grade: number | string | null;
  extraordinary_state: string | null;
};

export default async function StudentGrades() {
  const context = await requireAuth(['ALUMNO']);
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase.from('students').select('id').eq('profile_id', context.userId).maybeSingle();
  const { data: rawRows } = student
    ? await supabase.from('student_grade_overview').select('*').eq('student_id', student.id).order('subject_name')
    : { data: [] };
  const rows = (rawRows ?? []) as unknown as GradeOverview[];

  return (
    <>
      <PageTitle eyebrow="Evaluaciones publicadas" title="Mis calificaciones" description="NP se muestra como NP y se calcula como 0.0. Los datos pendientes nunca se presentan como calificación publicada." />
      <div className="grade-table-wrap">
        <table>
          <thead><tr><th>Materia</th><th>P1</th><th>P2</th><th>P3</th><th>Ordinario</th><th>Extra</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const complete = Number(row.published_partial_count) === 3;
              const average = complete && row.published_average !== null ? Number(row.published_average) : null;
              return (
                <tr key={row.student_subject_enrollment_id}>
                  <td><strong>{row.subject_name}</strong></td>
                  <td className="grade-cell">{row.p1 ?? '—'}</td>
                  <td className="grade-cell">{row.p2 ?? '—'}</td>
                  <td className="grade-cell">{row.p3 ?? '—'}</td>
                  <td className={`grade-cell ${average !== null ? (average >= 6 ? 'grade-pass' : 'grade-fail') : ''}`}>{average !== null ? average.toFixed(1) : '—'}</td>
                  <td className="grade-cell">{row.extraordinary_grade !== null ? Number(row.extraordinary_grade).toFixed(1) : '—'}</td>
                  <td>
                    {average === null ? <span className="badge">En curso</span>
                      : average >= 6 ? <span className="badge badge-success">Aprobada</span>
                        : row.extraordinary_state === 'ACCREDITED' ? <span className="badge badge-success">Acreditada por extraordinario</span>
                          : <span className="badge badge-danger">No acreditada</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="empty-state">No hay calificaciones publicadas.</div>}
    </>
  );
}
