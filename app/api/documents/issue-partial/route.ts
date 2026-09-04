export const runtime = 'nodejs';

import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePartialReportPdf } from '@/features/documents/reporteParcial';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/errors/server';

const schema = z.object({
  studentId: z.uuid(),
  periodId: z.uuid(),
  partial: z.number().int().min(1).max(3),
  replacementReason: z.string().trim().max(500).optional()
});

type Overview = { subject_name: string; p1: string | null; p2: string | null; p3: string | null };
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

  const scopeKey = `P${payload.partial}`;
  const supabase = await createSupabaseServerClient();
  const [
    { data: student },
    { data: period },
    { data: enrollment },
    { data: settings },
    { data: evaluationPeriod },
    { data: overviewRaw },
    { data: existingRaw }
  ] = await Promise.all([
    supabase.from('students').select('id,full_name,enrollment_number').eq('id', payload.studentId).maybeSingle(),
    supabase.from('academic_periods').select('id,label,start_year').eq('id', payload.periodId).maybeSingle(),
    supabase.from('enrollments').select('id,semesters(label),groups(name)').eq('student_id', payload.studentId).eq('academic_period_id', payload.periodId).maybeSingle(),
    supabase.from('institution_settings').select('*').eq('singleton_key', 'CBTA241').maybeSingle(),
    supabase.from('evaluation_periods').select('id,state').eq('academic_period_id', payload.periodId).eq('partial_number', payload.partial).maybeSingle(),
    supabase.from('student_grade_overview').select('subject_name,p1,p2,p3').eq('student_id', payload.studentId).eq('academic_period_id', payload.periodId).order('subject_name'),
    supabase.from('academic_documents').select('id,folio,current_version,state').eq('student_id', payload.studentId).eq('academic_period_id', payload.periodId).eq('type', 'REPORTE_PARCIAL').eq('scope_key', scopeKey).maybeSingle()
  ]);

  if (!student || !period || !enrollment || !settings || !evaluationPeriod) {
    return NextResponse.json({ error: 'ACADEMIC_DATA_INCOMPLETE' }, { status: 404 });
  }
  if (evaluationPeriod.state !== 'CLOSED') {
    return NextResponse.json({ error: 'PARTIAL_MUST_BE_CLOSED' }, { status: 409 });
  }
  if (!settings.director_name || !settings.director_signature_storage_path || !settings.institutional_seal_storage_path) {
    return NextResponse.json({ error: 'OFFICIAL_SIGNATURE_OR_SEAL_NOT_CONFIGURED' }, { status: 409 });
  }

  const rows = (overviewRaw ?? []) as unknown as Overview[];
  const gradeKey = `p${payload.partial}` as 'p1' | 'p2' | 'p3';
  if (rows.length === 0 || rows.some((row) => !row[gradeKey])) {
    return NextResponse.json({ error: 'INCOMPLETE_PARTIAL_RESULTS' }, { status: 409 });
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
  const folio = existing?.folio ?? `CBTA241-P${payload.partial}-${period.start_year}-${student.enrollment_number}-${stamp}`;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const semesters = enrollment.semesters as unknown as RelationLabel;
  const groups = enrollment.groups as unknown as RelationName;

  const pdf = await generatePartialReportPdf(
    {
      institutionName: settings.official_name,
      studentName: student.full_name,
      enrollmentNumber: student.enrollment_number,
      periodLabel: period.label,
      semesterLabel: semesters?.label ?? '',
      groupName: groups?.name ?? '',
      partial: payload.partial,
      folio,
      issuedAt: new Date(),
      version,
      verificationUrl: `${base}/verificar/${token}`,
      rows: rows.map((row) => {
        const grade = row[gradeKey] ?? '—';
        const numeric = grade === 'NP' ? 0 : Number(grade);
        return { subject: row.subject_name, grade, status: numeric >= 6 ? 'APROBADA' : 'NO APROBADA' };
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
  const storagePath = `parciales/${payload.periodId}/${payload.studentId}/${scopeKey}/${folio}-v${version}.pdf`;
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
        p_type: 'REPORTE_PARCIAL',
        p_scope_key: scopeKey,
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
