import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !service) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}
if (!process.env.ALLOW_DEMO_USERS) {
  throw new Error('Set ALLOW_DEMO_USERS=true explicitly.');
}
if (!/localhost|127\.0\.0\.1/.test(url) && process.env.ALLOW_DEMO_USERS !== 'I_UNDERSTAND_NONPROD') {
  throw new Error('Demo provisioning is restricted to local Supabase by default.');
}

const strongPassword = () => `${randomBytes(18).toString('base64url')}!aA7`;
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const users = [
  {
    email: 'alumno.demo@cbta241.local',
    password: process.env.DEMO_STUDENT_PASSWORD || strongPassword(),
    name: 'Alumno Demo 01',
    role: 'ALUMNO',
    link: 'student',
  },
  {
    email: 'docente.demo@cbta241.local',
    password: process.env.DEMO_TEACHER_PASSWORD || strongPassword(),
    name: 'Laura Martínez Demo',
    role: 'DOCENTE',
    link: 'teacher',
  },
  {
    email: 'control.demo@cbta241.local',
    password: process.env.DEMO_CONTROL_PASSWORD || strongPassword(),
    name: 'Control Escolar Demo',
    role: 'CONTROL_ESCOLAR',
  },
  {
    email: 'admin.demo@cbta241.local',
    password: process.env.DEMO_SUPERADMIN_PASSWORD || strongPassword(),
    name: 'Superadmin Demo',
    role: 'SUPERADMIN',
  },
];

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { display_name: u.name },
  });
  if (error && !/already/i.test(error.message)) throw error;

  let id = data?.user?.id;
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    id = list.users.find((x) => x.email === u.email)?.id;
  }
  if (!id) throw new Error(`Cannot resolve ${u.email}`);

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id, display_name: u.name, email: u.email, is_active: true });
  if (profileError) throw profileError;

  const { error: roleError } = await admin.from('user_roles').upsert({ user_id: id, role: u.role });
  if (roleError) throw roleError;

  if (u.link === 'student') {
    const { data: st, error: studentError } = await admin
      .from('students')
      .select('id')
      .eq('enrollment_number', '2410001')
      .single();
    if (studentError) throw studentError;
    const { error: linkError } = await admin.from('students').update({ profile_id: id }).eq('id', st.id);
    if (linkError) throw linkError;
  }

  if (u.link === 'teacher') {
    const { data: teacher, error: teacherError } = await admin
      .from('teachers')
      .select('id')
      .eq('employee_number', 'D001')
      .single();
    if (teacherError) throw teacherError;
    const { error: linkError } = await admin.from('teachers').update({ profile_id: id }).eq('id', teacher.id);
    if (linkError) throw linkError;
  }

  // Deliberately printed once for local/non-production demo setup. No password is persisted in source control.
  console.log(`${u.role}: ${u.email} | password: ${u.password}`);
}

console.log('Demo users provisioned. Generated credentials are for isolated demo/testing only; rotate or delete them afterwards.');
