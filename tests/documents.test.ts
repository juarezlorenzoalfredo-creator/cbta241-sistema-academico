import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { generateBoletaPdf, type BoletaRow } from '@/features/documents/boleta';
import { generatePartialReportPdf, type PartialRow } from '@/features/documents/reporteParcial';

const png = new Uint8Array(readFileSync(resolve(process.cwd(), 'public/institution/cbta241-logo.png')));
const assets = {
  logo: png,
  signature: png,
  seal: png,
  signatureMime: 'image/png',
  sealMime: 'image/png',
  directorName: 'Dirección de prueba'
};

describe('official academic PDF generation', () => {
  it('generates a valid multi-page semester report with QR/signature/seal assets', async () => {
    const rows: BoletaRow[] = Array.from({ length: 19 }, (_, index) => ({
      subject: `Materia de prueba ${index + 1}`,
      p1: index % 4 === 0 ? 'NP' : '8.0',
      p2: '7.5',
      p3: '9.0',
      ordinary: '8.2',
      extraordinary: '—',
      status: 'APROBADA'
    }));

    const bytes = await generateBoletaPdf({
      institutionName: 'CENTRO DE BACHILLERATO TECNOLOGICO AGROPECUARIO No. 241',
      studentName: 'ALUMNO DE PRUEBA',
      enrollmentNumber: 'DEMO-001',
      periodLabel: 'Agosto 2026 - Enero 2027',
      semesterLabel: '1°',
      groupName: 'A',
      folio: 'CBTA241-DEMO-0001',
      issuedAt: new Date('2026-09-04T12:00:00Z'),
      version: 1,
      verificationUrl: 'https://example.test/verificar/demo-token',
      rows
    }, assets);

    expect(bytes.byteLength).toBeGreaterThan(10_000);
    expect(new TextDecoder('latin1').decode(bytes.slice(0, 8))).toContain('%PDF');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
  });

  it('generates a valid partial report and paginates more than 22 subjects', async () => {
    const rows: PartialRow[] = Array.from({ length: 23 }, (_, index) => ({
      subject: `Materia parcial ${index + 1}`,
      grade: index % 5 === 0 ? 'NP' : '8.5',
      status: index % 5 === 0 ? 'NO PRESENTÓ' : 'PUBLICADA'
    }));

    const bytes = await generatePartialReportPdf({
      institutionName: 'CENTRO DE BACHILLERATO TECNOLOGICO AGROPECUARIO No. 241',
      studentName: 'ALUMNO DE PRUEBA',
      enrollmentNumber: 'DEMO-001',
      periodLabel: 'Agosto 2026 - Enero 2027',
      semesterLabel: '1°',
      groupName: 'A',
      partial: 1,
      folio: 'CBTA241-P1-DEMO-0001',
      issuedAt: new Date('2026-09-04T12:00:00Z'),
      version: 1,
      verificationUrl: 'https://example.test/verificar/demo-token-p1',
      rows
    }, assets);

    expect(bytes.byteLength).toBeGreaterThan(10_000);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
  });
});
