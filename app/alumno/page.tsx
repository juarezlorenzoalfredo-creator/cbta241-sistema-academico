import Link from 'next/link';
import { PageTitle } from '@/components/PageTitle';
import { MetricBand } from '@/components/MetricBand';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/session';

export default async function StudentHome(){
  const context=await requireAuth(['ALUMNO']);
  const supabase=await createSupabaseServerClient();
  const {data:student}=await supabase.from('students').select('id,full_name,enrollment_number').eq('profile_id',context.userId).maybeSingle();
  if(!student) return <><PageTitle eyebrow="Mi trayectoria" title="Aún no hay expediente vinculado" description="Control Escolar debe vincular esta cuenta con un expediente académico activo."/><div className="empty-state">No hay información académica disponible.</div></>;
  const {data:rows}=await supabase.from('student_grade_overview').select('*').eq('student_id',student.id);
  const list=rows??[];
  const completed=list.filter(r=>Number(r.published_partial_count)===3);
  const approved=completed.filter(r=>Number(r.published_average)>=6).length;
  const failed=completed.filter(r=>Number(r.published_average)<6 && !['ACCREDITED','ACCREDITED_EXTRAORDINARY'].includes(String(r.extraordinary_state))).length;
  const extraordinary=list.filter(r=>r.extraordinary_grade!==null).length;
  return <>
    <PageTitle eyebrow="Mi trayectoria" title={`Hola, ${student.full_name.split(' ')[0]}`} description={`Matrícula ${student.enrollment_number}. Aquí ves únicamente información publicada y asociada a tu cuenta.`}/>
    <MetricBand items={[
      {value:list.length,label:'Materias',hint:'Inscritas en el periodo'},
      {value:approved,label:'Aprobadas',hint:'Resultado ordinario publicado'},
      {value:failed,label:'Por atender',hint:'Ordinario no acreditado'},
      {value:extraordinary,label:'Extraordinarios',hint:'Con resultado registrado'}
    ]}/>
    <section className="section"><div className="section-heading"><div><h2>Estado por materia</h2><p>Los promedios ordinarios aparecen cuando existen los tres parciales publicados.</p></div><Link className="btn btn-ghost" href="/alumno/calificaciones">Ver detalle</Link></div>
    {list.length===0?<div className="empty-state">Todavía no hay materias o evaluaciones publicadas.</div>:<div className="flow-list">{list.slice(0,8).map((r)=><div className="flow-row" key={r.student_subject_enrollment_id}><div><div className="primary">{r.subject_name}</div><div className="secondary">P1 {r.p1??'—'} · P2 {r.p2??'—'} · P3 {r.p3??'—'}</div></div><div>{Number(r.published_partial_count)===3?<strong>{Number(r.published_average).toFixed(1)}</strong>:<span className="badge">En curso</span>}</div><div>{Number(r.published_partial_count)===3?(Number(r.published_average)>=6?<span className="badge badge-success">Aprobada</span>:<span className="badge badge-danger">Ordinario no acreditado</span>):<span className="badge">Parcial</span>}</div><div>{r.extraordinary_grade!==null?`Extra ${Number(r.extraordinary_grade).toFixed(1)}`:' '}</div></div>)}</div>}</section>
  </>;
}
