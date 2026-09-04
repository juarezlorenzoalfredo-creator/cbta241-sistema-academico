import { notFound } from 'next/navigation';
import { GradeCaptureTable } from '@/components/GradeCaptureTable';
import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Assignment = {
  id: string;
  group_id: string;
  subject_id: string;
  academic_period_id: string;
  subjects: { name: string } | null;
  groups: { name: string } | null;
};
type Enrollment = { id: string; students: { id: string; full_name: string; enrollment_number: string } | null };
type SubjectEnrollment = { id: string; enrollment_id: string };
type GradeRow = {
  student_subject_enrollment_id: string;
  kind: 'NUMERIC' | 'NP' | 'PENDING';
  numeric_grade: number | string | null;
  version: number;
  state: 'DRAFT' | 'PUBLISHED';
};

export default async function CaptureDetail({ params }: { params: Promise<{ assignmentId: string; evaluationPeriodId: string }> }) {
  await requireAuth(['DOCENTE']);
  const { assignmentId, evaluationPeriodId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: assignmentRaw } = await supabase.from('teacher_assignments').select('id,group_id,subject_id,academic_period_id,subjects(name),groups(name)').eq('id', assignmentId).maybeSingle();
  const assignment = assignmentRaw as unknown as Assignment | null;
  const { data: evaluation } = await supabase.from('evaluation_periods').select('id,partial_number,state').eq('id', evaluationPeriodId).eq('academic_period_id', assignment?.academic_period_id ?? '00000000-0000-0000-0000-000000000000').maybeSingle();
  if (!assignment || !evaluation) notFound();

  const { data: rawEnrollments } = await supabase.from('enrollments').select('id,students(id,full_name,enrollment_number)').eq('group_id', assignment.group_id).eq('academic_period_id', assignment.academic_period_id).eq('status', 'ACTIVE');
  const enrollments = (rawEnrollments ?? []) as unknown as Enrollment[];
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const { data: rawSubjectEnrollments } = enrollmentIds.length
    ? await supabase.from('student_subject_enrollments').select('id,enrollment_id').in('enrollment_id', enrollmentIds).eq('subject_id', assignment.subject_id).eq('status', 'ACTIVE')
    : { data: [] };
  const subjectEnrollments = (rawSubjectEnrollments ?? []) as unknown as SubjectEnrollment[];
  const sseIds = subjectEnrollments.map((item) => item.id);
  const { data: rawGrades } = sseIds.length
    ? await supabase.from('grades').select('student_subject_enrollment_id,kind,numeric_grade,version,state').in('student_subject_enrollment_id', sseIds).eq('evaluation_period_id', evaluationPeriodId)
    : { data: [] };
  const grades = (rawGrades ?? []) as unknown as GradeRow[];
  const gradeMap = new Map(grades.map((grade) => [grade.student_subject_enrollment_id, grade]));
  const enrollmentMap = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment.students]));
  const rows = subjectEnrollments.map((item) => {
    const student = enrollmentMap.get(item.enrollment_id);
    const grade = gradeMap.get(item.id);
    return {
      sseId: item.id,
      enrollmentNumber: student?.enrollment_number ?? '',
      studentName: student?.full_name ?? 'Alumno',
      kind: grade?.kind ?? 'PENDING' as const,
      numericGrade: grade?.numeric_grade !== null && grade?.numeric_grade !== undefined ? Number(grade.numeric_grade) : null,
      version: grade?.version ?? 0
    };
  }).sort((left, right) => left.studentName.localeCompare(right.studentName, 'es'));
  const alreadyPublished = grades.some((grade) => grade.state === 'PUBLISHED');

  return (
    <>
      <PageTitle
        eyebrow={`Parcial ${evaluation.partial_number}`}
        title={`${assignment.subjects?.name ?? 'Materia'} · Grupo ${assignment.groups?.name ?? ''}`}
        description={alreadyPublished ? 'Este conjunto ya fue publicado. Las correcciones se realizan mediante el flujo de 72 horas / solicitud.' : 'Los cambios se guardan como borrador. Publicar es una transacción todo-o-nada.'}
      />
      <GradeCaptureTable assignmentId={assignmentId} evaluationPeriodId={evaluationPeriodId} initialRows={rows} alreadyPublished={alreadyPublished} />
    </>
  );
}
