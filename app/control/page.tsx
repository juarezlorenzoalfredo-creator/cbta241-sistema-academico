import { MetricBand } from '@/components/MetricBand';
import { PageTitle } from '@/components/PageTitle';
import { createGroupAction, createPeriodAction, createSubjectAction, createTeacherAction } from '@/features/control/actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type SemesterOption = { id: string; label: string; number: number };
type PeriodOption = { id: string; label: string };

export default async function ControlHome() {
  await requireAuth(['CONTROL_ESCOLAR']);
  const supabase = await createSupabaseServerClient();
  const [
    { count: students },
    { count: teachers },
    { count: groups },
    { count: subjects },
    { data: period },
    { data: semestersRaw },
    { data: periodsRaw }
  ] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('academic_periods').select('*').eq('is_current', true).maybeSingle(),
    supabase.from('semesters').select('id,label,number').order('number'),
    supabase.from('academic_periods').select('id,label').order('starts_on', { ascending: false })
  ]);
  const semesters = (semestersRaw ?? []) as unknown as SemesterOption[];
  const periods = (periodsRaw ?? []) as unknown as PeriodOption[];
  const { count: pendingCorrections } = await supabase.from('grade_change_requests').select('id', { count: 'exact', head: true }).eq('state', 'PENDING');
  const { count: pendingExtra } = await supabase.from('extraordinary_evaluations').select('id', { count: 'exact', head: true }).in('state', ['AUTHORIZED', 'SCHEDULED', 'CAPTURED']);

  return (
    <>
      <PageTitle eyebrow="Centro de operaciones" title="Control Escolar" description={period ? `Periodo actual: ${period.label}. Supervisa avance, integridad y excepciones desde una sola superficie.` : 'No hay periodo académico actual. Crea uno para iniciar la operación.'} />
      <MetricBand items={[{ value: students ?? 0, label: 'Alumnos activos' }, { value: teachers ?? 0, label: 'Docentes activos' }, { value: groups ?? 0, label: 'Grupos' }, { value: subjects ?? 0, label: 'Materias' }]} />

      <section className="section">
        <div className="section-heading"><div><h2>Atención operativa</h2><p>Las excepciones aparecen antes que los indicadores decorativos.</p></div></div>
        <div className="action-grid">
          <a className="action-item" href="/control/correcciones"><div><strong>Correcciones pendientes</strong><p>Solicitudes vencida la ventana docente de 72 horas.</p></div><span>{pendingCorrections ?? 0} por resolver →</span></a>
          <a className="action-item" href="/control/extraordinarios"><div><strong>Extraordinarios</strong><p>Autorizados, programados o capturados aún sin resolución final.</p></div><span>{pendingExtra ?? 0} abiertos →</span></a>
          <a className="action-item" href="/control/evaluaciones"><div><strong>Parciales</strong><p>Apertura, cierre y reapertura con motivo y timestamp de servidor.</p></div><span>Gestionar →</span></a>
        </div>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Configuración académica rápida</h2><p>Operaciones auditadas. Los datos maestros no se insertan sin validación.</p></div></div>
        <div className="action-grid">
          <form className="action-item" action={createPeriodAction}>
            <div><strong>Nuevo periodo</strong><div className="field"><label>Tipo</label><select aria-label="Tipo" name="kind"><option value="AUG_JAN">Agosto – Enero</option><option value="FEB_JUL">Febrero – Julio</option></select></div><div className="field"><label>Año inicial</label><input aria-label="Año inicial" name="start_year" type="number" min="2020" max="2200" defaultValue={new Date().getFullYear()} required /></div></div>
            <button className="btn btn-primary">Crear y establecer actual</button>
          </form>
          <form className="action-item" action={createSubjectAction}>
            <div><strong>Nueva materia</strong><div className="field"><label>Clave</label><input aria-label="Clave" name="code" required /></div><div className="field"><label>Nombre</label><input aria-label="Nombre" name="name" required /></div></div>
            <button className="btn btn-primary">Crear materia</button>
          </form>
          <form className="action-item" action={createTeacherAction}>
            <div><strong>Nuevo docente</strong><div className="field"><label>No. empleado</label><input aria-label="No. empleado" name="employee_number" /></div><div className="field"><label>Nombre completo</label><input aria-label="Nombre completo" name="full_name" required /></div></div>
            <button className="btn btn-primary">Crear docente</button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Crear grupo</h2><p>El grupo queda ligado a periodo y semestre para preservar el historial.</p></div></div>
        <form action={createGroupAction} className="login-panel document-form" style={{ boxShadow: 'none' }}>
          <div className="field"><label>Periodo</label><select aria-label="Periodo" name="period_id" required>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div className="field"><label>Semestre</label><select aria-label="Semestre" name="semester_id" required>{semesters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div className="field"><label>Grupo</label><input aria-label="Grupo" name="name" placeholder="A" required /></div>
          <div className="field"><label>Modalidad</label><select aria-label="Modalidad" name="modality"><option>ESCOLARIZADO</option><option>SAETA</option></select></div>
          <div style={{ alignSelf: 'end' }}><button className="btn btn-primary" style={{ width: '100%' }}>Crear grupo</button></div>
        </form>
      </section>
    </>
  );
}
