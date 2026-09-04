import Link from 'next/link';
import { MetricBand } from '@/components/MetricBand';
import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AssignmentRow = {
  id: string;
  subjects: { name: string } | null;
  groups: { name: string } | null;
  academic_periods: { label: string } | null;
};

export default async function TeacherHome() {
  const context = await requireAuth(['DOCENTE']);
  const supabase = await createSupabaseServerClient();
  const { data: teacher } = await supabase.from('teachers').select('id,full_name').eq('profile_id', context.userId).maybeSingle();
  const { data: rawAssignments } = teacher
    ? await supabase.from('teacher_assignments').select('id,subjects(name),groups(name),academic_periods(label)').eq('teacher_id', teacher.id).eq('is_active', true)
    : { data: [] };
  const assignments = (rawAssignments ?? []) as unknown as AssignmentRow[];
  const { count: pendingRequests } = await supabase.from('grade_change_requests').select('id', { count: 'exact', head: true }).eq('requested_by', context.userId).eq('state', 'PENDING');

  return (
    <>
      <PageTitle eyebrow="Operación docente" title={teacher ? `Hola, ${teacher.full_name.split(' ')[0]}` : 'Panel docente'} description="Captura rápida, publicación atómica y seguimiento de alumnos exclusivamente en tus asignaciones vigentes." />
      <MetricBand items={[{ value: assignments.length, label: 'Asignaciones', hint: 'Vigentes' }, { value: 3, label: 'Parciales', hint: 'Mismo peso' }, { value: pendingRequests ?? 0, label: 'Solicitudes', hint: 'Pendientes de resolver' }, { value: '72 h', label: 'Corrección', hint: 'Desde published_at' }]} />
      <section className="section">
        <div className="section-heading"><div><h2>Mis asignaciones</h2><p>Selecciona Captura para trabajar con el parcial abierto.</p></div><Link className="btn btn-primary" href="/docente/captura">Ir a captura</Link></div>
        <div className="flow-list">
          {assignments.map((assignment) => (
            <div className="flow-row" key={assignment.id}>
              <div><div className="primary">{assignment.subjects?.name}</div><div className="secondary">{assignment.academic_periods?.label}</div></div>
              <div>Grupo {assignment.groups?.name}</div>
              <div><span className="badge badge-success">Asignación vigente</span></div>
              <div><Link href="/docente/captura">Capturar →</Link></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
