import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  assignmentId: z.uuid(),
  evaluationPeriodId: z.uuid(),
  idempotencyKey: z.string().min(16).max(128)
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
    const { data, error } = await supabase.rpc('publish_assignment_grades', {
      p_assignment_id: payload.assignmentId,
      p_evaluation_period_id: payload.evaluationPeriodId,
      p_idempotency_key: payload.idempotencyKey
    });
    if (error) {
      return NextResponse.json(
        { error: 'La publicación fue rechazada. Verifica pendientes, periodo y permisos.', code: error.code },
        { status: error.code === '42501' ? 403 : error.code === '40001' ? 409 : 400 }
      );
    }
    return NextResponse.json({ publication: data });
  } catch {
    return NextResponse.json({ error: 'Solicitud de publicación inválida.' }, { status: 400 });
  }
}
