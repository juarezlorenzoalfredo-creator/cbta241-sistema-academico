-- Reproducible fictitious data for local development only.
-- No real personal data. Published demo grades use a synthetic profile actor so
-- publication integrity constraints are exercised exactly as in production.

set session_replication_role = replica;
insert into public.profiles(id,display_name,email)
values('de000000-0000-0000-0000-000000000001','Sistema Demo CBTA 241','sistema.demo@cbta241.local')
on conflict (id) do nothing;
set session_replication_role = origin;

do $$
declare
  p uuid; sem1 uuid; g uuid; t1 uuid; t2 uuid; t3 uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid; s6 uuid;
  st uuid; enr uuid; ep1 uuid; i integer; sub uuid; ass uuid; sse uuid;
  pub uuid; pub_at timestamptz;
  demo_actor constant uuid := 'de000000-0000-0000-0000-000000000001';
begin
  insert into public.academic_periods(kind,start_year,starts_on,ends_on,is_current)
    values('AUG_JAN',2026,'2026-08-01','2027-01-31',true) returning id into p;
  update public.institution_settings
    set current_period_id=p,school_key='DEMO-CBTA241',email='demo@cbta241.local'
    where singleton_key='CBTA241';
  select id into sem1 from public.semesters where number=1;
  insert into public.groups(academic_period_id,semester_id,name,modality)
    values(p,sem1,'A','ESCOLARIZADO') returning id into g;

  insert into public.subjects(code,name) values('MAT1','Pensamiento Matemático I') returning id into s1;
  insert into public.subjects(code,name) values('QUI1','Química I') returning id into s2;
  insert into public.subjects(code,name) values('LEN1','Lengua y Comunicación I') returning id into s3;
  insert into public.subjects(code,name) values('ING1','Inglés I') returning id into s4;
  insert into public.subjects(code,name) values('TIC1','Cultura Digital I') returning id into s5;
  insert into public.subjects(code,name) values('AGR1','Introducción Agropecuaria I') returning id into s6;

  insert into public.teachers(employee_number,full_name) values('D001','Laura Martínez Demo') returning id into t1;
  insert into public.teachers(employee_number,full_name) values('D002','Carlos Rivera Demo') returning id into t2;
  insert into public.teachers(employee_number,full_name) values('D003','María Torres Demo') returning id into t3;

  insert into public.teacher_assignments(teacher_id,subject_id,group_id,academic_period_id) values
    (t1,s1,g,p),(t1,s5,g,p),(t2,s2,g,p),(t2,s6,g,p),(t3,s3,g,p),(t3,s4,g,p);

  insert into public.evaluation_periods(academic_period_id,partial_number,state,opens_at)
    values(p,1,'OPEN',clock_timestamp()) returning id into ep1;
  insert into public.evaluation_periods(academic_period_id,partial_number,state)
    values(p,2,'PLANNED'),(p,3,'PLANNED');

  -- One immutable publication header per assignment for P1. Among 32 demo
  -- students exactly 2 are NP (11 and 22), leaving 30 numeric grades.
  for ass in
    select id from public.teacher_assignments
    where group_id=g and academic_period_id=p and is_active
  loop
    insert into public.grade_publications(
      assignment_id,evaluation_period_id,published_by,idempotency_key,
      row_count,numeric_count,np_count,version
    ) values(
      ass,ep1,demo_actor,'seed-p1-'||ass::text,32,30,2,1
    );
  end loop;

  for i in 1..32 loop
    insert into public.students(enrollment_number,full_name)
      values('241'||lpad(i::text,4,'0'),'Alumno Demo '||lpad(i::text,2,'0')) returning id into st;
    insert into public.enrollments(student_id,academic_period_id,semester_id,group_id,status)
      values(st,p,sem1,g,'ACTIVE') returning id into enr;

    foreach sub in array array[s1,s2,s3,s4,s5,s6] loop
      insert into public.student_subject_enrollments(enrollment_id,subject_id,status)
        values(enr,sub,'ACTIVE') returning id into sse;
      select id into ass
      from public.teacher_assignments
      where group_id=g and academic_period_id=p and subject_id=sub and is_active;
      select id,published_at into pub,pub_at
      from public.grade_publications
      where assignment_id=ass and evaluation_period_id=ep1;

      -- P1 demo: every student resolved; some NP / low grades exercise risk UI.
      if i % 11 = 0 then
        insert into public.grades(
          student_subject_enrollment_id,evaluation_period_id,assignment_id,
          kind,state,published_at,published_by,publication_id,version
        ) values(sse,ep1,ass,'NP','PUBLISHED',pub_at,demo_actor,pub,1);
      else
        insert into public.grades(
          student_subject_enrollment_id,evaluation_period_id,assignment_id,
          kind,numeric_grade,state,published_at,published_by,publication_id,version
        ) values(
          sse,ep1,ass,'NUMERIC',
          round((5.0 + ((i + ascii(left((select code from public.subjects where id=sub),1))) % 45)/10.0)::numeric,1),
          'PUBLISHED',pub_at,demo_actor,pub,1
        );
      end if;
    end loop;
  end loop;
end $$;
