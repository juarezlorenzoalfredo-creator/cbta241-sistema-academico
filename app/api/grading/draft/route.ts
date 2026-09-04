import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { gradeInputSchema } from '@/validation/grade';

const schema = z.object({
  studentSubjectEnrollmentId: z.uuid(),
  evaluationPeriodId: z.uuid(),
  grade: gradeInputSchema,
  expectedVersion: z.number().int().nonnegative().nullable().optional()
});

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!auth.roles.some((role) => role === 'DOCENTE' || role === 'CONTROL_ESCOLAR')) {
    return NextResponse.json({ error: 'GRADING_ROLE_REQUIRED' }, { status: 403 });
  }

  try {
    const payload = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const numeric = payload.grade.kind === 'NUMERIC' ? payload.grade.value : null;
    const { data, error } = await supabase.rpc('save_grade_draft', {
      p_student_subject_enrollment_id: payload.studentSubjectEnrollmentId,
      p_evaluation_period_id: payload.evaluationPeriodId,
      p_kind: payload.grade.kind,
      p_numeric_grade: numeric,
      p_expected_version: payload.expectedVersion ?? null
    });
    if (error) {
      return NextResponse.json(
        { error: 'No fue posible guardar la calificación.', code: error.code },
        { status: error.code === '40001' ? 409 : error.code === '42501' ? 403 : 400 }
      );
    }
    return NextResponse.json({ grade: data });
  } catch {
    return NextResponse.json({ error: 'Datos de calificación inválidos.' }, { status: 400 });
  }
}
