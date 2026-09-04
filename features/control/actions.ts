'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { failAction } from '@/lib/errors/server';

async function controlClient(){await requireAuth(['CONTROL_ESCOLAR']);return createSupabaseServerClient();}

function text(form:FormData,key:string){return String(form.get(key)??'').trim();}

export async function createStudentAction(form:FormData){
  const s=await controlClient(); const enrollment=text(form,'enrollment_number'); const name=text(form,'full_name');
  const {error}=await s.rpc('create_student_record',{p_enrollment_number:enrollment,p_full_name:name});
  if(error) failAction('STUDENT_CREATE_FAILED',error); revalidatePath('/control/alumnos');
}

export async function createTeacherAction(form:FormData){
  const s=await controlClient(); const employee=text(form,'employee_number'); const name=text(form,'full_name');
  const {error}=await s.rpc('create_teacher_record',{p_employee_number:employee,p_full_name:name});
  if(error) failAction('TEACHER_CREATE_FAILED',error); revalidatePath('/control'); revalidatePath('/control/docentes');
}

export async function createSubjectAction(form:FormData){
  const s=await controlClient(); const code=text(form,'code'); const name=text(form,'name');
  const {error}=await s.rpc('create_subject_record',{p_code:code,p_name:name});
  if(error) failAction('SUBJECT_CREATE_FAILED',error); revalidatePath('/control'); revalidatePath('/control/materias');
}

export async function createPeriodAction(form:FormData){
  const s=await controlClient(); const kind=text(form,'kind') as 'AUG_JAN'|'FEB_JUL'; const year=Number(text(form,'start_year'));
  const {error}=await s.rpc('create_academic_period_workflow',{p_kind:kind,p_start_year:year,p_make_current:true});
  if(error) failAction('PERIOD_CREATE_FAILED',error); revalidatePath('/control'); revalidatePath('/control/evaluaciones'); revalidatePath('/control/periodos'); revalidatePath('/control/grupos');
}

export async function createGroupAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('create_group_record',{p_period_id:text(form,'period_id'),p_semester_id:text(form,'semester_id'),p_name:text(form,'name'),p_modality:text(form,'modality')||'ESCOLARIZADO'});
  if(error) failAction('GROUP_CREATE_FAILED',error); revalidatePath('/control'); revalidatePath('/control/grupos'); revalidatePath('/control/inscripciones');
}

export async function transitionEvaluationAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('transition_evaluation_period',{p_id:text(form,'evaluation_id'),p_state:text(form,'state'),p_reason:text(form,'reason')||null,p_expected_version:Number(text(form,'version'))});
  if(error) failAction('EVALUATION_TRANSITION_FAILED',error); revalidatePath('/control/evaluaciones');
}

export async function resolveCorrectionAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('resolve_grade_correction_request',{p_request_id:text(form,'request_id'),p_approve:text(form,'decision')==='approve',p_resolution_reason:text(form,'reason')});
  if(error) failAction('CORRECTION_RESOLUTION_FAILED',error); revalidatePath('/control/correcciones');
}

export async function authorizeExtraordinaryAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('authorize_extraordinary',{p_sse_id:text(form,'sse_id'),p_reason:text(form,'reason')});
  if(error) failAction('EXTRAORDINARY_AUTHORIZE_FAILED',error); revalidatePath('/control/extraordinarios');
}

export async function publishExtraordinaryAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('publish_extraordinary',{p_extra_id:text(form,'extra_id'),p_expected_version:Number(text(form,'version'))});
  if(error) failAction('EXTRAORDINARY_PUBLISH_FAILED',error); revalidatePath('/control/extraordinarios');
}


export async function enrollStudentAction(form:FormData){
  const s=await controlClient(); const subjectIds=form.getAll('subject_ids').map(String).filter(Boolean);
  const {error}=await s.rpc('enroll_student_workflow',{p_student_id:text(form,'student_id'),p_period_id:text(form,'period_id'),p_semester_id:text(form,'semester_id'),p_group_id:text(form,'group_id'),p_subject_ids:subjectIds});
  if(error) failAction('ENROLLMENT_FAILED',error); revalidatePath('/control/inscripciones'); revalidatePath('/control/alumnos');
}

export async function assignTeacherAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('assign_teacher_workflow',{p_teacher_id:text(form,'teacher_id'),p_subject_id:text(form,'subject_id'),p_group_id:text(form,'group_id'),p_period_id:text(form,'period_id')});
  if(error) failAction('ASSIGNMENT_FAILED',error); revalidatePath('/control/inscripciones'); revalidatePath('/control/asignaciones'); revalidatePath('/control/seguimiento');
}

export async function closePeriodAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('close_academic_period_workflow',{p_period_id:text(form,'period_id'),p_expected_version:Number(text(form,'version')),p_reason:text(form,'reason')});
  if(error) failAction('PERIOD_CLOSE_FAILED',error); revalidatePath('/control/evaluaciones'); revalidatePath('/control'); revalidatePath('/control/periodos');
}

export async function revokeDocumentAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('revoke_academic_document',{p_document_id:text(form,'document_id'),p_reason:text(form,'reason')});
  if(error) failAction('DOCUMENT_REVOKE_FAILED',error);
  revalidatePath('/control/documentos');
}

export async function setStudentActiveAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('set_student_active_workflow',{
    p_student_id:text(form,'student_id'),
    p_active:text(form,'active')==='true',
    p_reason:text(form,'reason')
  });
  if(error) failAction('STUDENT_STATUS_FAILED',error);
  revalidatePath('/control/alumnos');
}

export async function setTeacherActiveAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('set_teacher_active_workflow',{
    p_teacher_id:text(form,'teacher_id'),
    p_active:text(form,'active')==='true',
    p_reason:text(form,'reason')
  });
  if(error) failAction('TEACHER_STATUS_FAILED',error);
  revalidatePath('/control/docentes');
  revalidatePath('/control/inscripciones');
}

export async function replaceTeacherAssignmentAction(form:FormData){
  const s=await controlClient();
  const {error}=await s.rpc('replace_teacher_assignment_workflow',{
    p_assignment_id:text(form,'assignment_id'),
    p_new_teacher_id:text(form,'teacher_id'),
    p_reason:text(form,'reason')
  });
  if(error) failAction('ASSIGNMENT_REPLACEMENT_FAILED',error);
  revalidatePath('/control/asignaciones');
  revalidatePath('/control/inscripciones');
}
