'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { homeForRoles, type AppRole } from '@/lib/auth/session';
import { logSecurityEvent } from '@/lib/observability/security-events';

async function writeSessionAudit(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, action: 'LOGIN' | 'LOGOUT') {
  const { error } = await supabase.rpc('log_session_event', { p_action: action });
  if (error) logSecurityEvent('SESSION_AUDIT_WRITE_FAILED', { action });
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect('/login?error=Completa%20correo%20y%20contrase%C3%B1a');

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // Intentionally do not log the supplied email/password. Failed authentication
    // remains observable without turning logs into a credential/PII sink.
    logSecurityEvent('LOGIN_FAILED', { provider: 'password' });
    redirect('/login?error=Credenciales%20incorrectas');
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('is_active').eq('id', data.user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', data.user.id)
  ]);
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    redirect('/login?error=Cuenta%20inactiva.%20Contacta%20a%20la%20administraci%C3%B3n');
  }

  await writeSessionAudit(supabase, 'LOGIN');
  redirect(homeForRoles(((roles ?? []) as { role: AppRole }[]).map((item) => item.role)));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await writeSessionAudit(supabase, 'LOGOUT');
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) redirect('/recuperar?error=Ingresa%20tu%20correo');
  const supabase = await createSupabaseServerClient();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${base}/actualizar-contrasena` });
  // Always return the same UI outcome to reduce account enumeration.
  redirect('/recuperar?sent=1');
}
