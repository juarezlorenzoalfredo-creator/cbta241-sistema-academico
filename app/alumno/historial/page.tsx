import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type EnrollmentRow = {
  id: string;
  status: string;
  academic_periods: { label: string } | null;
  semesters: { label: string } | null;
  groups: { name: string; modality: string } | null;
};

export default async function History() {
  const context = await requireAuth(['ALUMNO']);
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase.from('students').select('id').eq('profile_id', context.userId).maybeSingle();
  const { data: rawEnrollments } = student
    ? await supabase.from('enrollments').select('id,status,academic_periods(label),semesters(label),groups(name,modality)').eq('student_id', student.id).order('created_at', { ascending: false })
    : { data: [] };
  const enrollments = (rawEnrollments ?? []) as unknown as EnrollmentRow[];

  return (
    <>
      <PageTitle eyebrow="Expediente longitudinal" title="Historial académico" description="Cada periodo conserva su propia inscripción; avanzar de semestre no sobrescribe ciclos anteriores." />
      <div className="flow-list">
        {enrollments.map((enrollment) => (
          <div className="flow-row" key={enrollment.id}>
            <div><div className="primary">{enrollment.academic_periods?.label ?? 'Periodo'}</div><div className="secondary">Inscripción {enrollment.id.slice(0, 8)}</div></div>
            <div>{enrollment.semesters?.label ?? '—'} semestre</div>
            <div>Grupo {enrollment.groups?.name ?? '—'} · {enrollment.groups?.modality ?? ''}</div>
            <div><span className="badge">{enrollment.status}</span></div>
          </div>
        ))}
      </div>
      {enrollments.length === 0 && <div className="empty-state">No hay periodos históricos disponibles.</div>}
    </>
  );
}
