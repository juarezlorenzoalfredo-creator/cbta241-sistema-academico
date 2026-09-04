begin;

select plan(6);

insert into auth.users(
  id,aud,role,email,email_confirmed_at,is_sso_user,is_anonymous,created_at,updated_at
) values (
  '13000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','settings-admin@test.invalid',now(),false,false,now(),now()
);

insert into public.profiles(id,display_name,email,is_active)
values(
  '13000000-0000-0000-0000-000000000001',
  'Settings Admin Test',
  'settings-admin@test.invalid',
  true
);

insert into public.user_roles(user_id,role)
values('13000000-0000-0000-0000-000000000001','SUPERADMIN');

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

select lives_ok(
  $$select public.update_institution_settings_workflow(
    'CENTRO DE BACHILLERATO TECNOLÓGICO AGROPECUARIO No. 241',
    'CBTA 241',
    'DEMO-CBTA241',
    null,
    null,
    'demo@cbta241.local',
    null,
    'America/Mexico_City',
    null,
    null
  )$$,
  'identical institution settings submission succeeds as a no-op'
);

select results_eq(
  $$select count(*)::bigint from public.audit_logs where actor_id='13000000-0000-0000-0000-000000000001' and action='INSTITUTION_SETTINGS_UPDATED'$$,
  $$values (0::bigint)$$,
  'no-op institution settings submission is not audited'
);

select lives_ok(
  $$select public.update_institution_settings_workflow(
    'CENTRO DE BACHILLERATO TECNOLÓGICO AGROPECUARIO No. 241',
    'CBTA 241',
    'DEMO-CBTA241-IDEM',
    null,
    null,
    'demo@cbta241.local',
    null,
    'America/Mexico_City',
    null,
    null
  )$$,
  'real institution settings change succeeds'
);

select results_eq(
  $$select count(*)::bigint from public.audit_logs where actor_id='13000000-0000-0000-0000-000000000001' and action='INSTITUTION_SETTINGS_UPDATED'$$,
  $$values (1::bigint)$$,
  'real institution settings change is audited exactly once'
);

select lives_ok(
  $$select public.update_institution_settings_workflow(
    'CENTRO DE BACHILLERATO TECNOLÓGICO AGROPECUARIO No. 241',
    'CBTA 241',
    'DEMO-CBTA241-IDEM',
    null,
    null,
    'demo@cbta241.local',
    null,
    'America/Mexico_City',
    null,
    null
  )$$,
  'repeating the same changed values succeeds as a no-op'
);

select results_eq(
  $$select count(*)::bigint from public.audit_logs where actor_id='13000000-0000-0000-0000-000000000001' and action='INSTITUTION_SETTINGS_UPDATED'$$,
  $$values (1::bigint)$$,
  'repeated identical settings do not create a second audit event'
);

reset role;
select * from finish();
rollback;
