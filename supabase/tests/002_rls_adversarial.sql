begin;
select plan(22);

-- Test identities are transaction-local Auth rows. The transaction is rolled back
-- at the end, so GoTrue remains clean while profile foreign keys stay realistic.
insert into auth.users(id,aud,role,email,is_sso_user,is_anonymous,created_at,updated_at) values
  ('10000000-0000-0000-0000-000000000001','authenticated','authenticated','a@rls.test',false,false,now(),now()),
  ('10000000-0000-0000-0000-000000000002','authenticated','authenticated','b@rls.test',false,false,now(),now()),
  ('10000000-0000-0000-0000-000000000003','authenticated','authenticated','ta@rls.test',false,false,now(),now()),
  ('10000000-0000-0000-0000-000000000004','authenticated','authenticated','tb@rls.test',false,false,now(),now()),
  ('10000000-0000-0000-0000-000000000005','authenticated','authenticated','control@rls.test',false,false,now(),now());
insert into public.profiles(id,display_name,email) values
  ('10000000-0000-0000-0000-000000000001','Alumno RLS A','a@rls.test'),
  ('10000000-0000-0000-0000-000000000002','Alumno RLS B','b@rls.test'),
  ('10000000-0000-0000-0000-000000000003','Docente RLS A','ta@rls.test'),
  ('10000000-0000-0000-0000-000000000004','Docente RLS B','tb@rls.test'),
  ('10000000-0000-0000-0000-000000000005','Control RLS','control@rls.test');

insert into public.user_roles(user_id,role) values
  ('10000000-0000-0000-0000-000000000001','ALUMNO'),
  ('10000000-0000-0000-0000-000000000002','ALUMNO'),
  ('10000000-0000-0000-0000-000000000003','DOCENTE'),
  ('10000000-0000-0000-0000-000000000004','DOCENTE'),
  ('10000000-0000-0000-0000-000000000005','CONTROL_ESCOLAR');

insert into public.academic_periods(id,kind,start_year,starts_on,ends_on,is_current)
values('20000000-0000-0000-0000-000000000001','FEB_JUL',2199,'2199-02-01','2199-07-31',false);
insert into public.groups(id,academic_period_id,semester_id,name,modality)
values
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',(select id from public.semesters where number=1),'RLS-A','ESCOLARIZADO'),
  ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',(select id from public.semesters where number=1),'RLS-B','ESCOLARIZADO');
insert into public.subjects(id,code,name) values('40000000-0000-0000-0000-000000000001','RLS-TST','Materia RLS');
insert into public.students(id,profile_id,enrollment_number,full_name) values
  ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','RLS-A','Alumno RLS A'),
  ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','RLS-B','Alumno RLS B');
insert into public.teachers(id,profile_id,employee_number,full_name) values
  ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','RLS-TA','Docente RLS A'),
  ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','RLS-TB','Docente RLS B');
insert into public.enrollments(id,student_id,academic_period_id,semester_id,group_id,status) values
  ('70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',(select id from public.semesters where number=1),'30000000-0000-0000-0000-000000000001','ACTIVE'),
  ('70000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',(select id from public.semesters where number=1),'30000000-0000-0000-0000-000000000002','ACTIVE');
insert into public.student_subject_enrollments(id,enrollment_id,subject_id,status) values
  ('80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','ACTIVE'),
  ('80000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','ACTIVE');
insert into public.teacher_assignments(id,teacher_id,subject_id,group_id,academic_period_id,is_active) values
  ('90000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',true),
  ('90000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',true);
insert into public.evaluation_periods(id,academic_period_id,partial_number,state,opens_at) values
  ('a0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'OPEN',clock_timestamp());
insert into public.grade_publications(id,assignment_id,evaluation_period_id,published_by,idempotency_key,row_count,numeric_count,np_count,version) values
  ('aa000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','rls-publication-a-0001',1,1,0,1),
  ('aa000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','rls-publication-b-0001',1,1,0,1);
insert into public.grades(id,student_subject_enrollment_id,evaluation_period_id,assignment_id,kind,numeric_grade,state,published_at,published_by,publication_id,version) values
  ('b0000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','NUMERIC',8.0,'PUBLISHED',clock_timestamp(),'10000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000001',1),
  ('b0000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','NUMERIC',9.0,'PUBLISHED',clock_timestamp(),'10000000-0000-0000-0000-000000000004','aa000000-0000-0000-0000-000000000002',1);
insert into public.extraordinary_evaluations(id,student_subject_enrollment_id,authorized_at,captured_at,numeric_grade,state,version)
values('c0000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001',now(),now(),5.5,'CAPTURED',1);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select results_eq('select enrollment_number from public.students order by enrollment_number',$$values ('RLS-A'::text)$$,'Alumno A cannot read Alumno B');
select results_eq('select numeric_grade from public.grades order by numeric_grade',$$values (8.0::numeric)$$,'Alumno A sees only own published grade');
select results_eq('select count(*)::bigint from public.student_grade_overview',$$values (1::bigint)$$,'security_invoker view preserves student RLS');
select results_eq('select published_average is null from public.student_grade_overview',$$values (true)$$,'Alumno does not receive provisional ordinary average before P3');
select results_eq('select count(*)::bigint from public.staff_grade_overview',$$values (0::bigint)$$,'Alumno cannot query staff provisional overview');
select results_eq('select count(*)::bigint from public.extraordinary_evaluations',$$values (0::bigint)$$,'Alumno cannot read extraordinary table directly before publication');
select results_eq('select numeric_grade is null from public.get_my_extraordinary_overview()',$$values (true)$$,'Student extraordinary RPC masks captured grade before publication');
select throws_ok($$update public.grades set numeric_grade=10 where id='b0000000-0000-0000-0000-000000000001'$$,'42501',null,'Alumno cannot update grades directly');
select results_eq('select count(*)::bigint from public.institution_settings',$$values (0::bigint)$$,'Alumno cannot read sensitive institution settings');
select lives_ok($$select public.log_session_event('LOGIN')$$,'Authenticated student can write a derived LOGIN audit event');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select ok(public.teacher_owns_assignment('90000000-0000-0000-0000-000000000001'),'Docente A owns assignment A');
select ok(not public.teacher_owns_assignment('90000000-0000-0000-0000-000000000002'),'Docente A does not own assignment B');
select results_eq('select enrollment_number from public.students order by enrollment_number',$$values ('RLS-A'::text)$$,'Docente A cannot read students outside assigned group');
select results_eq('select count(*)::bigint from public.staff_grade_overview',$$values (1::bigint)$$,'Docente sees provisional overview only for own assignment');
select throws_ok($$select public.save_grade_draft('80000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','NUMERIC',7.0,1)$$,'42501',null,'Docente A cannot alter Docente B assignment');
select throws_ok($$update public.teacher_assignments set is_active=false where id='90000000-0000-0000-0000-000000000002'$$,'42501',null,'Docente cannot mutate assignments directly');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
select results_eq('select count(*)::bigint from public.students where enrollment_number like ''RLS-%''',$$values (2::bigint)$$,'Control Escolar can read both test students');
select results_eq('select count(*)::bigint from public.institution_settings',$$values (1::bigint)$$,'Control Escolar can read institution settings');
select results_eq($$select count(*)::bigint from public.audit_logs where action='LOGIN' and actor_id='10000000-0000-0000-0000-000000000001'$$,$$values (1::bigint)$$,'LOGIN audit event derives the authenticated actor');
select lives_ok($$select public.replace_teacher_assignment_workflow('90000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','Sustitución controlada para prueba')$$,'Control Escolar can substitute responsible teacher');
select results_eq($$select is_active from public.teacher_assignments where id='90000000-0000-0000-0000-000000000001'$$,$$values (false)$$,'Previous teacher assignment becomes historical');
select lives_ok($$select public.set_student_active_workflow('50000000-0000-0000-0000-000000000002',false,'Baja académica de prueba')$$,'Control Escolar can deactivate a student without deleting history');

reset role;
select * from finish();
rollback;
