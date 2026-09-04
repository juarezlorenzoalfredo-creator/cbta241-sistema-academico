'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, type AppRole } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { failAction } from '@/lib/errors/server';

const ACCOUNT_ROLES: AppRole[] = ['SUPERADMIN','CONTROL_ESCOLAR','DOCENTE','ALUMNO'];
const IMAGE_MIME = new Map([['image/png','png'],['image/jpeg','jpg'],['image/webp','webp']]);

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

async function superadminClients() {
  await requireAuth(['SUPERADMIN']);
  return { session: await createSupabaseServerClient(), admin: createSupabaseAdminClient() };
}

export async function createAccountAction(form: FormData) {
  const { session, admin } = await superadminClients();
  const email = field(form,'email').toLowerCase();
  const displayName = field(form,'display_name');
  const password = field(form,'password');
  const role = field(form,'role') as AppRole;
  const studentId = field(form,'student_id') || null;
  const teacherId = field(form,'teacher_id') || null;
  if (!ACCOUNT_ROLES.includes(role)) throw new Error('INVALID_ROLE');
  if (!email.includes('@') || displayName.length < 2 || password.length < 12) throw new Error('INVALID_ACCOUNT_DATA');
  if (role === 'ALUMNO' && !studentId) throw new Error('STUDENT_LINK_REQUIRED');
  if (role === 'DOCENTE' && !teacherId) throw new Error('TEACHER_LINK_REQUIRED');

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName }
  });
  if (error || !data.user) failAction('AUTH_CREATE_FAILED',error);

  const { error: profileError } = await session.rpc('provision_user_profile_workflow', {
    p_user_id: data.user.id,
    p_email: email,
    p_display_name: displayName,
    p_role: role,
    p_student_id: role === 'ALUMNO' ? studentId : null,
    p_teacher_id: role === 'DOCENTE' ? teacherId : null
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    failAction('PROFILE_PROVISION_FAILED',profileError);
  }
  revalidatePath('/admin/usuarios');
}

export async function toggleAccountAction(form: FormData) {
  const { session, admin } = await superadminClients();
  const userId = field(form,'user_id');
  const active = field(form,'active') === 'true';
  const reason = field(form,'reason');
  if (reason.length < 5) throw new Error('REASON_REQUIRED');

  const { error } = await session.rpc('set_user_active_workflow',{p_user_id:userId,p_active:active,p_reason:reason});
  if (error) failAction('PROFILE_STATUS_FAILED',error);

  const { error: authError } = await admin.auth.admin.updateUserById(userId,{ban_duration: active ? 'none' : '876000h'});
  if (authError) {
    await session.rpc('set_user_active_workflow',{p_user_id:userId,p_active:!active,p_reason:'Reversión automática por fallo de Auth'});
    failAction('AUTH_STATUS_FAILED',authError);
  }
  revalidatePath('/admin/usuarios');
}

export async function replaceRoleAction(form: FormData) {
  const { session } = await superadminClients();
  const role = field(form,'role') as AppRole;
  if (!ACCOUNT_ROLES.includes(role)) throw new Error('INVALID_ROLE');
  const { error } = await session.rpc('replace_user_role_workflow',{
    p_user_id: field(form,'user_id'), p_role: role, p_reason: field(form,'reason')
  });
  if (error) failAction('ROLE_CHANGE_FAILED',error);
  revalidatePath('/admin/usuarios');
}

export async function sendRecoveryAction(form: FormData) {
  await requireAuth(['SUPERADMIN']);
  const session = await createSupabaseServerClient();
  const email = field(form,'email');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { error } = await session.auth.resetPasswordForEmail(email,{redirectTo:`${appUrl}/actualizar-contrasena`});
  if (error) failAction('RECOVERY_FAILED',error);
}

async function uploadPrivateImage(session: Awaited<ReturnType<typeof createSupabaseServerClient>>, file: File, label: string) {
  if (file.size === 0) return null;
  const extension = IMAGE_MIME.get(file.type);
  if (!extension || file.size > 5 * 1024 * 1024) throw new Error(`${label.toUpperCase()}_INVALID_FILE`);
  const path = `official/${label}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await session.storage.from('institution-private').upload(path,bytes,{contentType:file.type,upsert:false});
  if (error) failAction(`${label.toUpperCase()}_UPLOAD_FAILED`,error);
  return path;
}

export async function updateInstitutionAction(form: FormData) {
  await requireAuth(['SUPERADMIN']);
  const session = await createSupabaseServerClient();
  const signature = form.get('signature');
  const seal = form.get('seal');
  let signaturePath: string | null = null;
  let sealPath: string | null = null;
  try {
    if (signature instanceof File) signaturePath = await uploadPrivateImage(session,signature,'director-signature');
    if (seal instanceof File) sealPath = await uploadPrivateImage(session,seal,'institutional-seal');
    const { error } = await session.rpc('update_institution_settings_workflow',{
      p_official_name: field(form,'official_name'),
      p_short_name: field(form,'short_name'),
      p_school_key: field(form,'school_key'),
      p_address: field(form,'address'),
      p_phone: field(form,'phone'),
      p_email: field(form,'email'),
      p_director_name: field(form,'director_name'),
      p_timezone: field(form,'timezone') || 'America/Mexico_City',
      p_signature_path: signaturePath,
      p_seal_path: sealPath
    });
    if (error) failAction('INSTITUTION_UPDATE_FAILED',error);
  } catch (error) {
    const cleanup = [signaturePath,sealPath].filter((x):x is string => Boolean(x));
    if (cleanup.length) await session.storage.from('institution-private').remove(cleanup);
    throw error;
  }
  revalidatePath('/admin');
  revalidatePath('/admin/configuracion');
  revalidatePath('/control/documentos');
}
