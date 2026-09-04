'use client';
import { useState } from 'react';

type ImportKind='students'|'teachers'|'subjects'|'assignments';
type PreviewRow={row:number;values:Record<string,string>;errors:string[]};
type PreviewResponse={headers:string[];rows:PreviewRow[];valid:number;invalid:number;error?:string};
type CommitResult={row:number;ok:boolean;message:string};

export function ImportWizard(){
  const [kind,setKind]=useState<ImportKind>('students');
  const [preview,setPreview]=useState<PreviewResponse|null>(null);
  const [results,setResults]=useState<CommitResult[]|null>(null);
  const [busy,setBusy]=useState(false);
  async function previewFile(form:FormData){
    setBusy(true);setResults(null);
    try{const r=await fetch('/api/imports/preview',{method:'POST',body:form});const data=await r.json() as PreviewResponse;if(!r.ok)throw new Error(data.error??'PREVIEW_FAILED');setPreview(data);}finally{setBusy(false)}
  }
  async function commit(){
    if(!preview||preview.invalid>0)return;setBusy(true);
    try{const r=await fetch('/api/imports/commit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,rows:preview.rows.map(x=>({row:x.row,...x.values}))})});const data=await r.json() as {results?:CommitResult[];error?:string};if(!r.ok)throw new Error(data.error??'IMPORT_FAILED');setResults(data.results??[]);}finally{setBusy(false)}
  }
  return <div className="import-workspace">
    <form action={previewFile} className="login-panel admin-grid" style={{boxShadow:'none'}}>
      <div className="field"><label>Catálogo</label><select aria-label="Catálogo" name="kind" value={kind} onChange={e=>{setKind(e.target.value as ImportKind);setPreview(null);setResults(null)}}><option value="students">Alumnos</option><option value="teachers">Docentes</option><option value="subjects">Materias</option><option value="assignments">Asignaciones</option></select></div>
      <div className="field"><label>Archivo CSV/XLSX</label><input aria-label="Archivo CSV/XLSX" name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required/></div>
      <div><button className="btn btn-primary" disabled={busy}>{busy?'Validando…':'Validar y previsualizar'}</button></div>
    </form>
    <div className="alert">Columnas: {kind==='students'?'enrollment_number, full_name':kind==='teachers'?'employee_number, full_name':kind==='subjects'?'code, name':'employee_number, subject_code, group, period_label'}.</div>
    {preview&&<section className="section"><div className="section-heading"><div><h2>Previsualización</h2><p>{preview.valid} filas válidas · {preview.invalid} con errores. La importación se bloquea mientras exista un error de prevalidación.</p></div><button className="btn btn-primary" onClick={commit} disabled={busy||preview.invalid>0||preview.valid===0}>Confirmar importación</button></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Fila</th>{preview.headers.map(h=><th key={h}>{h}</th>)}<th>Validación</th></tr></thead><tbody>{preview.rows.slice(0,200).map(r=><tr key={r.row}><td>{r.row}</td>{preview.headers.map(h=><td key={h}>{r.values[h]??''}</td>)}<td><span className={`badge ${r.errors.length?'badge-danger':'badge-success'}`}>{r.errors.length?r.errors.join(' · '):'VÁLIDA'}</span></td></tr>)}</tbody></table></div>{preview.rows.length>200&&<p className="form-note">Se muestran 200 filas; todas las filas fueron validadas.</p>}</section>}
    {results&&<section className="section"><div className="section-heading"><div><h2>Reporte de importación</h2><p>{results.filter(x=>x.ok).length} correctas · {results.filter(x=>!x.ok).length} rechazadas por reglas de servidor/base de datos.</p></div></div><div className="flow-list">{results.map(x=><div className="flow-row" key={x.row}><strong>Fila {x.row}</strong><span>{x.message}</span><span></span><span className={`badge ${x.ok?'badge-success':'badge-danger'}`}>{x.ok?'IMPORTADA':'RECHAZADA'}</span></div>)}</div></section>}
  </div>;
}
