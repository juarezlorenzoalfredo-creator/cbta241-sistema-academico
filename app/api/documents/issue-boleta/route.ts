export const runtime = 'nodejs';

import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateBoletaPdf } from '@/features/documents/boleta';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/errors/server';

const schema = z.object({
  studentId: z.uuid(),
  periodId: z.uuid(),
  replacementReason: z.string().trim().max(500).optional()
});

type GradeOverview = {
  subject_name: string;
  p1: string | null;
  p2: string | null;
  p3: string | null;
  published_average: number | string | null;
  published_partial_count: number | string;
  extraordinary_grade: number | string | null;
};

type RelationLabel = { label?: string } | null;
type RelationName = { name?: string } | null;
type ExistingDocument = {
  id: string;
  folio: string;
  current_version: number;
  state: 'VIGENTE' | 'SUSTITUIDO' | 'REVOCADO';
};

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!auth.roles.some((role) => role === 'CONTROL_ESCOLAR' || role === 'SUPERADMIN')) {
    return NextResponse.json({ error: 'CONTROL_ROLE_REQUIRED' }, { status: 403 });
  }

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: student },
    { data: period },
    { data: enrollment },
    { data: settings },
    { data: rowsRaw },
    { data: existingRaw }
  ] = await Promise.all([
    supabase.from('students').select('id,full_name,enrollment_number').eq('id', payload.studentId).maybeSingle(),
    supabase.from('academic_periods').select('id,label,is_closed,start_year').eq('id', payload.periodId).maybeSingle(),
    supabase.from('enrollments').select('id,semesters(label),groups(name)').eq('student_id', payload.studentId).eq('academic_period_id', payload.periodId).maybeSingle(),
    supabase.from('institution_settings').select('*').eq('singleton_key', 'CBTA241').maybeSingle(),
    supabase.from('student_grade_overview').select('*').eq('student_id', payload.studentId).eq('academic_period_id', payload.periodId).order('subject_name'),
    supabase.from('academic_documents').select('id,folio,current_version,state').eq('student_id', payload.studentId).eq('academic_period_id', payload.periodId).eq('type', 'BOLETA_SEMESTRAL').eq('scope_key', 'SEMESTER').maybeSingle()
  ]);

  if (!student || !period || !enrollment || !settings) {
    return NextResponse.json({ error: 'ACADEMIC_DATA_INCOMPLETE' }, { status: 404 });
  }
  if (!period.is_closed) {
    return NextResponse.json({ error: 'PERIOD_MUST_BE_CLOSED_BEFORE_OFFICIAL_BOLETA' }, { status: 409 });
  }
  if (!settings.director_name || !settings.director_signature_storage_path || !settings.institutional_seal_storage_path) {
    return NextResponse.json({ error: 'OFFICIAL_SIGNATURE_OR_SEAL_NOT_CONFIGURED' }, { status: 409 });
  }

  const rows = (rowsRaw ?? []) as unknown as GradeOverview[];
  if (rows.length === 0 || rows.some((row) => Number(row.published_partial_count) !== 3)) {
    return NextResponse.json({ error: 'INCOMPLETE_ORDINARY_RESULTS' }, { status: 409 });
  }

  const existing = existingRaw as unknown as ExistingDocument | null;
  if (existing?.state === 'REVOCADO') {
    return NextResponse.json({ error: 'REVOKED_DOCUMENT_REQUIRES_ADMINISTRATIVE_REVIEW' }, { status: 409 });
  }
  const replacing = Boolean(existing);
  const reason = payload.replacementReason?.trim() ?? '';
  if (replacing && reason.length < 5) {
    return NextResponse.json({ error: 'REPLACEMENT_REASON_REQUIRED' }, { status: 409 });
  }

  const [signatureResult, sealResult, logoBytes] = await Promise.all([
    supabase.storage.from('institution-private').download(settings.director_signature_storage_path),
    supabase.storage.from('institution-private').download(settings.institutional_seal_storage_path),
    readFile(path.join(process.cwd(), 'public', 'institution', 'cbta241-logo.png'))
  ]);

  if (signatureResult.error || sealResult.error || !signatureResult.data || !sealResult.data) {
    return NextResponse.json({ error: 'OFFICIAL_ASSET_READ_FAILED' }, { status: 500 });
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const version = existing ? existing.current_version + 1 : 1;
  const stamp = Date.now().toString(36).toUpperCase();
  const folio = existing?.folio ?? `CBTA241-BOL-${period.start_year}-${student.enrollment_number}-${stamp}`;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const semesters = enrollment.semesters as unknown as RelationLabel;
  const groups = enrollment.groups as unknown as RelationName;

  const pdf = await generateBoletaPdf(
    {
      institutionName: settings.official_name,
      studentName: student.full_name,
      enrollmentNumber: student.enrollment_number,
      periodLabel: period.label,
      semesterLabel: semesters?.label ?? '',
      groupName: groups?.name ?? '',
      folio,
      issuedAt: new Date(),
      version,
      verificationUrl: `${base}/verificar/${token}`,
      rows: rows.map((row) => {
        const average = Number(row.published_average);
        const extraordinary = row.extraordinary_grade !== null ? Number(row.extraordinary_grade) : null;
        return {
          subject: row.subject_name,
          p1: row.p1 ?? '—',
          p2: row.p2 ?? '—',
          p3: row.p3 ?? '—',
          ordinary: average.toFixed(1),
          extraordinary: extraordinary === null ? '—' : extraordinary.toFixed(1),
          status: average >= 6 ? 'APROBADA' : extraordinary !== null && extraordinary >= 6 ? 'ACREDITADA EXTRA' : 'NO ACREDITADA'
        };
      })
    },
    {
      logo: new Uint8Array(logoBytes),
      signature: new Uint8Array(await signatureResult.data.arrayBuffer()),
      seal: new Uint8Array(await sealResult.data.arrayBuffer()),
      signatureMime: signatureResult.data.type,
      sealMime: sealResult.data.type,
      directorName: settings.director_name
    }
  );

  const sha256 = createHash('sha256').update(pdf).digest('hex');
  const storagePath = `boletas/${payload.periodId}/${payload.studentId}/${folio}-v${version}.pdf`;
  const upload = await supabase.storage.from('academic-documents').upload(storagePath, pdf, {
    contentType: 'application/pdf',
    upsert: false
  });
  if (upload.error) {
    return NextResponse.json(apiFailure('No fue posible guardar el PDF oficial.', 'PDF_STORAGE_FAILED', upload.error), { status: 500 });
  }

  const rpcResult = replacing
    ? await supabase.rpc('supersede_academic_document', {
        p_document_id: existing!.id,
        p_storage_path: storagePath,
        p_sha256: sha256,
        p_token_hash: tokenHash,
        p_reason: reason
      })
    : await supabase.rpc('register_academic_document', {
        p_student_id: payload.studentId,
        p_period_id: payload.periodId,
        p_type: 'BOLETA_SEMESTRAL',
        p_scope_key: 'SEMESTER',
        p_folio: folio,
        p_token_hash: tokenHash,
        p_storage_path: storagePath,
        p_sha256: sha256
      });

  if (rpcResult.error) {
    await supabase.storage.from('academic-documents').remove([storagePath]);
    return NextResponse.json(apiFailure('No fue posible registrar el documento oficial.', 'DOCUMENT_REGISTRATION_FAILED', rpcResult.error), { status: 500 });
  }

  const document = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
  return NextResponse.json({ documentId: document?.id, folio, version, replaced: replacing });
}
