import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir=new URL('../supabase/migrations/',import.meta.url).pathname;
const sql=readdirSync(dir).filter((file)=>file.endsWith('.sql')).sort().map((file)=>readFileSync(join(dir,file),'utf8')).join('\n');

const contracts=[
  ['NP enum',/grade_kind as enum \('NUMERIC','NP','PENDING'\)/i],
  ['grade range check',/numeric_grade between 0\.0 and 10\.0/i],
  ['publication RPC',/function public\.publish_assignment_grades/i],
  ['atomic pending block',/PENDING_GRADES_NOT_ALLOWED/i],
  ['72 hour server window',/published_at \+ interval '72 hours'/i],
  ['single extraordinary',/student_subject_enrollment_id uuid not null unique references public\.student_subject_enrollments/i],
  ['document states',/document_state as enum \('VIGENTE','SUSTITUIDO','REVOCADO'\)/i],
  ['private buckets',/academic-documents','academic-documents',false/i],
  ['verification minimization',/verify_academic_document/i],
  ['verification per version',/document_versions_verification_token_hash_unique/i],
  ['document supersede workflow',/function public\.supersede_academic_document\(\s*p_document_id uuid[\s\S]*p_token_hash text/i],
  ['document revoke workflow',/function public\.revoke_academic_document/i],
  ['semester close blocks unresolved failures',/UNRESOLVED_ORDINARY_FAILURES/i],
  ['optimistic concurrency',/VERSION_CONFLICT/i],
  ['idempotency',/idempotency_key text not null unique/i],
  ['audit append-only',/audit_logs_no_delete/i],
  ['view uses invoker security',/student_grade_overview with \(security_invoker=true\)/i],
  ['public function execute revoked',/revoke execute on all functions in schema public from public/i],
  ['inactive student withdraws active enrollment',/set_student_active_workflow[\s\S]*status='WITHDRAWN'/i],
  ['teacher deactivation closes assignments safely',/set_teacher_active_workflow[\s\S]*active_until=coalesce\([\s\S]*greatest\(clock_timestamp\(\),[\s\S]*active_from \+ interval '1 microsecond'\)/i],
  ['assignment substitution preserves history',/replace_teacher_assignment_workflow[\s\S]*ASSIGNMENT_CHANGED/i],
  ['student ordinary average hidden before P3',/student_grade_overview[\s\S]*when count\(\*\) filter\(where g\.state='PUBLISHED' and ep\.partial_number between 1 and 3\)=3[\s\S]*else null/i],
  ['staff provisional view role-gated',/staff_grade_overview[\s\S]*current_user_has_role\('DOCENTE'\)[\s\S]*current_user_has_role\('CONTROL_ESCOLAR'\)/i],
  ['extraordinary requires complete ordinary result',/authorize_extraordinary[\s\S]*v_count<>3[\s\S]*ORDINARY_RESULT_INCOMPLETE/i],
  ['student extraordinary grade masked until publish',/get_my_extraordinary_overview[\s\S]*case when x\.published_at is not null then x\.numeric_grade else null end/i],
  ['session audit derives authenticated actor',/function public\.log_session_event\(p_action text\)[\s\S]*auth\.uid\(\)[\s\S]*current_primary_role\(\)[\s\S]*insert into public\.audit_logs/i],
  ['evaluation close uses non-transaction-stable clock',/transition_evaluation_period[\s\S]*greatest\(clock_timestamp\(\), v_opened_at \+ interval '1 microsecond'\)/i],
  ['extraordinary publish casts enum explicitly',/when numeric_grade>=6 then 'ACCREDITED'::public\.extraordinary_state[\s\S]*'NOT_ACCREDITED'::public\.extraordinary_state/i],
  ['published grade requires complete publication context',/grades_publication_state_consistency[\s\S]*publication_id is not null/i],
  ['publication context is composite-FK bound',/grades_publication_context_fk[\s\S]*foreign key\(publication_id,assignment_id,evaluation_period_id\)/i],
  ['default privileges deny implicit browser table grants',/alter default privileges for role postgres in schema public[\s\S]*revoke all on tables from anon, authenticated/i],
  ['first Superadmin bootstrap is service-role only',/bootstrap_first_superadmin[\s\S]*SERVICE_ROLE_REQUIRED[\s\S]*revoke execute on function public\.bootstrap_first_superadmin\(uuid,text,text\) from public,anon,authenticated[\s\S]*grant execute[\s\S]*to service_role/i],
  ['last active Superadmin cannot be disabled',/CANNOT_DISABLE_LAST_ACTIVE_SUPERADMIN/i],
  ['last active Superadmin role cannot be removed',/CANNOT_REMOVE_LAST_ACTIVE_SUPERADMIN/i],
  ['inactive student profile revokes RLS identity',/current_student_id[\s\S]*join public\.profiles p on p\.id=s\.profile_id and p\.is_active/i],
  ['inactive teacher profile revokes RLS identity',/current_teacher_id[\s\S]*join public\.profiles p on p\.id=t\.profile_id and p\.is_active/i],
  ['inactive profile has no primary role',/current_primary_role[\s\S]*join public\.profiles p on p\.id=ur\.user_id and p\.is_active/i],
  ['publication composite FK has covering index',/grades_publication_context_idx[\s\S]*publication_id,assignment_id,evaluation_period_id/i],
  ['first Superadmin requires confirmed Auth email',/bootstrap_first_superadmin[\s\S]*email_confirmed_at[\s\S]*AUTH_EMAIL_NOT_CONFIRMED/i],
  ['first Superadmin binds exact Auth email',/bootstrap_first_superadmin[\s\S]*AUTH_EMAIL_MISMATCH/i]
];

const rows=contracts.map(([name,re])=>({contract:name,result:re.test(sql)?'PASS':'FAIL'}));
console.table(rows);
const failed=rows.filter((row)=>row.result==='FAIL');
if(failed.length)process.exit(1);
console.log(`SQL contract audit PASS (${contracts.length}/${contracts.length}).`);
