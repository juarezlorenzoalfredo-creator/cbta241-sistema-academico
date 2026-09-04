import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AppRole = 'SUPERADMIN' | 'CONTROL_ESCOLAR' | 'DOCENTE' | 'ALUMNO';

type RoleRow = { role: AppRole };

export type AuthContext = {
  userId: string;
  email: string | null;
  displayName: string;
  roles: AppRole[];
};

export async function getAuthContext(): Promise<AuthContext | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;
  const user = authData.user;
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from('profiles').select('display_name,is_active').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id)
  ]);
  if (!profile?.is_active) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? user.email ?? 'Usuario',
    roles: ((roleRows ?? []) as RoleRow[]).map((row) => row.role)
  };
}

export async function requireAuth(allowed?: AppRole[]): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect('/login');
  if (allowed && !context.roles.some((role) => allowed.includes(role))) redirect('/sin-acceso');
  return context;
}

export function homeForRoles(roles: AppRole[]): string {
  // Keep this precedence aligned with current_primary_role() in PostgreSQL.
  if (roles.includes('SUPERADMIN')) return '/admin';
  if (roles.includes('CONTROL_ESCOLAR')) return '/control';
  if (roles.includes('DOCENTE')) return '/docente';
  if (roles.includes('ALUMNO')) return '/alumno';
  return '/sin-acceso';
}
