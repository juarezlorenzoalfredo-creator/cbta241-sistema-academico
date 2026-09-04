import Link from 'next/link';
import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AssignmentRow = {
  id: string;
  academic_period_id: string;
  subjects: { name: string } | null;
  groups: { name: string } | null;
  academic_periods: { label: string } | null;
};
type EvaluationRow = { id: string; academic_period_id: string; partial_number: number; state: 'OPEN' | 'REOPENED' };

export default async function CaptureIndex() {
  const context = await requireAuth(['DOCENTE']);
  const supabase = await createSupabaseServerClient();
  const { data: teacher } = await supabase.from('teachers').select('id').eq('profile_id', context.userId).maybeSingle();
  const { data: rawAssignments } = teacher
    ? await supabase.from('teacher_assignments').select('id,academic_period_id,subjects(name),groups(name),academic_periods(label)').eq('teacher_id', teacher.id).eq('is_active', true)
    : { data: [] };
  const assignments = (rawAssignments ?? []) as unknown as AssignmentRow[];
  const periodIds = [...new Set(assignments.map((assignment) => assignment.academic_period_id))];
  const { data: rawEvaluations } = periodIds.length
    ? await supabase.from('evaluation_periods').select('id,academic_period_id,partial_number,state').in('academic_period_id', periodIds).in('state', ['OPEN', 'REOPENED'])
    : { data: [] };
  const evaluations = (rawEvaluations ?? []) as unknown as EvaluationRow[];

  return (
    <>
      <PageTitle eyebrow="Captura eficiente" title="Calificaciones" description="La tabla está optimizada para navegación por teclado y pegado controlado. No se publica mientras exista un alumno pendiente." />
      <div className="flow-list">
        {assignments.flatMap((assignment) => evaluations.filter((evaluation) => evaluation.academic_period_id === assignment.academic_period_id).map((evaluation) => (
          <div className="flow-row" key={`${assignment.id}-${evaluation.id}`}>
            <div><div className="primary">{assignment.subjects?.name}</div><div className="secondary">Grupo {assignment.groups?.name} · {assignment.academic_periods?.label}</div></div>
            <div>Parcial {evaluation.partial_number}</div>
            <div><span className="badge badge-success">{evaluation.state}</span></div>
            <div><Link className="btn btn-primary" href={`/docente/captura/${assignment.id}/${evaluation.id}`}>Abrir captura</Link></div>
          </div>
        )))}
      </div>
      {evaluations.length === 0 && <div className="empty-state">No hay parciales abiertos en tus asignaciones.</div>}
    </>
  );
}
