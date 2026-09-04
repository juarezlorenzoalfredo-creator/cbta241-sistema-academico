-- CBTA 241 Sistema Académico Digital
-- Migration 001: core schema, integrity, workflows and RLS
-- PostgreSQL / Supabase. DENY BY DEFAULT.

begin;

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
create type public.app_role as enum ('SUPERADMIN','CONTROL_ESCOLAR','DOCENTE','ALUMNO');
create type public.period_kind as enum ('AUG_JAN','FEB_JUL');
create type public.academic_record_status as enum ('ACTIVE','INACTIVE','WITHDRAWN','COMPLETED');
create type public.evaluation_state as enum ('PLANNED','OPEN','CLOSED','REOPENED');
create type public.grade_kind as enum ('NUMERIC','NP','PENDING');
create type public.grade_record_state as enum ('DRAFT','PUBLISHED');
create type public.change_request_state as enum ('PENDING','APPROVED','REJECTED','CANCELLED');
create type public.extraordinary_state as enum ('ELIGIBLE','AUTHORIZED','SCHEDULED','CAPTURED','PUBLISHED','ACCREDITED','NOT_ACCREDITED','CANCELLED');
create type public.document_state as enum ('VIGENTE','SUSTITUIDO','REVOCADO');
create type public.document_type as enum ('REPORTE_PARCIAL','BOLETA_SEMESTRAL');

-- ---------- COMMON HELPERS ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'DELETE_NOT_ALLOWED_FOR_AUDITED_ENTITY' using errcode='42501';
end;
$$;

-- ---------- IDENTITY ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 160),
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  primary key (user_id, role)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  enrollment_number text not null unique check (length(trim(enrollment_number)) between 3 and 40),
  full_name text not null check (length(trim(full_name)) between 2 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  employee_number text unique,
  full_name text not null check (length(trim(full_name)) between 2 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ACADEMIC CATALOG ----------
create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  kind public.period_kind not null,
  start_year integer not null check (start_year between 2000 and 2200),
  label text generated always as (
    case kind
      when 'AUG_JAN' then 'AGOSTO ' || start_year::text || ' – ENERO ' || (start_year + 1)::text
      else 'FEBRERO ' || start_year::text || ' – JULIO ' || start_year::text
    end
  ) stored,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  is_closed boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind,start_year),
  check (starts_on < ends_on),
  check ((not is_closed and closed_at is null) or is_closed)
);
create unique index academic_periods_one_current on public.academic_periods(is_current) where is_current;

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  number smallint not null unique check (number between 1 and 6),
  label text generated always as (number::text || '°') stored
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  starts_year integer not null check (starts_year between 2000 and 2200),
  ends_year integer not null check (ends_year between starts_year and starts_year + 6)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id),
  semester_id uuid not null references public.semesters(id),
  generation_id uuid references public.generations(id),
  name text not null check (length(trim(name)) between 1 and 20),
  modality text not null default 'ESCOLARIZADO' check (modality in ('ESCOLARIZADO','SAETA')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_period_id, semester_id, name, modality)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (length(trim(name)) between 2 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  academic_period_id uuid not null references public.academic_periods(id),
  semester_id uuid not null references public.semesters(id),
  group_id uuid not null references public.groups(id),
  status public.academic_record_status not null default 'ACTIVE',
  enrolled_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, academic_period_id)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id),
  subject_id uuid not null references public.subjects(id),
  group_id uuid not null references public.groups(id),
  academic_period_id uuid not null references public.academic_periods(id),
  active_from timestamptz not null default now(),
  active_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until is null or active_until > active_from)
);
create unique index teacher_assignment_one_responsible
  on public.teacher_assignments(subject_id, group_id, academic_period_id)
  where is_active;

create table public.student_subject_enrollments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id),
  subject_id uuid not null references public.subjects(id),
  status public.academic_record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id, subject_id)
);

create table public.evaluation_periods (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id),
  partial_number smallint not null check (partial_number between 1 and 3),
  opens_at timestamptz,
  closes_at timestamptz,
  state public.evaluation_state not null default 'PLANNED',
  version integer not null default 0 check (version >= 0),
  last_transition_reason text,
  last_transition_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(academic_period_id, partial_number),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

-- ---------- GRADING ----------
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  student_subject_enrollment_id uuid not null references public.student_subject_enrollments(id),
  evaluation_period_id uuid not null references public.evaluation_periods(id),
  assignment_id uuid not null references public.teacher_assignments(id),
  kind public.grade_kind not null default 'PENDING',
  numeric_grade numeric(3,1),
  state public.grade_record_state not null default 'DRAFT',
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  publication_id uuid,
  version integer not null default 0 check (version >= 0),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_subject_enrollment_id, evaluation_period_id),
  check (
    (kind = 'NUMERIC' and numeric_grade is not null and numeric_grade between 0.0 and 10.0)
    or (kind in ('NP','PENDING') and numeric_grade is null)
  ),
  check (
    (state = 'DRAFT' and published_at is null)
    or (state = 'PUBLISHED' and published_at is not null)
  )
);

create table public.grade_publications (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.teacher_assignments(id),
  evaluation_period_id uuid not null references public.evaluation_periods(id),
  published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles(id),
  idempotency_key text not null unique check (length(idempotency_key) between 16 and 128),
  row_count integer not null check (row_count > 0),
  numeric_count integer not null check (numeric_count >= 0),
  np_count integer not null check (np_count >= 0),
  version integer not null default 1 check (version >= 1),
  unique(assignment_id, evaluation_period_id, version)
);

alter table public.grades
  add constraint grades_publication_fk foreign key (publication_id) references public.grade_publications(id);

create table public.grade_change_history (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades(id),
  actor_id uuid not null references public.profiles(id),
  actor_role public.app_role not null,
  old_kind public.grade_kind,
  old_numeric_grade numeric(3,1),
  new_kind public.grade_kind not null,
  new_numeric_grade numeric(3,1),
  operation text not null,
  reason text,
  request_id uuid,
  changed_at timestamptz not null default now()
);

create table public.grade_change_requests (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades(id),
  requested_by uuid not null references public.profiles(id),
  requested_kind public.grade_kind not null check (requested_kind <> 'PENDING'),
  requested_numeric_grade numeric(3,1),
  reason text not null check (length(trim(reason)) >= 5),
  state public.change_request_state not null default 'PENDING',
  resolved_by uuid references public.profiles(id),
  resolution_reason text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (
    (requested_kind='NUMERIC' and requested_numeric_grade between 0.0 and 10.0)
    or (requested_kind='NP' and requested_numeric_grade is null)
  ),
  check (
    (state='PENDING' and resolved_at is null)
    or (state<>'PENDING')
  )
);
create unique index grade_change_request_one_pending on public.grade_change_requests(grade_id) where state='PENDING';

-- ---------- EXTRAORDINARY ----------
create table public.extraordinary_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_subject_enrollment_id uuid not null unique references public.student_subject_enrollments(id),
  authorized_by uuid references public.profiles(id),
  authorized_at timestamptz,
  scheduled_at timestamptz,
  captured_by uuid references public.profiles(id),
  captured_at timestamptz,
  numeric_grade numeric(3,1) check (numeric_grade between 0.0 and 10.0),
  published_at timestamptz,
  state public.extraordinary_state not null default 'ELIGIBLE',
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- DOCUMENTS / NOTIFICATIONS ----------
create table public.academic_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  academic_period_id uuid not null references public.academic_periods(id),
  type public.document_type not null,
  folio text not null unique,
  current_version integer not null default 1 check (current_version >= 1),
  state public.document_state not null default 'VIGENTE',
  verification_token_hash text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(student_id, academic_period_id, type, current_version)
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.academic_documents(id),
  version integer not null check (version >= 1),
  state public.document_state not null default 'VIGENTE',
  storage_path text not null,
  sha256 text not null check (length(sha256)=64),
  generated_at timestamptz not null default now(),
  generated_by uuid not null references public.profiles(id),
  superseded_at timestamptz,
  unique(document_id, version)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.institution_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null default 'CBTA241' unique check (singleton_key='CBTA241'),
  official_name text not null default 'CENTRO DE BACHILLERATO TECNOLÓGICO AGROPECUARIO No. 241',
  short_name text not null default 'CBTA 241',
  school_key text,
  address text,
  phone text,
  email text,
  director_name text,
  timezone text not null default 'America/Mexico_City',
  passing_grade numeric(3,1) not null default 6.0 check (passing_grade between 0 and 10),
  logo_path text not null default '/institution/cbta241-logo.png',
  director_signature_storage_path text,
  institutional_seal_storage_path text,
  current_period_id uuid references public.academic_periods(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role public.app_role,
  action text not null,
  entity text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index enrollments_student_period_idx on public.enrollments(student_id, academic_period_id);
create index enrollments_group_status_idx on public.enrollments(group_id, status);
create index assignments_teacher_active_idx on public.teacher_assignments(teacher_id, academic_period_id, is_active);
create index sse_enrollment_subject_idx on public.student_subject_enrollments(enrollment_id, subject_id);
create index grades_assignment_eval_idx on public.grades(assignment_id, evaluation_period_id);
create index grades_sse_idx on public.grades(student_subject_enrollment_id);
create index grade_history_grade_changed_idx on public.grade_change_history(grade_id, changed_at desc);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index audit_entity_idx on public.audit_logs(entity, entity_id, occurred_at desc);
create index audit_actor_idx on public.audit_logs(actor_id, occurred_at desc);
create index documents_student_period_idx on public.academic_documents(student_id, academic_period_id);

-- ---------- UPDATED_AT TRIGGERS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','students','teachers','academic_periods','groups','subjects','enrollments',
    'teacher_assignments','student_subject_enrollments','evaluation_periods','grades',
    'extraordinary_evaluations','institution_settings'
  ] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Audit logs and grade history are append-only.
create trigger audit_logs_no_delete before delete on public.audit_logs for each row execute function public.prevent_delete();
create trigger grade_history_no_delete before delete on public.grade_change_history for each row execute function public.prevent_delete();

-- ---------- AUTHORIZATION HELPERS ----------
create or replace function public.current_user_has_role(p_role public.app_role)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = p_role and p.is_active
  );
$$;

create or replace function public.current_primary_role()
returns public.app_role
language sql stable security definer
set search_path = public, auth
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by case ur.role
    when 'SUPERADMIN' then 1 when 'CONTROL_ESCOLAR' then 2 when 'DOCENTE' then 3 else 4 end
  limit 1;
$$;

create or replace function public.current_student_id()
returns uuid
language sql stable security definer
set search_path = public, auth
as $$
  select s.id from public.students s where s.profile_id = auth.uid() and s.is_active limit 1;
$$;

create or replace function public.current_teacher_id()
returns uuid
language sql stable security definer
set search_path = public, auth
as $$
  select t.id from public.teachers t where t.profile_id = auth.uid() and t.is_active limit 1;
$$;

create or replace function public.teacher_owns_assignment(p_assignment_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    where ta.id = p_assignment_id
      and ta.teacher_id = public.current_teacher_id()
      and ta.is_active
      and ta.active_from <= now()
      and (ta.active_until is null or ta.active_until > now())
  );
$$;

create or replace function public.student_owns_sse(p_sse_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.student_subject_enrollments sse
    join public.enrollments e on e.id = sse.enrollment_id
    where sse.id = p_sse_id and e.student_id = public.current_student_id()
  );
$$;

create or replace function public.assignment_covers_sse(p_assignment_id uuid, p_sse_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    join public.student_subject_enrollments sse on sse.subject_id = ta.subject_id
    join public.enrollments e on e.id = sse.enrollment_id and e.group_id = ta.group_id and e.academic_period_id = ta.academic_period_id
    where ta.id = p_assignment_id and sse.id = p_sse_id and e.status='ACTIVE' and sse.status='ACTIVE'
  );
$$;

-- ---------- AUDIT HELPER ----------
create or replace function public.write_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare v_id uuid;
begin
  insert into public.audit_logs(actor_id, actor_role, action, entity, entity_id, before_data, after_data, reason, metadata)
  values(auth.uid(), public.current_primary_role(), p_action, p_entity, p_entity_id, p_before, p_after, p_reason, coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- GRADE DRAFT RPC ----------
create or replace function public.save_grade_draft(
  p_student_subject_enrollment_id uuid,
  p_evaluation_period_id uuid,
  p_kind public.grade_kind,
  p_numeric_grade numeric,
  p_expected_version integer default null
) returns public.grades
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_assignment public.teacher_assignments;
  v_eval public.evaluation_periods;
  v_existing public.grades;
  v_result public.grades;
  v_is_control boolean := public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_kind='PENDING' and p_numeric_grade is not null then raise exception 'PENDING_MUST_NOT_HAVE_GRADE'; end if;
  if p_kind='NP' and p_numeric_grade is not null then raise exception 'NP_MUST_NOT_HAVE_GRADE'; end if;
  if p_kind='NUMERIC' and (p_numeric_grade is null or p_numeric_grade < 0 or p_numeric_grade > 10 or scale(p_numeric_grade) > 1) then
    raise exception 'INVALID_GRADE';
  end if;

  select ep.* into v_eval from public.evaluation_periods ep where ep.id=p_evaluation_period_id;
  if not found or v_eval.state not in ('OPEN','REOPENED') then raise exception 'EVALUATION_NOT_OPEN'; end if;

  if v_is_control then
    select ta.* into v_assignment
    from public.teacher_assignments ta
    join public.student_subject_enrollments sse on sse.subject_id=ta.subject_id
    join public.enrollments e on e.id=sse.enrollment_id and e.group_id=ta.group_id and e.academic_period_id=ta.academic_period_id
    where sse.id=p_student_subject_enrollment_id and ta.academic_period_id=v_eval.academic_period_id and ta.is_active limit 1;
  else
    select ta.* into v_assignment
    from public.teacher_assignments ta
    join public.student_subject_enrollments sse on sse.subject_id=ta.subject_id
    join public.enrollments e on e.id=sse.enrollment_id and e.group_id=ta.group_id and e.academic_period_id=ta.academic_period_id
    where sse.id=p_student_subject_enrollment_id and ta.academic_period_id=v_eval.academic_period_id
      and ta.teacher_id=public.current_teacher_id() and ta.is_active
      and ta.active_from<=now() and (ta.active_until is null or ta.active_until>now())
    limit 1;
  end if;
  if not found then raise exception 'ASSIGNMENT_DENIED' using errcode='42501'; end if;

  select * into v_existing from public.grades
    where student_subject_enrollment_id=p_student_subject_enrollment_id and evaluation_period_id=p_evaluation_period_id
    for update;

  if found then
    if v_existing.state='PUBLISHED' then raise exception 'USE_PUBLISHED_CORRECTION_WORKFLOW'; end if;
    if p_expected_version is not null and v_existing.version <> p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
    update public.grades set
      kind=p_kind,
      numeric_grade=case when p_kind='NUMERIC' then p_numeric_grade else null end,
      assignment_id=v_assignment.id,
      updated_by=auth.uid(),
      version=version+1
    where id=v_existing.id
    returning * into v_result;
  else
    if p_expected_version is not null and p_expected_version <> 0 then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
    insert into public.grades(student_subject_enrollment_id,evaluation_period_id,assignment_id,kind,numeric_grade,created_by,updated_by)
    values(p_student_subject_enrollment_id,p_evaluation_period_id,v_assignment.id,p_kind,case when p_kind='NUMERIC' then p_numeric_grade else null end,auth.uid(),auth.uid())
    returning * into v_result;
  end if;

  perform public.write_audit('GRADE_UPDATED','grades',v_result.id,to_jsonb(v_existing),to_jsonb(v_result),null,jsonb_build_object('mode','draft'));
  return v_result;
end;
$$;

-- ---------- ATOMIC PUBLICATION RPC ----------
create or replace function public.publish_assignment_grades(
  p_assignment_id uuid,
  p_evaluation_period_id uuid,
  p_idempotency_key text
) returns public.grade_publications
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_assignment public.teacher_assignments;
  v_eval public.evaluation_periods;
  v_expected integer;
  v_actual integer;
  v_pending integer;
  v_numeric integer;
  v_np integer;
  v_version integer;
  v_pub public.grade_publications;
  v_is_control boolean := public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if length(coalesce(p_idempotency_key,'')) < 16 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select * into v_pub from public.grade_publications where idempotency_key=p_idempotency_key;
  if found then return v_pub; end if;

  select * into v_assignment from public.teacher_assignments where id=p_assignment_id for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if not v_is_control and not public.teacher_owns_assignment(p_assignment_id) then raise exception 'ASSIGNMENT_DENIED' using errcode='42501'; end if;

  select * into v_eval from public.evaluation_periods where id=p_evaluation_period_id for share;
  if not found or v_eval.academic_period_id<>v_assignment.academic_period_id or v_eval.state not in ('OPEN','REOPENED') then
    raise exception 'EVALUATION_NOT_PUBLISHABLE';
  end if;

  select count(*) into v_expected
  from public.student_subject_enrollments sse
  join public.enrollments e on e.id=sse.enrollment_id
  where e.group_id=v_assignment.group_id and e.academic_period_id=v_assignment.academic_period_id
    and e.status='ACTIVE' and sse.status='ACTIVE' and sse.subject_id=v_assignment.subject_id;

  select count(*), count(*) filter(where g.kind='PENDING'), count(*) filter(where g.kind='NUMERIC'), count(*) filter(where g.kind='NP')
    into v_actual,v_pending,v_numeric,v_np
  from public.grades g
  where g.assignment_id=p_assignment_id and g.evaluation_period_id=p_evaluation_period_id;

  if v_expected=0 then raise exception 'NO_ACTIVE_STUDENTS'; end if;
  if v_actual<>v_expected then raise exception 'INCOMPLETE_GRADE_SET expected=% actual=%',v_expected,v_actual; end if;
  if v_pending>0 then raise exception 'PENDING_GRADES_NOT_ALLOWED'; end if;

  select coalesce(max(version),0)+1 into v_version from public.grade_publications
  where assignment_id=p_assignment_id and evaluation_period_id=p_evaluation_period_id;

  insert into public.grade_publications(assignment_id,evaluation_period_id,published_by,idempotency_key,row_count,numeric_count,np_count,version)
  values(p_assignment_id,p_evaluation_period_id,auth.uid(),p_idempotency_key,v_actual,v_numeric,v_np,v_version)
  returning * into v_pub;

  update public.grades
  set state='PUBLISHED', published_at=v_pub.published_at, published_by=auth.uid(), publication_id=v_pub.id, version=version+1, updated_by=auth.uid()
  where assignment_id=p_assignment_id and evaluation_period_id=p_evaluation_period_id;

  insert into public.notifications(user_id,type,title,body,metadata)
  select s.profile_id,'GRADE_PUBLISHED','Calificación publicada',
         'Se publicó una evaluación de '||sub.name||'.',
         jsonb_build_object('evaluation_period_id',p_evaluation_period_id,'subject_id',sub.id)
  from public.teacher_assignments ta
  join public.subjects sub on sub.id=ta.subject_id
  join public.enrollments e on e.group_id=ta.group_id and e.academic_period_id=ta.academic_period_id and e.status='ACTIVE'
  join public.students s on s.id=e.student_id and s.profile_id is not null
  where ta.id=p_assignment_id;

  perform public.write_audit('GRADE_PUBLISHED','grade_publications',v_pub.id,null,to_jsonb(v_pub),null,jsonb_build_object('rows',v_actual));
  return v_pub;
end;
$$;

-- ---------- CORRECTION WORKFLOW ----------
create or replace function public.correct_published_grade(
  p_grade_id uuid,
  p_kind public.grade_kind,
  p_numeric_grade numeric,
  p_reason text default null,
  p_expected_version integer default null
) returns public.grades
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_old public.grades;
  v_new public.grades;
  v_role public.app_role := public.current_primary_role();
  v_is_control boolean := public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_kind='PENDING' then raise exception 'PUBLISHED_GRADE_CANNOT_BECOME_PENDING'; end if;
  if p_kind='NUMERIC' and (p_numeric_grade is null or p_numeric_grade<0 or p_numeric_grade>10 or scale(p_numeric_grade)>1) then raise exception 'INVALID_GRADE'; end if;
  if p_kind='NP' and p_numeric_grade is not null then raise exception 'NP_MUST_NOT_HAVE_GRADE'; end if;

  select * into v_old from public.grades where id=p_grade_id for update;
  if not found or v_old.state<>'PUBLISHED' then raise exception 'PUBLISHED_GRADE_REQUIRED'; end if;
  if p_expected_version is not null and v_old.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;

  if v_is_control then
    if length(trim(coalesce(p_reason,'')))<5 then raise exception 'CONTROL_CORRECTION_REASON_REQUIRED'; end if;
  else
    if not public.teacher_owns_assignment(v_old.assignment_id) then raise exception 'ASSIGNMENT_DENIED' using errcode='42501'; end if;
    if now() > v_old.published_at + interval '72 hours' then raise exception 'DIRECT_CORRECTION_WINDOW_EXPIRED' using errcode='42501'; end if;
  end if;

  update public.grades set
    kind=p_kind,
    numeric_grade=case when p_kind='NUMERIC' then p_numeric_grade else null end,
    updated_by=auth.uid(), version=version+1
  where id=p_grade_id returning * into v_new;

  insert into public.grade_change_history(grade_id,actor_id,actor_role,old_kind,old_numeric_grade,new_kind,new_numeric_grade,operation,reason)
  values(v_new.id,auth.uid(),coalesce(v_role,'ALUMNO'),v_old.kind,v_old.numeric_grade,v_new.kind,v_new.numeric_grade,'DIRECT_CORRECTION',p_reason);

  insert into public.notifications(user_id,type,title,body,metadata)
  select s.profile_id,'GRADE_CORRECTED','Calificación corregida','Se publicó una corrección a una calificación.',jsonb_build_object('grade_id',v_new.id)
  from public.student_subject_enrollments sse
  join public.enrollments e on e.id=sse.enrollment_id
  join public.students s on s.id=e.student_id
  where sse.id=v_new.student_subject_enrollment_id and s.profile_id is not null;

  perform public.write_audit('GRADE_UPDATED','grades',v_new.id,to_jsonb(v_old),to_jsonb(v_new),p_reason,jsonb_build_object('mode','published_correction'));
  return v_new;
end;
$$;

create or replace function public.request_grade_correction(
  p_grade_id uuid,
  p_kind public.grade_kind,
  p_numeric_grade numeric,
  p_reason text
) returns public.grade_change_requests
language plpgsql security definer
set search_path = public, auth
as $$
declare v_grade public.grades; v_req public.grade_change_requests;
begin
  select * into v_grade from public.grades where id=p_grade_id;
  if not found or v_grade.state<>'PUBLISHED' then raise exception 'PUBLISHED_GRADE_REQUIRED'; end if;
  if not public.teacher_owns_assignment(v_grade.assignment_id) then raise exception 'ASSIGNMENT_DENIED' using errcode='42501'; end if;
  if now() <= v_grade.published_at + interval '72 hours' then raise exception 'DIRECT_CORRECTION_STILL_AVAILABLE'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if p_kind='PENDING' then raise exception 'REQUESTED_GRADE_CANNOT_BE_PENDING'; end if;
  if p_kind='NUMERIC' and (p_numeric_grade is null or p_numeric_grade<0 or p_numeric_grade>10 or scale(p_numeric_grade)>1) then raise exception 'INVALID_GRADE'; end if;

  insert into public.grade_change_requests(grade_id,requested_by,requested_kind,requested_numeric_grade,reason)
  values(p_grade_id,auth.uid(),p_kind,case when p_kind='NUMERIC' then p_numeric_grade else null end,p_reason)
  returning * into v_req;
  perform public.write_audit('GRADE_CHANGE_REQUESTED','grade_change_requests',v_req.id,null,to_jsonb(v_req),p_reason);
  return v_req;
end;
$$;

create or replace function public.resolve_grade_correction_request(
  p_request_id uuid,
  p_approve boolean,
  p_resolution_reason text
) returns public.grade_change_requests
language plpgsql security definer
set search_path = public, auth
as $$
declare v_req public.grade_change_requests; v_old public.grades; v_new public.grades;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_resolution_reason,'')))<5 then raise exception 'RESOLUTION_REASON_REQUIRED'; end if;
  select * into v_req from public.grade_change_requests where id=p_request_id for update;
  if not found or v_req.state<>'PENDING' then raise exception 'PENDING_REQUEST_REQUIRED'; end if;

  if p_approve then
    select * into v_old from public.grades where id=v_req.grade_id for update;
    update public.grades set kind=v_req.requested_kind,
      numeric_grade=case when v_req.requested_kind='NUMERIC' then v_req.requested_numeric_grade else null end,
      updated_by=auth.uid(),version=version+1
    where id=v_req.grade_id returning * into v_new;

    insert into public.grade_change_history(grade_id,actor_id,actor_role,old_kind,old_numeric_grade,new_kind,new_numeric_grade,operation,reason,request_id)
    values(v_new.id,auth.uid(),public.current_primary_role(),v_old.kind,v_old.numeric_grade,v_new.kind,v_new.numeric_grade,'REQUEST_APPROVED',p_resolution_reason,v_req.id);

    update public.grade_change_requests set state='APPROVED',resolved_by=auth.uid(),resolution_reason=p_resolution_reason,resolved_at=now()
      where id=v_req.id returning * into v_req;
  else
    update public.grade_change_requests set state='REJECTED',resolved_by=auth.uid(),resolution_reason=p_resolution_reason,resolved_at=now()
      where id=v_req.id returning * into v_req;
  end if;
  perform public.write_audit(case when p_approve then 'GRADE_CHANGE_APPROVED' else 'GRADE_CHANGE_REJECTED' end,'grade_change_requests',v_req.id,null,to_jsonb(v_req),p_resolution_reason);
  return v_req;
end;
$$;

-- ---------- EXTRAORDINARY WORKFLOW ----------
create or replace function public.authorize_extraordinary(p_sse_id uuid, p_reason text)
returns public.extraordinary_evaluations
language plpgsql security definer
set search_path=public,auth
as $$
declare v_avg numeric; v_extra public.extraordinary_evaluations;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select round(avg(case g.kind when 'NUMERIC' then g.numeric_grade when 'NP' then 0 else null end),1)
    into v_avg
  from public.grades g join public.evaluation_periods ep on ep.id=g.evaluation_period_id
  where g.student_subject_enrollment_id=p_sse_id and g.state='PUBLISHED' and ep.partial_number between 1 and 3;
  if v_avg is null or v_avg>=6.0 then raise exception 'NOT_ELIGIBLE_FOR_EXTRAORDINARY'; end if;
  insert into public.extraordinary_evaluations(student_subject_enrollment_id,authorized_by,authorized_at,state)
  values(p_sse_id,auth.uid(),now(),'AUTHORIZED')
  returning * into v_extra;
  perform public.write_audit('EXTRAORDINARY_AUTHORIZED','extraordinary_evaluations',v_extra.id,null,to_jsonb(v_extra),p_reason);
  return v_extra;
exception when unique_violation then
  raise exception 'EXTRAORDINARY_ALREADY_EXISTS';
end;
$$;

create or replace function public.capture_extraordinary(p_extra_id uuid, p_grade numeric, p_expected_version integer)
returns public.extraordinary_evaluations
language plpgsql security definer
set search_path=public,auth
as $$
declare v_extra public.extraordinary_evaluations; v_assignment uuid;
begin
  select * into v_extra from public.extraordinary_evaluations where id=p_extra_id for update;
  if not found then raise exception 'EXTRAORDINARY_NOT_FOUND'; end if;
  if v_extra.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  if v_extra.state not in ('AUTHORIZED','SCHEDULED') then raise exception 'EXTRAORDINARY_NOT_CAPTURABLE'; end if;
  if p_grade<0 or p_grade>10 or scale(p_grade)>1 then raise exception 'INVALID_GRADE'; end if;
  select ta.id into v_assignment
  from public.student_subject_enrollments sse
  join public.enrollments e on e.id=sse.enrollment_id
  join public.teacher_assignments ta on ta.subject_id=sse.subject_id and ta.group_id=e.group_id and ta.academic_period_id=e.academic_period_id and ta.is_active
  where sse.id=v_extra.student_subject_enrollment_id
  limit 1;
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') and not public.teacher_owns_assignment(v_assignment) then
    raise exception 'ASSIGNMENT_DENIED' using errcode='42501';
  end if;
  update public.extraordinary_evaluations set numeric_grade=p_grade,captured_by=auth.uid(),captured_at=now(),state='CAPTURED',version=version+1
  where id=p_extra_id returning * into v_extra;
  perform public.write_audit('EXTRAORDINARY_CAPTURED','extraordinary_evaluations',v_extra.id,null,to_jsonb(v_extra));
  return v_extra;
end;
$$;

create or replace function public.publish_extraordinary(p_extra_id uuid, p_expected_version integer)
returns public.extraordinary_evaluations
language plpgsql security definer
set search_path=public,auth
as $$
declare v_extra public.extraordinary_evaluations;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into v_extra from public.extraordinary_evaluations where id=p_extra_id for update;
  if not found or v_extra.state<>'CAPTURED' then raise exception 'CAPTURED_EXTRAORDINARY_REQUIRED'; end if;
  if v_extra.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  update public.extraordinary_evaluations set state=case when numeric_grade>=6 then 'ACCREDITED' else 'NOT_ACCREDITED' end,
    published_at=now(),version=version+1 where id=p_extra_id returning * into v_extra;
  perform public.write_audit('EXTRAORDINARY_PUBLISHED','extraordinary_evaluations',v_extra.id,null,to_jsonb(v_extra));
  return v_extra;
end;
$$;

-- ---------- EVALUATION TRANSITION ----------
create or replace function public.transition_evaluation_period(p_id uuid, p_state public.evaluation_state, p_reason text, p_expected_version integer)
returns public.evaluation_periods
language plpgsql security definer
set search_path=public,auth
as $$
declare v_ep public.evaluation_periods;
begin
  if not public.current_user_has_role('CONTROL_ESCOLAR') and not public.current_user_has_role('SUPERADMIN') then raise exception 'CONTROL_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_state='REOPENED' and length(trim(coalesce(p_reason,'')))<5 then raise exception 'REOPEN_REASON_REQUIRED'; end if;
  select * into v_ep from public.evaluation_periods where id=p_id for update;
  if not found then raise exception 'EVALUATION_NOT_FOUND'; end if;
  if v_ep.version<>p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  update public.evaluation_periods
  set state=p_state,
      opens_at=case when p_state in ('OPEN','REOPENED') and opens_at is null then now() else opens_at end,
      closes_at=case when p_state='CLOSED' then now() when p_state in ('OPEN','REOPENED') then null else closes_at end,
      last_transition_reason=p_reason,last_transition_by=auth.uid(),version=version+1
  where id=p_id returning * into v_ep;
  perform public.write_audit(case p_state when 'OPEN' then 'EVALUATION_PERIOD_OPENED' when 'CLOSED' then 'EVALUATION_PERIOD_CLOSED' when 'REOPENED' then 'EVALUATION_PERIOD_REOPENED' else 'EVALUATION_PERIOD_UPDATED' end,'evaluation_periods',v_ep.id,null,to_jsonb(v_ep),p_reason);
  return v_ep;
end;
$$;

-- ---------- VIEWS ----------
create view public.student_grade_overview with (security_invoker=true) as
select
  sse.id as student_subject_enrollment_id,
  e.student_id,
  e.academic_period_id,
  sub.id as subject_id,
  sub.name as subject_name,
  max(case when ep.partial_number=1 then case g.kind when 'NUMERIC' then to_char(g.numeric_grade,'FM990.0') when 'NP' then 'NP' else null end end) as p1,
  max(case when ep.partial_number=2 then case g.kind when 'NUMERIC' then to_char(g.numeric_grade,'FM990.0') when 'NP' then 'NP' else null end end) as p2,
  max(case when ep.partial_number=3 then case g.kind when 'NUMERIC' then to_char(g.numeric_grade,'FM990.0') when 'NP' then 'NP' else null end end) as p3,
  round(avg(case when g.state='PUBLISHED' then case g.kind when 'NUMERIC' then g.numeric_grade when 'NP' then 0 else null end else null end) filter(where ep.partial_number between 1 and 3),1) as published_average,
  count(*) filter(where g.state='PUBLISHED' and ep.partial_number between 1 and 3) as published_partial_count,
  xe.numeric_grade as extraordinary_grade,
  xe.state as extraordinary_state
from public.student_subject_enrollments sse
join public.enrollments e on e.id=sse.enrollment_id
join public.subjects sub on sub.id=sse.subject_id
left join public.grades g on g.student_subject_enrollment_id=sse.id and g.state='PUBLISHED'
left join public.evaluation_periods ep on ep.id=g.evaluation_period_id
left join public.extraordinary_evaluations xe on xe.student_subject_enrollment_id=sse.id and xe.published_at is not null
group by sse.id,e.student_id,e.academic_period_id,sub.id,sub.name,xe.numeric_grade,xe.state;

-- ---------- ROW LEVEL SECURITY ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','students','teachers','academic_periods','semesters','generations','groups','subjects',
    'enrollments','teacher_assignments','student_subject_enrollments','evaluation_periods','grades','grade_publications',
    'grade_change_history','grade_change_requests','extraordinary_evaluations','academic_documents','document_versions',
    'notifications','institution_settings','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
  end loop;
end $$;

-- Profiles: own profile; administrators read active directory.
create policy profiles_select on public.profiles for select to authenticated using (
  id=auth.uid() or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- Role assignments are readable by self and administrators; writes only superadmin.
create policy user_roles_select on public.user_roles for select to authenticated using (
  user_id=auth.uid() or public.current_user_has_role('SUPERADMIN') or public.current_user_has_role('CONTROL_ESCOLAR')
);
create policy user_roles_all_superadmin on public.user_roles for all to authenticated using (public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('SUPERADMIN'));

-- Catalog reads for authenticated users; writes limited to control/admin.
do $$
declare t text;
begin
  foreach t in array array['academic_periods','semesters','generations','groups','subjects','evaluation_periods'] loop
    execute format('create policy %I_select_auth on public.%I for select to authenticated using (true)',t,t);
    execute format('create policy %I_control_write on public.%I for all to authenticated using (public.current_user_has_role(''CONTROL_ESCOLAR'') or public.current_user_has_role(''SUPERADMIN'')) with check (public.current_user_has_role(''CONTROL_ESCOLAR'') or public.current_user_has_role(''SUPERADMIN''))',t,t);
  end loop;
end $$;

-- Students/teachers directory scoped by role.
create policy students_select on public.students for select to authenticated using (
  id=public.current_student_id()
  or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
  or exists (
    select 1 from public.enrollments e
    join public.teacher_assignments ta on ta.group_id=e.group_id and ta.academic_period_id=e.academic_period_id
    where e.student_id=students.id and ta.teacher_id=public.current_teacher_id() and ta.is_active
  )
);
create policy students_control_write on public.students for all to authenticated using (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'));
create policy teachers_select on public.teachers for select to authenticated using (
  id=public.current_teacher_id() or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);
create policy teachers_control_write on public.teachers for all to authenticated using (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'));

create policy enrollments_select on public.enrollments for select to authenticated using (
  student_id=public.current_student_id()
  or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
  or exists(select 1 from public.teacher_assignments ta where ta.group_id=enrollments.group_id and ta.academic_period_id=enrollments.academic_period_id and ta.teacher_id=public.current_teacher_id() and ta.is_active)
);
create policy enrollments_control_write on public.enrollments for all to authenticated using (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'));

create policy assignments_select on public.teacher_assignments for select to authenticated using (
  teacher_id=public.current_teacher_id() or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);
create policy assignments_control_write on public.teacher_assignments for all to authenticated using (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'));

create policy sse_select on public.student_subject_enrollments for select to authenticated using (
  public.student_owns_sse(id)
  or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
  or exists(
    select 1 from public.enrollments e
    join public.teacher_assignments ta on ta.group_id=e.group_id and ta.academic_period_id=e.academic_period_id and ta.subject_id=student_subject_enrollments.subject_id
    where e.id=student_subject_enrollments.enrollment_id and ta.teacher_id=public.current_teacher_id() and ta.is_active
  )
);
create policy sse_control_write on public.student_subject_enrollments for all to authenticated using (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'));

-- Grades: students only published own data; teachers only their assignments; mutations happen through RPCs.
create policy grades_select on public.grades for select to authenticated using (
  (state='PUBLISHED' and public.student_owns_sse(student_subject_enrollment_id))
  or public.teacher_owns_assignment(assignment_id)
  or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);
create policy publications_select on public.grade_publications for select to authenticated using (
  public.teacher_owns_assignment(assignment_id)
  or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
  or exists(select 1 from public.grades g where g.publication_id=grade_publications.id and public.student_owns_sse(g.student_subject_enrollment_id))
);
create policy grade_history_select on public.grade_change_history for select to authenticated using (
  public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
  or exists(select 1 from public.grades g where g.id=grade_change_history.grade_id and (public.teacher_owns_assignment(g.assignment_id) or public.student_owns_sse(g.student_subject_enrollment_id)))
);
create policy change_requests_select on public.grade_change_requests for select to authenticated using (
  requested_by=auth.uid() or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);

create policy extraordinary_select on public.extraordinary_evaluations for select to authenticated using (
  public.student_owns_sse(student_subject_enrollment_id)
  or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
  or exists(
    select 1 from public.student_subject_enrollments sse
    join public.enrollments e on e.id=sse.enrollment_id
    join public.teacher_assignments ta on ta.subject_id=sse.subject_id and ta.group_id=e.group_id and ta.academic_period_id=e.academic_period_id
    where sse.id=extraordinary_evaluations.student_subject_enrollment_id and ta.teacher_id=public.current_teacher_id() and ta.is_active
  )
);

create policy documents_select on public.academic_documents for select to authenticated using (
  student_id=public.current_student_id() or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')
);
create policy documents_control_write on public.academic_documents for all to authenticated using (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'));
create policy document_versions_select on public.document_versions for select to authenticated using (
  exists(select 1 from public.academic_documents d where d.id=document_versions.document_id and (d.student_id=public.current_student_id() or public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')))
);
create policy document_versions_control_write on public.document_versions for all to authenticated using (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN')) with check (public.current_user_has_role('CONTROL_ESCOLAR') or public.current_user_has_role('SUPERADMIN'));

create policy notifications_own on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());

create policy institution_settings_read on public.institution_settings for select to authenticated using(true);
create policy institution_settings_admin on public.institution_settings for all to authenticated using(public.current_user_has_role('SUPERADMIN') or public.current_user_has_role('CONTROL_ESCOLAR')) with check(public.current_user_has_role('SUPERADMIN') or public.current_user_has_role('CONTROL_ESCOLAR'));

create policy audit_logs_admin_read on public.audit_logs for select to authenticated using(public.current_user_has_role('SUPERADMIN') or public.current_user_has_role('CONTROL_ESCOLAR'));

-- No public table policy is granted to anon. Public document verification must go through a controlled server function/route.

-- ---------- PRIVILEGES ----------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select on public.profiles, public.user_roles, public.students, public.teachers, public.academic_periods, public.semesters,
  public.generations, public.groups, public.subjects, public.enrollments, public.teacher_assignments,
  public.student_subject_enrollments, public.evaluation_periods, public.grades, public.grade_publications,
  public.grade_change_history, public.grade_change_requests, public.extraordinary_evaluations,
  public.academic_documents, public.document_versions, public.notifications, public.institution_settings,
  public.audit_logs, public.student_grade_overview to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant update(display_name) on public.profiles to authenticated;

grant execute on function public.save_grade_draft(uuid,uuid,public.grade_kind,numeric,integer) to authenticated;
grant execute on function public.publish_assignment_grades(uuid,uuid,text) to authenticated;
grant execute on function public.correct_published_grade(uuid,public.grade_kind,numeric,text,integer) to authenticated;
grant execute on function public.request_grade_correction(uuid,public.grade_kind,numeric,text) to authenticated;
grant execute on function public.resolve_grade_correction_request(uuid,boolean,text) to authenticated;
grant execute on function public.authorize_extraordinary(uuid,text) to authenticated;
grant execute on function public.capture_extraordinary(uuid,numeric,integer) to authenticated;
grant execute on function public.publish_extraordinary(uuid,integer) to authenticated;
grant execute on function public.transition_evaluation_period(uuid,public.evaluation_state,text,integer) to authenticated;

-- Baseline semester catalog and institution singleton.
insert into public.semesters(number) values (1),(2),(3),(4),(5),(6) on conflict do nothing;
insert into public.institution_settings(singleton_key) values('CBTA241') on conflict do nothing;

commit;
