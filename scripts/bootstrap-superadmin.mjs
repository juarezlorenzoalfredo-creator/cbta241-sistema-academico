import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.BOOTSTRAP_SUPERADMIN_EMAIL || '').trim().toLowerCase();
const displayName = (process.env.BOOTSTRAP_SUPERADMIN_NAME || '').trim();
const suppliedPassword = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;

if (!url || !service) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
if (!email || !email.includes('@')) throw new Error('Set BOOTSTRAP_SUPERADMIN_EMAIL');
if (displayName.length < 2) throw new Error('Set BOOTSTRAP_SUPERADMIN_NAME');

const generated = !suppliedPassword;
const password = suppliedPassword || `${randomBytes(24).toString('base64url')}!Aa7`;
if (password.length < 16) throw new Error('Bootstrap password must be at least 16 characters');

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { count, error: countError } = await admin
  .from('user_roles')
  .select('*', { count: 'exact', head: true })
  .eq('role', 'SUPERADMIN');
if (countError) throw countError;
if ((count ?? 0) > 0) throw new Error('A SUPERADMIN already exists. Bootstrap is permanently disabled.');

let createdUserId = null;
try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw error || new Error('AUTH_CREATE_FAILED');
  createdUserId = data.user.id;

  const { error: bootstrapError } = await admin.rpc('bootstrap_first_superadmin', {
    p_user_id: createdUserId,
    p_email: email,
    p_display_name: displayName,
  });
  if (bootstrapError) throw bootstrapError;

  console.log(`SUPERADMIN bootstrap completed for ${email}.`);
  if (generated) {
    console.log(`One-time generated password: ${password}`);
    console.log('Store it securely and change it immediately after first login.');
  }
} catch (error) {
  if (createdUserId) {
    try {
      await admin.auth.admin.deleteUser(createdUserId);
    } catch {
      console.error('WARNING: failed to remove Auth user after bootstrap failure. Review Auth users manually.');
    }
  }
  throw error;
}
