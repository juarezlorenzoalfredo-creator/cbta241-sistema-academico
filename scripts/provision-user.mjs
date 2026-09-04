import { createClient } from '@supabase/supabase-js';
const [,,email,password,role,displayName,...rest]=process.argv;
if(!email||!password||!role||!displayName) throw new Error('Usage: node scripts/provision-user.mjs <email> <password> <ROLE> <display name> [student:MATRICULA|teacher:EMPLOYEE]');
if(!['SUPERADMIN','CONTROL_ESCOLAR','DOCENTE','ALUMNO'].includes(role)) throw new Error('Invalid role');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!service) throw new Error('Missing server environment');
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName}}); if(error) throw error;
const id=data.user.id; await admin.from('profiles').insert({id,display_name:displayName,email,is_active:true}); await admin.from('user_roles').insert({user_id:id,role});
const link=rest.join(' ');
if(link.startsWith('student:')){const enrollment=link.slice(8);const {error:e}=await admin.from('students').update({profile_id:id}).eq('enrollment_number',enrollment);if(e)throw e;}
if(link.startsWith('teacher:')){const employee=link.slice(8);const {error:e}=await admin.from('teachers').update({profile_id:id}).eq('employee_number',employee);if(e)throw e;}
console.log(`Created ${role} ${email} (${id})`);
