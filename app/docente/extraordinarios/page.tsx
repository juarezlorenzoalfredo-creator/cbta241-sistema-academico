import { PageTitle } from '@/components/PageTitle';
import { captureExtraordinaryTeacherAction } from '@/features/grading/correction-actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ExtraRow = {
  id: string;
  state: string;
  numeric_grade: number | string | null;
  version: number;
  scheduled_at: string | null;
  student_subject_enrollment_id: string;
  student_subject_enrollments: {
    subjects: { name: string } | null;
    enrollments: { students: { full_name: string; enrollment_number: string } | null; groups: { name: string } | null } | null;
  } | null;
};

export default async function TeacherExtras() {
  await requireAuth(['DOCENTE']);
  const supabase = await createSupabaseServerClient();
  const { data: rawExtras } = await supabase.from('extraordinary_evaluations').select('id,state,numeric_grade,version,scheduled_at,student_subject_enrollment_id,student_subject_enrollments(subjects(name),enrollments(students(full_name,enrollment_number),groups(name)))').in('state', ['AUTHORIZED', 'SCHEDULED', 'CAPTURED', 'ACCREDITED', 'NOT_ACCREDITED']).order('created_at', { ascending: false });
  const extras = (rawExtras ?? []) as unknown as ExtraRow[];

  return (
    <>
      <PageTitle eyebrow="Evaluación independiente" title="Extraordinarios" description="Solo aparecen extraordinarios vinculados a tus asignaciones vigentes. Capturar no publica: Control Escolar realiza la publicación final." />
      <div className="flow-list">
        {extras.map((record) => {
          const subjectEnrollment = record.student_subject_enrollments;
          const student = subjectEnrollment?.enrollments?.students;
          return (
            <div className="flow-row" key={record.id}>
              <div><div className="primary">{student?.full_name ?? 'Alumno'}</div><div className="secondary">{student?.enrollment_number} · {subjectEnrollment?.subjects?.name} · Grupo {subjectEnrollment?.enrollments?.groups?.name}</div></div>
              <div>{record.numeric_grade !== null ? Number(record.numeric_grade).toFixed(1) : '—'}</div>
              <div><span className={`badge ${record.state === 'ACCREDITED' ? 'badge-success' : record.state === 'NOT_ACCREDITED' ? 'badge-danger' : 'badge-warn'}`}>{record.state}</span></div>
              <div>{['AUTHORIZED', 'SCHEDULED'].includes(record.state) && <form action={captureExtraordinaryTeacherAction} style={{ display: 'flex', gap: '.35rem' }}><input type="hidden" name="extra_id" value={record.id} /><input type="hidden" name="version" value={record.version} /><input aria-label="Calificación de extraordinario" name="grade" placeholder="0.0–10.0" required style={{ width: '95px' }} /><button className="btn btn-primary">Capturar</button></form>}</div>
            </div>
          );
        })}
      </div>
      {extras.length === 0 && <div className="empty-state">No tienes extraordinarios autorizados.</div>}
    </>
  );
}
