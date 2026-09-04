import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/errors/server';

const schema=z.object({assignmentId:z.uuid()});
type GradeRow={kind:'NUMERIC'|'NP'|'PENDING';numeric_grade:number|string|null;state:'DRAFT'|'PUBLISHED';published_at:string|null;evaluation_periods:{partial_number:number}|null;student_subject_enrollments:{enrollments:{students:{enrollment_number:string;full_name:string}|null}|null}|null};
function csvCell(value:string){return `"${value.replaceAll('"','""')}"`;}
export async function GET(request:Request){
  const auth=await getAuthContext(); if(!auth)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  if(!auth.roles.includes('DOCENTE'))return NextResponse.json({error:'TEACHER_ROLE_REQUIRED'},{status:403});
  const parsed=schema.safeParse({assignmentId:new URL(request.url).searchParams.get('assignmentId')}); if(!parsed.success)return NextResponse.json({error:'INVALID_ASSIGNMENT'},{status:400});
  const s=await createSupabaseServerClient();
  const {data:assignment}=await s.from('teacher_assignments').select('id,subjects(name),groups(name)').eq('id',parsed.data.assignmentId).eq('is_active',true).maybeSingle();
  if(!assignment)return NextResponse.json({error:'NOT_FOUND_OR_FORBIDDEN'},{status:404});
  const {data:raw,error}=await s.from('grades').select('kind,numeric_grade,state,published_at,evaluation_periods(partial_number),student_subject_enrollments(enrollments(students(enrollment_number,full_name)))').eq('assignment_id',parsed.data.assignmentId).order('created_at');
  if(error)return NextResponse.json(apiFailure('No fue posible generar el reporte.','REPORT_QUERY_FAILED',error),{status:500});
  const rows=(raw??[]) as unknown as GradeRow[];
  const lines=['Matrícula,Alumno,Parcial,Valor,Estado,Publicado'];
  for(const row of rows){const student=row.student_subject_enrollments?.enrollments?.students;const value=row.kind==='NUMERIC'?Number(row.numeric_grade).toFixed(1):row.kind;lines.push([student?.enrollment_number??'',student?.full_name??'',String(row.evaluation_periods?.partial_number??''),value,row.state,row.published_at??''].map(csvCell).join(','));}
  const csv='\uFEFF'+lines.join('\r\n');
  return new NextResponse(csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cbta241-calificaciones-${parsed.data.assignmentId.slice(0,8)}.csv"`,'cache-control':'private, no-store'}});
}
