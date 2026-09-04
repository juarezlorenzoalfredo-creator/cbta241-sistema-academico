import { PageTitle } from '@/components/PageTitle';
import { assignTeacherAction, enrollStudentAction } from '@/features/control/actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Student = { id: string; full_name: string; enrollment_number: string };
type Period = { id: string; label: string };
type Semester = { id: string; label: string; number: number };
type Group = { id: string; name: string; semester_id: string; academic_period_id: string; modality: string };
type Subject = { id: string; code: string; name: string };
type Teacher = { id: string; employee_number: string | null; full_name: string };
type Enrollment = {
  id: string;
  status: string;
  students: { full_name: string; enrollment_number: string } | null;
  academic_periods: { label: string } | null;
  semesters: { label: string } | null;
  groups: { name: string } | null;
};
type Assignment = {
  id: string;
  teachers: { full_name: string } | null;
  subjects: { name: string } | null;
  groups: { name: string } | null;
  academic_periods: { label: string } | null;
};

export default async function Enrollments() {
  await requireAuth(['CONTROL_ESCOLAR']);
  const supabase = await createSupabaseServerClient();
  const results = await Promise.all([
    supabase.from('students').select('id,full_name,enrollment_number').eq('is_active', true).order('full_name'),
    supabase.from('academic_periods').select('id,label').eq('is_closed', false).order('starts_on', { ascending: false }),
    supabase.from('semesters').select('id,label,number').order('number'),
    supabase.from('groups').select('id,name,semester_id,academic_period_id,modality').eq('is_active', true),
    supabase.from('subjects').select('id,code,name').eq('is_active', true).order('name'),
    supabase.from('teachers').select('id,employee_number,full_name').eq('is_active', true).order('full_name'),
    supabase.from('enrollments').select('id,status,students(full_name,enrollment_number),academic_periods(label),semesters(label),groups(name)').order('created_at', { ascending: false }).limit(100),
    supabase.from('teacher_assignments').select('id,teachers(full_name),subjects(name),groups(name),academic_periods(label)').eq('is_active', true).order('created_at', { ascending: false }).limit(100)
  ]);
  const students = (results[0].data ?? []) as unknown as Student[];
  const periods = (results[1].data ?? []) as unknown as Period[];
  const semesters = (results[2].data ?? []) as unknown as Semester[];
  const groups = (results[3].data ?? []) as unknown as Group[];
  const subjects = (results[4].data ?? []) as unknown as Subject[];
  const teachers = (results[5].data ?? []) as unknown as Teacher[];
  const enrollments = (results[6].data ?? []) as unknown as Enrollment[];
  const assignments = (results[7].data ?? []) as unknown as Assignment[];

  return (
    <>
      <PageTitle eyebrow="Relaciones académicas" title="Inscripciones y asignaciones" description="Cada inscripción crea historia nueva; cada asignación docente determina el alcance real de autorización." />
      <section className="section">
        <div className="section-heading"><div><h2>Inscribir alumno</h2><p>Selecciona periodo, semestre, grupo y materias. No se reutilizan calificaciones de inscripciones anteriores.</p></div></div>
        <form action={enrollStudentAction} className="login-panel document-form" style={{ boxShadow: 'none' }}>
          <div className="field"><label>Alumno</label><select aria-label="Alumno" name="student_id" required>{students.map((item) => <option key={item.id} value={item.id}>{item.enrollment_number} · {item.full_name}</option>)}</select></div>
          <div className="field"><label>Periodo</label><select aria-label="Periodo" name="period_id" required>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div className="field"><label>Semestre</label><select aria-label="Semestre" name="semester_id" required>{semesters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div className="field"><label>Grupo</label><select aria-label="Grupo" name="group_id" required>{groups.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.modality}</option>)}</select></div>
          <div className="field" style={{ gridColumn: '1/-1' }}><label>Materias (Ctrl/Cmd para selección múltiple)</label><select aria-label="Materias (Ctrl/Cmd para selección múltiple)" name="subject_ids" multiple required size={Math.min(8, Math.max(4, subjects.length))}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></div>
          <div><button className="btn btn-primary">Crear inscripción</button></div>
        </form>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Asignar docente</h2><p>Solo puede existir un responsable activo por materia, grupo y periodo.</p></div></div>
        <form action={assignTeacherAction} className="login-panel document-form" style={{ boxShadow: 'none' }}>
          <div className="field"><label>Docente</label><select aria-label="Docente" name="teacher_id" required>{teachers.map((item) => <option key={item.id} value={item.id}>{item.employee_number ?? '—'} · {item.full_name}</option>)}</select></div>
          <div className="field"><label>Materia</label><select aria-label="Materia" name="subject_id" required>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></div>
          <div className="field"><label>Grupo</label><select aria-label="Grupo" name="group_id" required>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Periodo</label><select aria-label="Periodo" name="period_id" required>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <button className="btn btn-primary">Asignar responsable</button>
        </form>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Inscripciones recientes</h2></div></div>
        <div className="flow-list">{enrollments.map((enrollment) => <div className="flow-row" key={enrollment.id}><div><div className="primary">{enrollment.students?.full_name}</div><div className="secondary">{enrollment.students?.enrollment_number}</div></div><div>{enrollment.academic_periods?.label}</div><div>{enrollment.semesters?.label} · Grupo {enrollment.groups?.name}</div><div><span className="badge">{enrollment.status}</span></div></div>)}</div>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Asignaciones vigentes</h2></div></div>
        <div className="flow-list">{assignments.map((assignment) => <div className="flow-row" key={assignment.id}><div><div className="primary">{assignment.subjects?.name}</div><div className="secondary">{assignment.teachers?.full_name}</div></div><div>Grupo {assignment.groups?.name}</div><div>{assignment.academic_periods?.label}</div><div><span className="badge badge-success">VIGENTE</span></div></div>)}</div>
      </section>
    </>
  );
}
