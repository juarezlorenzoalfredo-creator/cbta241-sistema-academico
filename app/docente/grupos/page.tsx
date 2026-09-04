import { PageTitle } from '@/components/PageTitle';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Assignment={id:string;is_active:boolean;subjects:{name:string}|null;groups:{name:string;modality:string;semesters:{label:string}|null}|null;academic_periods:{label:string}|null};
export default async function TeacherGroups(){
  const context=await requireAuth(['DOCENTE']);const s=await createSupabaseServerClient();
  const {data:teacher}=await s.from('teachers').select('id').eq('profile_id',context.userId).maybeSingle();
  const {data:raw}=teacher?await s.from('teacher_assignments').select('id,is_active,subjects(name),groups(name,modality,semesters(label)),academic_periods(label)').eq('teacher_id',teacher.id).eq('is_active',true):{data:[]};
  const rows=(raw??[]) as unknown as Assignment[];
  return <><PageTitle eyebrow="Grupos asignados" title="Mis grupos" description="Cada grupo se muestra dentro del periodo y materia que autorizan tu acceso a sus alumnos."/>
  <div className="flow-list">{rows.map(x=><div className="flow-row" key={x.id}><div><div className="primary">Grupo {x.groups?.name??'—'}</div><div className="secondary">{x.groups?.semesters?.label??'—'} · {x.groups?.modality??'—'}</div></div><div>{x.subjects?.name??'Materia'}</div><div>{x.academic_periods?.label??'—'}</div><span className="badge badge-success">ASIGNADO</span></div>)}</div>
  {rows.length===0&&<div className="empty-state">No tienes grupos vigentes.</div>}</>;
}
