import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type SubjectRow = {
  id: string;
  status: string;
  subjects: { code: string; name: string } | null;
  enrollments: {
    academic_periods: { label: string; is_current: boolean } | null;
    groups: { name: string } | null;
    semesters: { label: string } | null;
  } | null;
};

export default async function StudentSubjects() {
  const context = await requireAuth(['ALUMNO']);
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase.from('students').select('id').eq('profile_id', context.userId).maybeSingle();
  const { data: rowsRaw } = student
    ? await supabase.from('student_subject_enrollments')
      .select('id,status,subjects(code,name),enrollments!inner(student_id,academic_periods(label,is_current),groups(name),semesters(label))')
      .eq('enrollments.student_id', student.id)
      .order('created_at', { ascending: false })
    : { data: [] };
  const rows = (rowsRaw ?? []) as unknown as SubjectRow[];

  return <>
    <PageTitle eyebrow="Carga académica" title="Mis materias" description="Materias asociadas a tus inscripciones históricas. El periodo actual se identifica sin sobrescribir ciclos anteriores." />
    <div className="flow-list">
      {rows.map((row) => <div className="flow-row" key={row.id}>
        <div><div className="primary">{row.subjects?.name ?? 'Materia'}</div><div className="secondary">{row.subjects?.code ?? 'Sin clave'}</div></div>
        <div>{row.enrollments?.semesters?.label ?? '—'} · Grupo {row.enrollments?.groups?.name ?? '—'}</div>
        <div>{row.enrollments?.academic_periods?.label ?? '—'}</div>
        <span className={`badge ${row.status === 'ACTIVE' ? 'badge-success' : ''}`}>{row.enrollments?.academic_periods?.is_current ? 'ACTUAL' : row.status}</span>
      </div>)}
    </div>
    {rows.length === 0 && <div className="empty-state">No existen materias asociadas a tu expediente.</div>}
  </>;
}
