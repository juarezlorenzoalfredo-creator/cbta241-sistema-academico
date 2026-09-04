import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Assignment = { id:string; is_active:boolean; subjects:{code:string;name:string}|null; groups:{name:string}|null; academic_periods:{label:string}|null };
export default async function TeacherSubjects(){
  const context=await requireAuth(['DOCENTE']); const s=await createSupabaseServerClient();
  const {data:teacher}=await s.from('teachers').select('id').eq('profile_id',context.userId).maybeSingle();
  const {data:raw}=teacher?await s.from('teacher_assignments').select('id,is_active,subjects(code,name),groups(name),academic_periods(label)').eq('teacher_id',teacher.id).order('created_at',{ascending:false}):{data:[]};
  const rows=(raw??[]) as unknown as Assignment[];
  return <><PageTitle eyebrow="Responsabilidad vigente" title="Mis materias" description="Solo aparecen asignaciones que RLS vincula con tu identidad docente. Las sustituciones conservan el registro histórico."/>
    <div className="flow-list">{rows.map(x=><div className="flow-row" key={x.id}><div><div className="primary">{x.subjects?.name??'Materia'}</div><div className="secondary">{x.subjects?.code??'Sin clave'}</div></div><div>Grupo {x.groups?.name??'—'}</div><div>{x.academic_periods?.label??'—'}</div><span className={`badge ${x.is_active?'badge-success':''}`}>{x.is_active?'VIGENTE':'HISTÓRICA'}</span></div>)}</div>
    {rows.length===0&&<div className="empty-state">No tienes materias asignadas.</div>}</>;
}
