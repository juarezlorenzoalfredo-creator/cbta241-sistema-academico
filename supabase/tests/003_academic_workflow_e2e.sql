begin;
select plan(37);

-- Synthetic actors for a fully transactional end-to-end workflow.
set local session_replication_role = replica;
insert into public.profiles(id,display_name,email) values
  ('11000000-0000-0000-0000-000000000001','Alumno Workflow','student.workflow@test.invalid'),
  ('11000000-0000-0000-0000-000000000002','Docente Workflow','teacher.workflow@test.invalid'),
  ('11000000-0000-0000-0000-000000000003','Control Workflow','control.workflow@test.invalid');
set local session_replication_role = origin;

insert into public.user_roles(user_id,role) values
  ('11000000-0000-0000-0000-000000000001','ALUMNO'),
  ('11000000-0000-0000-0000-000000000002','DOCENTE'),
  ('11000000-0000-0000-0000-000000000003','CONTROL_ESCOLAR');

insert into public.academic_periods(id,kind,start_year,starts_on,ends_on,is_current)
values('12000000-0000-0000-0000-000000000001','FEB_JUL',2198,'2198-02-01','2198-07-31',false);

insert into public.groups(id,academic_period_id,semester_id,name,modality)
values('13000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001',(select id from public.semesters where number=1),'WF-A','ESCOLARIZADO');
insert into public.subjects(id,code,name)
values('14000000-0000-0000-0000-000000000001','WF-001','Materia Workflow');
insert into public.students(id,profile_id,enrollment_number,full_name)
values('15000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','WF-0001','Alumno Workflow');
insert into public.teachers(id,profile_id,employee_number,full_name)
values('16000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000002','WF-D001','Docente Workflow');
insert into public.enrollments(id,student_id,academic_period_id,semester_id,group_id,status)
values('17000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001',(select id from public.semesters where number=1),'13000000-0000-0000-0000-000000000001','ACTIVE');
insert into public.student_subject_enrollments(id,enrollment_id,subject_id,status)
values('18000000-0000-0000-0000-000000000001','17000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','ACTIVE');
insert into public.teacher_assignments(id,teacher_id,subject_id,group_id,academic_period_id,is_active)
values('19000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001',true);
insert into public.evaluation_periods(id,academic_period_id,partial_number,state,opens_at) values
  ('1a000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001',1,'OPEN',now()),
  ('1a000000-0000-0000-0000-000000000002','12000000-0000-0000-0000-000000000001',2,'OPEN',now()),
  ('1a000000-0000-0000-0000-000000000003','12000000-0000-0000-0000-000000000001',3,'OPEN',now());

-- P1 capture/publication by teacher.
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.save_grade_draft('18000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','NUMERIC',5.0,0)$$,'Teacher captures P1 draft');
select results_eq($$select kind::text,numeric_grade,state::text,version from public.grades where student_subject_enrollment_id='18000000-0000-0000-0000-000000000001' and evaluation_period_id='1a000000-0000-0000-0000-000000000001'$$,$$values ('NUMERIC'::text,5.0::numeric,'DRAFT'::text,0)$$,'P1 draft persisted');
select lives_ok($$select public.publish_assignment_grades('19000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','workflow-p1-key-00000001')$$,'P1 publishes atomically');
select results_eq($$select state::text,publication_id is not null,published_by='11000000-0000-0000-0000-000000000002',version from public.grades where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'$$,$$values ('PUBLISHED'::text,true,true,1)$$,'Published P1 has publication context');
select results_eq($$select count(*)::bigint from public.grade_publications where idempotency_key='workflow-p1-key-00000001'$$,$$values (1::bigint)$$,'Publication created once');
select lives_ok($$select public.publish_assignment_grades('19000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000001','workflow-p1-key-00000001')$$,'Repeated idempotency key is safe');
select results_eq($$select count(*)::bigint from public.grade_publications where idempotency_key='workflow-p1-key-00000001'$$,$$values (1::bigint)$$,'Repeated publication does not duplicate');

-- Direct correction inside 72h.
select lives_ok($$select public.correct_published_grade((select id from public.grades where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'),'NUMERIC',4.5,null,1)$$,'Teacher corrects published P1 within 72 hours');
select results_eq($$select numeric_grade,version from public.grades where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'$$,$$values (4.5::numeric,2)$$,'Direct correction updates grade and version');

-- Simulate the passage of the official server window, then use request workflow.
reset role;
update public.grades set published_at=now()-interval '73 hours'
where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.correct_published_grade((select id from public.grades where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'),'NUMERIC',4.0,null,2)$$,'42501',null,'Direct correction is blocked after 72 hours');
select lives_ok($$select public.request_grade_correction((select id from public.grades where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'),'NUMERIC',4.0,'Ajuste posterior a ventana')$$,'Teacher requests correction after 72 hours');
select results_eq($$select state::text from public.grade_change_requests where grade_id=(select id from public.grades where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001')$$,$$values ('PENDING'::text)$$,'Correction request remains pending for Control Escolar');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.resolve_grade_correction_request((select id from public.grade_change_requests where state='PENDING' and grade_id=(select id from public.grades where evaluation_period_id='1a000000-0000-0000-0000-000000000001' and student_subject_enrollment_id='18000000-0000-0000-0000-000000000001')),true,'Corrección validada por Control Escolar')$$,'Control Escolar approves correction request');
select results_eq($$select g.numeric_grade,g.version,r.state::text from public.grades g join public.grade_change_requests r on r.grade_id=g.id where g.evaluation_period_id='1a000000-0000-0000-0000-000000000001' and g.student_subject_enrollment_id='18000000-0000-0000-0000-000000000001' order by r.requested_at desc limit 1$$,$$values (4.0::numeric,3,'APPROVED'::text)$$,'Approved request updates published grade');

-- P2=NP and P3=5.0, both published via normal teacher workflow.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.save_grade_draft('18000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000002','NP',null,0)$$,'Teacher captures NP in P2');
select lives_ok($$select public.publish_assignment_grades('19000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000002','workflow-p2-key-00000002')$$,'P2 publishes NP');
select lives_ok($$select public.save_grade_draft('18000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000003','NUMERIC',5.0,0)$$,'Teacher captures P3');
select lives_ok($$select public.publish_assignment_grades('19000000-0000-0000-0000-000000000001','1a000000-0000-0000-0000-000000000003','workflow-p3-key-00000003')$$,'P3 publishes');
select results_eq($$select published_partial_count,provisional_average from public.staff_grade_overview where student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'$$,$$values (3::bigint,3.0::numeric)$$,'NP computes as zero in ordinary average');

-- Close all three partials through Control Escolar workflow.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.transition_evaluation_period('1a000000-0000-0000-0000-000000000001','CLOSED','Cierre P1 de prueba',0)$$,'Control Escolar closes P1');
select lives_ok($$select public.transition_evaluation_period('1a000000-0000-0000-0000-000000000002','CLOSED','Cierre P2 de prueba',0)$$,'Control Escolar closes P2');
select lives_ok($$select public.transition_evaluation_period('1a000000-0000-0000-0000-000000000003','CLOSED','Cierre P3 de prueba',0)$$,'Control Escolar closes P3');
select throws_ok($$select public.close_academic_period_workflow('12000000-0000-0000-0000-000000000001',0,'Intento antes del extraordinario')$$,'P0001','UNRESOLVED_ORDINARY_FAILURES','Semester cannot close with unresolved ordinary failure');

-- Extraordinary: one opportunity, capture, publish.
select lives_ok($$select public.authorize_extraordinary('18000000-0000-0000-0000-000000000001','Reprobación ordinaria confirmada')$$,'Control Escolar authorizes extraordinary');
select throws_ok($$select public.authorize_extraordinary('18000000-0000-0000-0000-000000000001','Segundo intento indebido')$$,'P0001','EXTRAORDINARY_ALREADY_EXISTS','A second extraordinary opportunity is rejected');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.capture_extraordinary((select id from public.extraordinary_evaluations where student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'),7.0,0)$$,'Responsible teacher captures extraordinary');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.publish_extraordinary((select id from public.extraordinary_evaluations where student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'),1)$$,'Control Escolar publishes extraordinary');
select results_eq($$select state::text,numeric_grade from public.extraordinary_evaluations where student_subject_enrollment_id='18000000-0000-0000-0000-000000000001'$$,$$values ('ACCREDITED'::text,7.0::numeric)$$,'Extraordinary accredits at 6.0 or above');

-- Semester can now close.
select lives_ok($$select public.close_academic_period_workflow('12000000-0000-0000-0000-000000000001',0,'Cierre integral de semestre')$$,'Control Escolar closes semester after all gates');
select results_eq($$select is_closed,version from public.academic_periods where id='12000000-0000-0000-0000-000000000001'$$,$$values (true,1)$$,'Semester close is persisted and versioned');

-- Immutable, versioned document lifecycle with public verification tokens.
select lives_ok($$select public.register_academic_document('15000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001','BOLETA_SEMESTRAL','SEMESTER','WF-BOLETA-0001',encode(digest('workflow-token-v1','sha256'),'hex'),'boletas/workflow-v1.pdf',repeat('a',64))$$,'Control Escolar registers semester report');
select results_eq($$select authentic,version,document_state::text from public.verify_academic_document('workflow-token-v1')$$,$$values (true,1,'VIGENTE'::text)$$,'Version 1 token verifies as current');
select lives_ok($$select public.supersede_academic_document((select id from public.academic_documents where folio='WF-BOLETA-0001'),'boletas/workflow-v2.pdf',repeat('b',64),encode(digest('workflow-token-v2','sha256'),'hex'),'Corrección documental controlada')$$,'Control Escolar supersedes report with immutable v2');
select results_eq($$select version,document_state::text from public.verify_academic_document('workflow-token-v1')$$,$$values (1,'SUSTITUIDO'::text)$$,'Old QR remains authentic but superseded');
select results_eq($$select version,document_state::text from public.verify_academic_document('workflow-token-v2')$$,$$values (2,'VIGENTE'::text)$$,'New QR resolves to current version');
select lives_ok($$select public.revoke_academic_document((select id from public.academic_documents where folio='WF-BOLETA-0001'),'Revocación documental de prueba')$$,'Control Escolar can revoke current document');
select results_eq($$select version,document_state::text from public.verify_academic_document('workflow-token-v2')$$,$$values (2,'REVOCADO'::text)$$,'Revoked QR remains authentic with revoked state');

reset role;
select * from finish();
rollback;
