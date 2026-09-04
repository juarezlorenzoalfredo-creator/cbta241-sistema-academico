'use server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { failAction } from '@/lib/errors/server';
function t(f:FormData,k:string){return String(f.get(k)??'').trim()}
function parseGrade(raw:string){const u=raw.toUpperCase();if(u==='NP')return{kind:'NP',numeric:null};const n=Number(raw.replace(',','.'));if(!Number.isFinite(n)||n<0||n>10||Math.round(n*10)!==n*10)throw new Error('INVALID_GRADE');return{kind:'NUMERIC',numeric:n}}
export async function correctPublishedGradeAction(form:FormData){await requireAuth(['DOCENTE']);const s=await createSupabaseServerClient();const g=parseGrade(t(form,'grade'));const {error}=await s.rpc('correct_published_grade',{p_grade_id:t(form,'grade_id'),p_kind:g.kind,p_numeric_grade:g.numeric,p_reason:t(form,'reason')||null,p_expected_version:Number(t(form,'version'))});if(error)failAction('CORRECTION_FAILED',error);revalidatePath('/docente/correcciones');}
export async function requestCorrectionAction(form:FormData){await requireAuth(['DOCENTE']);const s=await createSupabaseServerClient();const g=parseGrade(t(form,'grade'));const reason=t(form,'reason');const {error}=await s.rpc('request_grade_correction',{p_grade_id:t(form,'grade_id'),p_kind:g.kind,p_numeric_grade:g.numeric,p_reason:reason});if(error)failAction('REQUEST_FAILED',error);revalidatePath('/docente/correcciones');revalidatePath('/docente/solicitudes');}
export async function captureExtraordinaryTeacherAction(form:FormData){await requireAuth(['DOCENTE']);const s=await createSupabaseServerClient();const grade=Number(t(form,'grade').replace(',','.'));const {error}=await s.rpc('capture_extraordinary',{p_extra_id:t(form,'extra_id'),p_grade:grade,p_expected_version:Number(t(form,'version'))});if(error)failAction('EXTRA_CAPTURE_FAILED',error);revalidatePath('/docente/extraordinarios');}
