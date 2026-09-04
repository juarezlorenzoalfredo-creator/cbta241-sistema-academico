export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/errors/server';

const schema = z.object({ assignmentId: z.uuid() });

type Assignment = {
  id: string;
  subjects: { name: string } | null;
  groups: { name: string } | null;
  academic_periods: { label: string } | null;
};

type GradeRow = {
  kind: 'NUMERIC' | 'NP' | 'PENDING';
  numeric_grade: number | string | null;
  state: 'DRAFT' | 'PUBLISHED';
  published_at: string | null;
  updated_at: string;
  evaluation_periods: { partial_number: number } | null;
  student_subject_enrollments: {
    enrollments: { students: { enrollment_number: string; full_name: string } | null } | null;
  } | null;
};

type HistoryRow = {
  old_kind: 'NUMERIC' | 'NP' | 'PENDING' | null;
  old_numeric_grade: number | string | null;
  new_kind: 'NUMERIC' | 'NP' | 'PENDING';
  new_numeric_grade: number | string | null;
  operation: string;
  reason: string | null;
  actor_role: string;
  changed_at: string;
  grades: {
    evaluation_periods: { partial_number: number } | null;
    student_subject_enrollments: {
      enrollments: { students: { enrollment_number: string; full_name: string } | null } | null;
    } | null;
  } | null;
};

function displayValue(kind: GradeRow['kind'] | null, numeric: number | string | null): string {
  if (kind === 'NP') return 'NP';
  if (kind === 'PENDING' || kind === null) return 'PENDIENTE';
  return numeric === null ? '' : Number(numeric).toFixed(1);
}

function styleHeader(row: import('exceljs').Row) {
  row.font = { bold: true };
  row.alignment = { vertical: 'middle' };
}

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!auth.roles.includes('DOCENTE')) return NextResponse.json({ error: 'TEACHER_ROLE_REQUIRED' }, { status: 403 });

  const parsed = schema.safeParse({ assignmentId: new URL(request.url).searchParams.get('assignmentId') });
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_ASSIGNMENT' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: rawAssignment } = await supabase
    .from('teacher_assignments')
    .select('id,subjects(name),groups(name),academic_periods(label)')
    .eq('id', parsed.data.assignmentId)
    .eq('is_active', true)
    .maybeSingle();
  if (!rawAssignment) return NextResponse.json({ error: 'NOT_FOUND_OR_FORBIDDEN' }, { status: 404 });
  const assignment = rawAssignment as unknown as Assignment;

  const [{ data: rawGrades, error: gradesError }, { data: rawHistory, error: historyError }] = await Promise.all([
    supabase
      .from('grades')
      .select('kind,numeric_grade,state,published_at,updated_at,evaluation_periods(partial_number),student_subject_enrollments(enrollments(students(enrollment_number,full_name)))')
      .eq('assignment_id', parsed.data.assignmentId)
      .order('created_at'),
    supabase
      .from('grade_change_history')
      .select('old_kind,old_numeric_grade,new_kind,new_numeric_grade,operation,reason,actor_role,changed_at,grades!inner(assignment_id,evaluation_periods(partial_number),student_subject_enrollments(enrollments(students(enrollment_number,full_name))))')
      .eq('grades.assignment_id', parsed.data.assignmentId)
      .order('changed_at', { ascending: false })
  ]);
  if (gradesError || historyError) return NextResponse.json(apiFailure('No fue posible generar el reporte.','REPORT_QUERY_FAILED',gradesError ?? historyError), { status: 500 });

  const grades = (rawGrades ?? []) as unknown as GradeRow[];
  const history = (rawHistory ?? []) as unknown as HistoryRow[];
  const workbook = new Workbook();
  workbook.creator = 'Sistema Académico Digital CBTA 241';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Calificaciones', { views: [{ state: 'frozen', ySplit: 5 }] });
  sheet.addRow(['CENTRO DE BACHILLERATO TECNOLÓGICO AGROPECUARIO No. 241']);
  sheet.addRow([`Materia: ${assignment.subjects?.name ?? '—'}`]);
  sheet.addRow([`Grupo: ${assignment.groups?.name ?? '—'} · Periodo: ${assignment.academic_periods?.label ?? '—'}`]);
  sheet.addRow(['Los registros en BORRADOR se identifican expresamente y no son visibles para alumnos.']);
  const header = sheet.addRow(['Matrícula', 'Alumno', 'Parcial', 'Calificación', 'Estado', 'Publicado', 'Última actualización']);
  styleHeader(header);
  for (const row of grades) {
    const student = row.student_subject_enrollments?.enrollments?.students;
    sheet.addRow([
      student?.enrollment_number ?? '',
      student?.full_name ?? '',
      row.evaluation_periods?.partial_number ?? '',
      displayValue(row.kind, row.numeric_grade),
      row.state === 'DRAFT' ? 'BORRADOR' : 'PUBLICADO',
      row.published_at ? new Date(row.published_at) : '',
      new Date(row.updated_at)
    ]);
  }
  sheet.columns = [
    { width: 18 }, { width: 38 }, { width: 11 }, { width: 15 }, { width: 15 }, { width: 22 }, { width: 22 }
  ];
  sheet.getColumn(6).numFmt = 'dd/mm/yyyy hh:mm';
  sheet.getColumn(7).numFmt = 'dd/mm/yyyy hh:mm';

  const historySheet = workbook.addWorksheet('Historial de cambios', { views: [{ state: 'frozen', ySplit: 2 }] });
  historySheet.addRow(['Historial auditable de cambios — asignación docente']);
  const historyHeader = historySheet.addRow(['Matrícula', 'Alumno', 'Parcial', 'Valor anterior', 'Valor nuevo', 'Operación', 'Rol actor', 'Motivo', 'Fecha servidor']);
  styleHeader(historyHeader);
  for (const row of history) {
    const student = row.grades?.student_subject_enrollments?.enrollments?.students;
    historySheet.addRow([
      student?.enrollment_number ?? '',
      student?.full_name ?? '',
      row.grades?.evaluation_periods?.partial_number ?? '',
      displayValue(row.old_kind, row.old_numeric_grade),
      displayValue(row.new_kind, row.new_numeric_grade),
      row.operation,
      row.actor_role,
      row.reason ?? '',
      new Date(row.changed_at)
    ]);
  }
  historySheet.columns = [
    { width: 18 }, { width: 38 }, { width: 11 }, { width: 16 }, { width: 16 }, { width: 24 }, { width: 18 }, { width: 45 }, { width: 22 }
  ];
  historySheet.getColumn(9).numFmt = 'dd/mm/yyyy hh:mm';

  const bytes = await workbook.xlsx.writeBuffer();
  const body = new Uint8Array(bytes);
  return new NextResponse(body, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="cbta241-calificaciones-${parsed.data.assignmentId.slice(0, 8)}.xlsx"`,
      'cache-control': 'private, no-store'
    }
  });
}
