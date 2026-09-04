begin;

select plan(8);

-- Isolate this transactional test from any already-provisioned production Superadmin.
delete from public.user_roles where role='SUPERADMIN';

insert into auth.users(id,aud,role,email,email_confirmed_at,is_sso_user,is_anonymous,created_at,updated_at) values
 ('12000000-0000-0000-0000-000000000001','authenticated','authenticated','bootstrap1@test.invalid',now(),false,false,now(),now()),
 ('12000000-0000-0000-0000-000000000002','authenticated','authenticated','bootstrap2@test.invalid',now(),false,false,now(),now()),
 ('12000000-0000-0000-0000-000000000003','authenticated','authenticated','unconfirmed@test.invalid',null,false,false,now(),now());

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok(
  $$select public.bootstrap_first_superadmin('12000000-0000-0000-0000-000000000003','unconfirmed@test.invalid','Unconfirmed Admin')$$,
  'P0001',
  'AUTH_EMAIL_NOT_CONFIRMED',
  'bootstrap requires a confirmed Auth email'
);
select throws_ok(
  $$select public.bootstrap_first_superadmin('12000000-0000-0000-0000-000000000001','different@test.invalid','Bootstrap Admin')$$,
  'P0001',
  'AUTH_EMAIL_MISMATCH',
  'bootstrap rejects mismatched Auth email'
);
select lives_ok(
  $$select public.bootstrap_first_superadmin('12000000-0000-0000-0000-000000000001','bootstrap1@test.invalid','Bootstrap Admin')$$,
  'service_role can bootstrap first confirmed Superadmin'
);
reset role;

select results_eq(
  $$select role::text from public.user_roles where user_id='12000000-0000-0000-0000-000000000001'$$,
  $$values ('SUPERADMIN'::text)$$,
  'bootstrap assigns SUPERADMIN role'
);

select results_eq(
  $$select count(*)::bigint from public.audit_logs where action='FIRST_SUPERADMIN_BOOTSTRAPPED' and actor_id='12000000-0000-0000-0000-000000000001'$$,
  $$values (1::bigint)$$,
  'bootstrap is audited'
);

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok(
  $$select public.bootstrap_first_superadmin('12000000-0000-0000-0000-000000000002','bootstrap2@test.invalid','Second Bootstrap')$$,
  '42501',
  'SUPERADMIN_ALREADY_BOOTSTRAPPED',
  'bootstrap is one-time only'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok(
  $$select public.set_user_active_workflow('12000000-0000-0000-0000-000000000001',false,'Intento de auto baja')$$,
  'P0001',
  'CANNOT_DISABLE_SELF',
  'Superadmin cannot disable self'
);
select throws_ok(
  $$select public.replace_user_role_workflow('12000000-0000-0000-0000-000000000001','CONTROL_ESCOLAR','Intento de auto degradación')$$,
  'P0001',
  'CANNOT_REMOVE_OWN_SUPERADMIN',
  'Superadmin cannot demote self'
);
reset role;

select * from finish();
rollback;
