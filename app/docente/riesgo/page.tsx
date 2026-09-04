import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AssignmentRow = {
  subject_id: string;
  group_id: string;
  academic_period_id: string;
  subjects: { name: string } | null;
  groups: { name: string } | null;
};
type EnrollmentRow = { id: string; students: { full_name: string; enrollment_number: string } | null };
type SubjectEnrollment = { id: string; enrollment_id: string };
type GradeRow = {
  student_subject_enrollment_id: string;
  kind: 'NUMERIC' | 'NP';
  numeric_grade: number | string | null;
  evaluation_periods: { partial_number: number } | null;
};
type RiskRow = { name: string; enrollmentNumber: string; subject: string; group: string; partials: number; average: number };

export default async function RiskPage() {
  const context = await requireAuth(['DOCENTE']);
  const supabase = await createSupabaseServerClient();
  const { data: teacher } = await supabase.from('teachers').select('id').eq('profile_id', context.userId).maybeSingle();
  const { data: rawAssignments } = teacher
    ? await supabase.from('teacher_assignments').select('id,subject_id,group_id,academic_period_id,subjects(name),groups(name)').eq('teacher_id', teacher.id).eq('is_active', true)
    : { data: [] };
  const assignments = (rawAssignments ?? []) as unknown as AssignmentRow[];
  const results: RiskRow[] = [];

  for (const assignment of assignments) {
    const { data: rawEnrollments } = await supabase.from('enrollments').select('id,students(full_name,enrollment_number)').eq('group_id', assignment.group_id).eq('academic_period_id', assignment.academic_period_id).eq('status', 'ACTIVE');
    const enrollments = (rawEnrollments ?? []) as unknown as EnrollmentRow[];
    const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
    if (!enrollmentIds.length) continue;

    const { data: rawSubjectEnrollments } = await supabase.from('student_subject_enrollments').select('id,enrollment_id').in('enrollment_id', enrollmentIds).eq('subject_id', assignment.subject_id).eq('status', 'ACTIVE');
    const subjectEnrollments = (rawSubjectEnrollments ?? []) as unknown as SubjectEnrollment[];
    const sseIds = subjectEnrollments.map((item) => item.id);
    if (!sseIds.length) continue;

    const { data: rawGrades } = await supabase.from('grades').select('student_subject_enrollment_id,kind,numeric_grade,state,evaluation_periods(partial_number)').in('student_subject_enrollment_id', sseIds).eq('state', 'PUBLISHED');
    const grades = (rawGrades ?? []) as unknown as GradeRow[];
    const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment.students]));

    for (const subjectEnrollment of subjectEnrollments) {
      const values = grades
        .filter((grade) => grade.student_subject_enrollment_id === subjectEnrollment.id && Number(grade.evaluation_periods?.partial_number) <= 2)
        .sort((left, right) => Number(left.evaluation_periods?.partial_number) - Number(right.evaluation_periods?.partial_number));
      if (values.length !== 1 && values.length !== 2) continue;
      const average = values.reduce((sum, grade) => sum + (grade.kind === 'NP' ? 0 : Number(grade.numeric_grade)), 0) / values.length;
      if (average >= 6) continue;
      const student = enrollmentById.get(subjectEnrollment.enrollment_id);
      results.push({
        name: student?.full_name ?? 'Alumno',
        enrollmentNumber: student?.enrollment_number ?? '',
        subject: assignment.subjects?.name ?? 'Materia',
        group: assignment.groups?.name ?? '',
        partials: values.length,
        average: Math.round(average * 10) / 10
      });
    }
  }

  return (
    <>
      <PageTitle eyebrow="Seguimiento preventivo" title="Alumnos en riesgo" description="EN_RIESGO es preventivo: promedio provisional menor a 6.0 tras P1 o P2. No equivale a reprobación final." />
      <div className="flow-list">
        {results.map((row, index) => (
          <div className="flow-row" key={`${row.enrollmentNumber}-${row.subject}-${index}`}>
            <div><div className="primary">{row.name}</div><div className="secondary">{row.enrollmentNumber} · {row.subject}</div></div>
            <div>Grupo {row.group}</div>
            <div><strong className="grade-fail">{row.average.toFixed(1)}</strong> tras P{row.partials}</div>
            <div><span className="badge badge-warn">EN_RIESGO</span></div>
          </div>
        ))}
      </div>
      {results.length === 0 && <div className="empty-state">No hay alumnos en riesgo con evaluaciones publicadas P1/P2.</div>}
    </>
  );
}
