'use client';

import { useState } from 'react';

type Option = { id: string; label: string };
type IssueResponse = {
  error?: string;
  folio?: string;
  documentId?: string;
  version?: number;
  replaced?: boolean;
};

export function PartialReportIssueForm({ students, periods }: { students: Option[]; periods: Option[] }) {
  const [status, setStatus] = useState('');

  async function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Generando reporte parcial oficial…');
    const response = await fetch('/api/documents/issue-partial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: form.get('studentId'),
        periodId: form.get('periodId'),
        partial: Number(form.get('partial')),
        replacementReason: form.get('replacementReason')
      })
    });
    const body = (await response.json()) as IssueResponse;
    if (!response.ok) {
      setStatus(`No emitido: ${body.error ?? 'ERROR'}`);
      return;
    }
    setStatus(`${body.replaced ? 'Nueva versión emitida' : 'Reporte emitido'}: ${body.folio} · V${body.version}`);
    if (body.documentId) window.open(`/api/documents/${body.documentId}`, '_blank');
    location.reload();
  }

  return (
    <form className="login-panel document-form" style={{ boxShadow: 'none' }} onSubmit={issue}>
      <div className="field">
        <label>Alumno</label>
        <select aria-label="Alumno" name="studentId" required>{students.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      </div>
      <div className="field">
        <label>Periodo</label>
        <select aria-label="Periodo" name="periodId" required>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      </div>
      <div className="field">
        <label>Parcial cerrado</label>
        <select aria-label="Parcial cerrado" name="partial" defaultValue="1"><option value="1">Parcial 1</option><option value="2">Parcial 2</option><option value="3">Parcial 3</option></select>
      </div>
      <div className="field">
        <label>Motivo de sustitución</label>
        <input aria-label="Motivo de sustitución" name="replacementReason" maxLength={500} placeholder="Solo si ya existe este reporte" />
      </div>
      <button className="btn btn-primary">Emitir reporte parcial</button>
      {status && <div className="alert" role="status" aria-live="polite" style={{ gridColumn: '1/-1' }}>{status}</div>}
    </form>
  );
}
