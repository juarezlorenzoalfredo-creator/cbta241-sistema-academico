import { PageTitle } from '@/components/PageTitle';
import { requireAuth, type AppRole } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAccountAction,replaceRoleAction,sendRecoveryAction,toggleAccountAction } from '@/features/admin/actions';

type ProfileRow={id:string;display_name:string;email:string|null;is_active:boolean;user_roles:Array<{role:AppRole}>};
type Person={id:string;full_name:string;enrollment_number?:string;employee_number?:string|null};

export default async function UsersPage(){
  await requireAuth(['SUPERADMIN']);
  const s=await createSupabaseServerClient();
  const [{data:profiles},{data:students},{data:teachers}]=await Promise.all([
    s.from('profiles').select('id,display_name,email,is_active,user_roles(role)').order('display_name'),
    s.from('students').select('id,full_name,enrollment_number,profile_id').is('profile_id',null).eq('is_active',true).order('full_name'),
    s.from('teachers').select('id,full_name,employee_number,profile_id').is('profile_id',null).eq('is_active',true).order('full_name')
  ]);
  const rows=(profiles??[]) as unknown as ProfileRow[];
  const studentRows=(students??[]) as unknown as Person[];
  const teacherRows=(teachers??[]) as unknown as Person[];
  return <>
    <PageTitle eyebrow="Control de acceso" title="Usuarios y roles" description="Las cuentas Auth se crean desde servidor. La Service Role nunca se expone al navegador y toda vinculación académica queda auditada."/>
    <section className="section"><div className="section-heading"><div><h2>Crear cuenta</h2><p>Contraseña inicial mínima de 12 caracteres. Para Alumno/Docente se exige vincular un registro académico disponible.</p></div></div>
      <form action={createAccountAction} className="login-panel admin-grid" style={{boxShadow:'none'}}>
        <div className="field"><label htmlFor="display_name">Nombre</label><input id="display_name" name="display_name" minLength={2} required/></div>
        <div className="field"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" required/></div>
        <div className="field"><label htmlFor="password">Contraseña inicial</label><input id="password" name="password" type="password" minLength={12} required/></div>
        <div className="field"><label htmlFor="role">Rol</label><select id="role" name="role" defaultValue="ALUMNO"><option>ALUMNO</option><option>DOCENTE</option><option>CONTROL_ESCOLAR</option><option>SUPERADMIN</option></select></div>
        <div className="field"><label htmlFor="student_id">Vincular alumno (si aplica)</label><select id="student_id" name="student_id"><option value="">—</option>{studentRows.map(x=><option key={x.id} value={x.id}>{x.enrollment_number} · {x.full_name}</option>)}</select></div>
        <div className="field"><label htmlFor="teacher_id">Vincular docente (si aplica)</label><select id="teacher_id" name="teacher_id"><option value="">—</option>{teacherRows.map(x=><option key={x.id} value={x.id}>{x.employee_number??'—'} · {x.full_name}</option>)}</select></div>
        <div><button className="btn btn-primary">Crear cuenta segura</button></div>
      </form>
    </section>
    <section className="section"><div className="section-heading"><div><h2>Directorio de acceso</h2><p>Desactivar preserva historial; no se eliminan identidades con trazabilidad académica.</p></div></div>
      <div className="flow-list">{rows.map(x=>{const role=x.user_roles[0]?.role??'ALUMNO';return <div className="flow-row" key={x.id}>
        <div><div className="primary">{x.display_name}</div><div className="secondary">{x.email??'Sin correo'} · {x.id.slice(0,8)}</div></div>
        <div><span className="badge">{role}</span></div>
        <div><span className={`badge ${x.is_active?'badge-success':'badge-danger'}`}>{x.is_active?'ACTIVO':'INACTIVO'}</span></div>
        <div className="inline-actions">
          <form action={toggleAccountAction}><input type="hidden" name="user_id" value={x.id}/><input type="hidden" name="active" value={String(!x.is_active)}/><input type="hidden" name="reason" value={x.is_active?'Desactivación administrativa de cuenta':'Reactivación administrativa de cuenta'}/><button className="btn btn-ghost">{x.is_active?'Desactivar':'Reactivar'}</button></form>
          {x.email&&<form action={sendRecoveryAction}><input type="hidden" name="email" value={x.email}/><button className="btn btn-ghost">Enviar recuperación</button></form>}
        </div>
        <form action={replaceRoleAction} className="inline-actions"><input type="hidden" name="user_id" value={x.id}/><select aria-label="Nuevo rol" name="role" defaultValue={role}><option>ALUMNO</option><option>DOCENTE</option><option>CONTROL_ESCOLAR</option><option>SUPERADMIN</option></select><input aria-label="Motivo del cambio de rol" name="reason" minLength={5} placeholder="Motivo del cambio" required/><button className="btn btn-ghost">Cambiar rol</button></form>
      </div>})}</div>
      {rows.length===0&&<div className="empty-state">No existen perfiles provisionados.</div>}
    </section>
  </>;
}
