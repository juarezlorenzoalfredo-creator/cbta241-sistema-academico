import { PageTitle } from '@/components/PageTitle';
import { correctPublishedGradeAction, requestCorrectionAction } from '@/features/grading/correction-actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { currentServerEpochMs } from '@/lib/server/time';

type PublishedGrade = {
  id: string;
  kind: 'NUMERIC' | 'NP';
  numeric_grade: number | string | null;
  version: number;
  published_at: string | null;
  evaluation_periods: { partial_number: number } | null;
  student_subject_enrollments: {
    subjects: { name: string } | null;
    enrollments: { students: { full_name: string; enrollment_number: string } | null } | null;
  } | null;
};

export default async function TeacherCorrections() {
  await requireAuth(['DOCENTE']);
  const supabase = await createSupabaseServerClient();
  const { data: rawGrades } = await supabase.from('grades').select('id,kind,numeric_grade,version,published_at,assignment_id,evaluation_periods(partial_number),student_subject_enrollments(subjects(name),enrollments(students(full_name,enrollment_number)))').eq('state', 'PUBLISHED').order('published_at', { ascending: false }).limit(150);
  const grades = (rawGrades ?? []) as unknown as PublishedGrade[];
  const now = currentServerEpochMs();

  return (
    <>
      <PageTitle eyebrow="Corrección trazable" title="Calificaciones publicadas" description="Hasta 72 horas desde published_at puedes corregir directamente. Después, el sistema obliga a enviar una solicitud a Control Escolar." />
      <div className="flow-list">
        {grades.map((grade) => {
          const direct = Boolean(grade.published_at && now <= new Date(grade.published_at).getTime() + 72 * 3_600_000);
          const student = grade.student_subject_enrollments?.enrollments?.students;
          return (
            <div className="flow-row" key={grade.id}>
              <div><div className="primary">{student?.full_name ?? 'Alumno'}</div><div className="secondary">{student?.enrollment_number} · {grade.student_subject_enrollments?.subjects?.name} · P{grade.evaluation_periods?.partial_number}</div></div>
              <div>Actual: <strong>{grade.kind === 'NP' ? 'NP' : Number(grade.numeric_grade).toFixed(1)}</strong></div>
              <div><span className={`badge ${direct ? 'badge-success' : 'badge-warn'}`}>{direct ? 'CORRECCIÓN DIRECTA' : 'REQUIERE SOLICITUD'}</span></div>
              <div>
                <form action={direct ? correctPublishedGradeAction : requestCorrectionAction} className="inline-resolution-form">
                  <input type="hidden" name="grade_id" value={grade.id} />
                  <input type="hidden" name="version" value={grade.version} />
                  <input aria-label="Nueva calificación" name="grade" placeholder="8.5 o NP" required />
                  <input aria-label="Motivo de corrección" name="reason" maxLength={500} placeholder={direct ? 'Motivo opcional' : 'Motivo obligatorio'} minLength={direct ? 0 : 5} required={!direct} />
                  <button className="btn btn-primary">{direct ? 'Corregir' : 'Solicitar cambio'}</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
      {grades.length === 0 && <div className="empty-state">No hay calificaciones publicadas en tus asignaciones.</div>}
    </>
  );
}
