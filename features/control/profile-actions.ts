'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export async function updateOwnProfileAction(form:FormData){const c=await requireAuth();const name=String(form.get('display_name')??'').trim();if(name.length<2)throw new Error('INVALID_DISPLAY_NAME');const s=await createSupabaseServerClient();const {error}=await s.from('profiles').update({display_name:name}).eq('id',c.userId);if(error)throw new Error('PROFILE_UPDATE_FAILED');revalidatePath('/alumno/perfil');}
export async function markNotificationReadAction(form:FormData){const c=await requireAuth();const id=String(form.get('id')??'');const s=await createSupabaseServerClient();const {error}=await s.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',c.userId);if(error)throw new Error('NOTIFICATION_UPDATE_FAILED');revalidatePath('/alumno/notificaciones');}
