'use client';
import { useMemo, useState, useTransition } from 'react';

type Row={
  sseId:string; enrollmentNumber:string; studentName:string;
  kind:'NUMERIC'|'NP'|'PENDING'; numericGrade:number|null; version:number;
};

function normalizeGrade(value:string):{kind:'NUMERIC'|'NP'|'PENDING';value?:number}|null{
  const raw=value.trim().toUpperCase();
  if(raw===''||raw==='—'||raw==='PENDIENTE') return {kind:'PENDING'};
  if(raw==='NP') return {kind:'NP'};
  const n=Number(raw.replace(',','.'));
  if(!Number.isFinite(n)||n<0||n>10||Math.round(n*10)!==n*10) return null;
  return {kind:'NUMERIC',value:n};
}

export function GradeCaptureTable({assignmentId,evaluationPeriodId,initialRows,alreadyPublished}:{assignmentId:string;evaluationPeriodId:string;initialRows:Row[];alreadyPublished:boolean}){
  const [rows,setRows]=useState(initialRows);
  const [message,setMessage]=useState<string>('');
  const [pasteOpen,setPasteOpen]=useState(false);
  const [pasteText,setPasteText]=useState('');
  const [isPending,startTransition]=useTransition();
  const summary=useMemo(()=>({
    numeric:rows.filter(r=>r.kind==='NUMERIC').length,
    np:rows.filter(r=>r.kind==='NP').length,
    pending:rows.filter(r=>r.kind==='PENDING').length
  }),[rows]);

  async function saveRow(index:number,nextValue:string){
    const grade=normalizeGrade(nextValue);
    if(!grade){setMessage(`Valor inválido en ${rows[index].studentName}. Usa 0.0–10.0, NP o vacío.`);return;}
    const row=rows[index];
    const next={...row,kind:grade.kind,numericGrade:grade.kind==='NUMERIC'?(grade.value??null):null};
    setRows(current=>current.map((r,i)=>i===index?next:r));
    const res=await fetch('/api/grading/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({studentSubjectEnrollmentId:row.sseId,evaluationPeriodId,grade,expectedVersion:row.version})});
    const body=await res.json();
    if(!res.ok){setMessage(body.error??'No se guardó.');setRows(current=>current.map((r,i)=>i===index?row:r));return;}
    const saved=Array.isArray(body.grade)?body.grade[0]:body.grade;
    setRows(current=>current.map((r,i)=>i===index?{...next,version:saved?.version??row.version+1}:r));
    setMessage(`Guardado: ${row.studentName}`);
  }

  function applyPaste(){
    const lines=pasteText.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const parsed=lines.map(line=>line.split(/\t|,|;/).map(c=>c.trim()));
    const updates=new Map<string,string>();
    for(const cols of parsed){
      if(cols.length===1) continue;
      updates.set(cols[0],cols[cols.length-1]);
    }
    startTransition(async()=>{
      let count=0;
      for(let i=0;i<rows.length;i++){
        const raw=updates.get(rows[i].enrollmentNumber);
        if(raw!==undefined){await saveRow(i,raw);count++;}
      }
      setPasteOpen(false); setPasteText(''); setMessage(`Pegado controlado: ${count} alumnos procesados.`);
    });
  }

  async function publish(){
    if(summary.pending>0){setMessage(`No se puede publicar: quedan ${summary.pending} pendientes.`);return;}
    if(!confirm(`Publicar ${rows.length} calificaciones? Numéricas: ${summary.numeric}; NP: ${summary.np}. La operación es atómica.`)) return;
    const idempotencyKey=crypto.randomUUID()+crypto.randomUUID();
    const res=await fetch('/api/grading/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assignmentId,evaluationPeriodId,idempotencyKey})});
    const body=await res.json();
    if(!res.ok){setMessage(body.error??'No fue posible publicar.');return;}
    setMessage('Publicación completada de forma atómica. Recarga para ver el estado final.');
    location.reload();
  }

  return <>
    <div className="capture-toolbar">
      <div><span className="badge">Numéricas {summary.numeric}</span> <span className="badge">NP {summary.np}</span> <span className={`badge ${summary.pending?'badge-warn':'badge-success'}`}>Pendientes {summary.pending}</span></div>
      <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}><button className="btn btn-ghost" type="button" onClick={()=>setPasteOpen(v=>!v)} disabled={alreadyPublished}>Pegar desde Excel/Sheets</button><button className="btn btn-primary" type="button" onClick={publish} disabled={alreadyPublished||isPending||summary.pending>0}>Publicar parcial</button></div>
    </div>
    {pasteOpen&&<section className="login-panel" style={{margin:'1rem 0',boxShadow:'none'}}><strong>Pegado controlado</strong><p className="form-note">Pega dos columnas: matrícula y calificación. Ejemplo: <code>2410001[TAB]8.5</code>. También acepta NP.</p><textarea aria-label="Calificaciones pegadas desde Excel o Sheets" value={pasteText} onChange={e=>setPasteText(e.target.value)} rows={7} style={{width:'100%',padding:'.8rem',border:'1px solid var(--line)',borderRadius:'8px'}}/><div style={{marginTop:'.6rem'}}><button className="btn btn-primary" onClick={applyPaste} disabled={isPending}>Validar y aplicar</button></div></section>}
    {message&&<div className="alert" role="status">{message}</div>}
    <div className="grade-table-wrap"><table className="capture-table"><thead><tr><th>#</th><th>Matrícula</th><th>Alumno</th><th>Calificación</th><th>Estado</th></tr></thead><tbody>{rows.map((row,index)=><tr key={row.sseId}><td>{index+1}</td><td>{row.enrollmentNumber}</td><td><strong>{row.studentName}</strong></td><td><input aria-label={`Calificación de ${row.studentName}`} defaultValue={row.kind==='NP'?'NP':row.kind==='NUMERIC'?row.numericGrade?.toFixed(1):''} placeholder="0.0–10.0 / NP" disabled={alreadyPublished||isPending} onBlur={e=>saveRow(index,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();(e.currentTarget.closest('tr')?.nextElementSibling?.querySelector('input') as HTMLInputElement|null)?.focus()}}}/></td><td><span className={`status-dot ${row.kind==='PENDING'?'changed':'saved'}`}/>{row.kind==='PENDING'?'Pendiente':alreadyPublished?'Publicado':'Guardado'}</td></tr>)}</tbody></table></div>
  </>;
}
