import { PageTitle } from '@/components/PageTitle';
import { createStudentAction, setStudentActiveAction } from '@/features/control/actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type StudentRow = {
  id: string;
  enrollment_number: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
};

export default async function StudentsPage() {
  await requireAuth(['CONTROL_ESCOLAR']);
  const supabase = await createSupabaseServerClient();
  const { data: rawStudents } = await supabase.from('students').select('id,enrollment_number,full_name,is_active,created_at').order('full_name').limit(200);
  const students = (rawStudents ?? []) as unknown as StudentRow[];

  return (
    <>
      <PageTitle
        eyebrow="Catálogo e inscripción"
        title="Alumnos"
        description="El expediente académico existe independientemente de la cuenta de acceso; la vinculación con Auth puede realizarse sin perder historia."
        action={<span className="badge">{students.length} visibles</span>}
      />
      <section className="section">
        <form action={createStudentAction} className="login-panel compact-form" style={{ boxShadow: 'none' }}>
          <div className="field"><label>Matrícula</label><input aria-label="Matrícula" name="enrollment_number" required /></div>
          <div className="field"><label>Nombre completo</label><input aria-label="Nombre completo" name="full_name" required /></div>
          <button className="btn btn-primary">Registrar alumno</button>
        </form>
      </section>
      <div className="flow-list">
        {students.map((student) => (
          <div className="flow-row" key={student.id}>
            <div><div className="primary">{student.full_name}</div><div className="secondary">Expediente {student.id.slice(0, 8)}</div></div>
            <div>{student.enrollment_number}</div>
            <div>{new Date(student.created_at).toLocaleDateString('es-MX')}</div>
            <form action={setStudentActiveAction} className="inline-action-form">
              <input type="hidden" name="student_id" value={student.id} />
              <input type="hidden" name="active" value={String(!student.is_active)} />
              <input aria-label="Motivo del cambio de estado del alumno" name="reason" minLength={5} maxLength={300} placeholder="Motivo" required />
              <button className="btn btn-ghost">{student.is_active ? 'Dar de baja' : 'Reactivar identidad'}</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
