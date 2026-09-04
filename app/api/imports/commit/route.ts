import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { reportServerFailure } from '@/lib/errors/server';

type Kind='students'|'teachers'|'subjects'|'assignments';
type Row={row:number;[key:string]:unknown};
type RowFailure='REFERENCE_NOT_FOUND'|'GROUP_NOT_FOUND'|'SERVER_RULE_REJECTED';
function value(row:Row,key:string){return String(row[key]??'').trim()}
function friendlyFailure(code:RowFailure){
  if(code==='REFERENCE_NOT_FOUND')return 'No se encontró el docente, materia o periodo referenciado.';
  if(code==='GROUP_NOT_FOUND')return 'No se encontró el grupo activo dentro del periodo indicado.';
  return 'La fila fue rechazada por una regla de integridad o autorización del servidor.';
}
export async function POST(request:Request){
  const auth=await getAuthContext();if(!auth?.roles.includes('CONTROL_ESCOLAR'))return NextResponse.json({error:'FORBIDDEN'},{status:403});
  const body=await request.json() as {kind?:Kind;rows?:Row[]};const kind=body.kind;const rows=body.rows;
  if(!kind||!['students','teachers','subjects','assignments'].includes(kind)||!Array.isArray(rows)||rows.length===0||rows.length>1000)return NextResponse.json({error:'INVALID_IMPORT_BATCH'},{status:400});
  const s=await createSupabaseServerClient();const results:Array<{row:number;ok:boolean;message:string}>=[];
  for(const row of rows){
    try{
      let error:{code?:string}|null=null;
      if(kind==='students')({error}=await s.rpc('create_student_record',{p_enrollment_number:value(row,'enrollment_number'),p_full_name:value(row,'full_name')}));
      else if(kind==='teachers')({error}=await s.rpc('create_teacher_record',{p_employee_number:value(row,'employee_number'),p_full_name:value(row,'full_name')}));
      else if(kind==='subjects')({error}=await s.rpc('create_subject_record',{p_code:value(row,'code'),p_name:value(row,'name')}));
      else{
        const employee=value(row,'employee_number'),code=value(row,'subject_code'),group=value(row,'group').toUpperCase(),period=value(row,'period_label');
        const [{data:t},{data:sub},{data:p}]=await Promise.all([
          s.from('teachers').select('id').eq('employee_number',employee).eq('is_active',true).maybeSingle(),
          s.from('subjects').select('id').eq('code',code.toUpperCase()).eq('is_active',true).maybeSingle(),
          s.from('academic_periods').select('id').eq('label',period).maybeSingle()
        ]);
        if(!t||!sub||!p)throw new Error('REFERENCE_NOT_FOUND');
        const {data:g}=await s.from('groups').select('id').eq('academic_period_id',p.id).eq('name',group).eq('is_active',true).maybeSingle();if(!g)throw new Error('GROUP_NOT_FOUND');
        ({error}=await s.rpc('assign_teacher_workflow',{p_teacher_id:t.id,p_subject_id:sub.id,p_group_id:g.id,p_period_id:p.id}));
      }
      if(error){
        const errorId=reportServerFailure('IMPORT_ROW_REJECTED',error);
        results.push({row:Number(row.row),ok:false,message:`${friendlyFailure('SERVER_RULE_REJECTED')} · Error ID: ${errorId}`});
      }else results.push({row:Number(row.row),ok:true,message:'Importada correctamente'});
    }catch(error){
      const localCode=error instanceof Error&&(error.message==='REFERENCE_NOT_FOUND'||error.message==='GROUP_NOT_FOUND')?error.message as RowFailure:'SERVER_RULE_REJECTED';
      const errorId=reportServerFailure('IMPORT_ROW_REJECTED',error);
      results.push({row:Number(row.row),ok:false,message:`${friendlyFailure(localCode)} · Error ID: ${errorId}`});
    }
  }
  return NextResponse.json({results});
}
