import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
const root=new URL('..',import.meta.url).pathname;
function walk(d){return readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);}
const files=walk(root).filter(f=>!f.includes('/node_modules/')&&!f.includes('/.verified/')&&!f.endsWith('.png')&&!f.endsWith('/scripts/security-audit.mjs'));
const text=Object.fromEntries(files.map(f=>[f,readFileSync(f,'utf8')]));
const findings=[];

const authSession = text[join(root,'lib/auth/session.ts')] ?? '';
if(!/select\('display_name,is_active'\)/.test(authSession)||!/if \(!profile\?\.is_active\) return null/.test(authSession)) findings.push(['HIGH','lib/auth/session.ts','Inactive profiles are not blocked at application boundary']);
for(const [file,body] of Object.entries(text)){
  if(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/i.test(body)) findings.push(['CRITICAL',file,'Service role exposed as NEXT_PUBLIC']);
  if(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\n#\s][^\n]*/.test(body) && !file.endsWith('.env.example')) findings.push(['CRITICAL',file,'Possible committed service role secret']);
  if(/\.(?:tsx?|jsx?)$/.test(file) && /dangerouslySetInnerHTML/.test(body)) findings.push(['MEDIUM',file,'Review raw HTML usage']);
  if(/(?:Alumno|Docente|Control|Admin)Demo!20\d{2}/.test(body)) findings.push(['HIGH',file,'Predictable demo credential committed in source']);
}
const migration=Object.values(text).filter((_,i)=>Object.keys(text)[i].includes('/supabase/migrations/')).join('\n');
const hasGenericRlsLoop=/alter table public\.%I enable row level security/i.test(migration);
for(const table of ['grades','enrollments','teacher_assignments','student_subject_enrollments','academic_documents','audit_logs']){
  const explicit=new RegExp(`alter table public\\.${table} enable row level security`,'i').test(migration);
  const listed=new RegExp(`['\"]${table}['\"]`,'i').test(migration);
  if(!(explicit||(hasGenericRlsLoop&&listed))) findings.push(['CRITICAL',table,'RLS enable not found']);
}
if(!/revoke execute on all functions in schema public from public/i.test(migration)) findings.push(['HIGH','SQL','Default PUBLIC function execute not revoked']);
if(!/revoke all on all tables in schema public from anon/i.test(migration)) findings.push(['HIGH','SQL','Anon table access not explicitly revoked']);
if(!/DIRECT_CORRECTION_WINDOW_EXPIRED/.test(migration)||!/interval '72 hours'/.test(migration)) findings.push(['HIGH','SQL','72-hour correction enforcement missing']);
if(!/unique\s+references public\.student_subject_enrollments/i.test(migration)&&!/student_subject_enrollment_id uuid not null unique/i.test(migration)) findings.push(['HIGH','SQL','Unique extraordinary opportunity not obvious']);
if(!/bootstrap_first_superadmin[\s\S]*SERVICE_ROLE_REQUIRED[\s\S]*revoke execute on function public\.bootstrap_first_superadmin\(uuid,text,text\) from public,anon,authenticated/i.test(migration)) findings.push(['HIGH','SQL','First Superadmin bootstrap is not demonstrably service-role only']);
if(!/CANNOT_DISABLE_LAST_ACTIVE_SUPERADMIN/.test(migration)||!/CANNOT_REMOVE_LAST_ACTIVE_SUPERADMIN/.test(migration)) findings.push(['HIGH','SQL','Active Superadmin continuity guard missing']);
if(!/current_student_id[\s\S]*join public\.profiles p on p\.id=s\.profile_id and p\.is_active/i.test(migration)||!/current_teacher_id[\s\S]*join public\.profiles p on p\.id=t\.profile_id and p\.is_active/i.test(migration)) findings.push(['CRITICAL','SQL','Inactive profile may retain academic RLS identity through a still-valid JWT']);
console.log('SECURITY AUDIT');
if(findings.length){console.table(findings.map(([severity,file,message])=>({severity,file,message})));if(findings.some(f=>['CRITICAL','HIGH'].includes(f[0])))process.exit(1);}else console.log('PASS: no critical/high static findings.');
