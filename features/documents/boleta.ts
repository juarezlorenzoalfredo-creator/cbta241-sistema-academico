import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

export type BoletaRow={subject:string;p1:string;p2:string;p3:string;ordinary:string;extraordinary:string;status:string};
export type BoletaData={
  institutionName:string; studentName:string; enrollmentNumber:string; periodLabel:string; semesterLabel:string; groupName:string;
  folio:string; issuedAt:Date; version:number; verificationUrl:string; rows:BoletaRow[];
};

type Assets={logo:Uint8Array;signature:Uint8Array;seal:Uint8Array;signatureMime:string;sealMime:string;directorName:string};

function fit(text:string,max:number){return text.length<=max?text:`${text.slice(0,Math.max(0,max-1))}…`;}

export async function generateBoletaPdf(data:BoletaData,assets:Assets):Promise<Uint8Array>{
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo=await pdf.embedPng(assets.logo);
  const signature=assets.signatureMime.includes('png')?await pdf.embedPng(assets.signature):await pdf.embedJpg(assets.signature);
  const seal=assets.sealMime.includes('png')?await pdf.embedPng(assets.seal):await pdf.embedJpg(assets.seal);
  const qrBytes=await QRCode.toBuffer(data.verificationUrl,{type:'png',width:300,margin:1,errorCorrectionLevel:'M'});
  const qr=await pdf.embedPng(qrBytes);
  const green=rgb(0.21,0.36,0.20), yellow=rgb(0.94,0.72,0.03), dark=rgb(0.12,0.16,0.13), muted=rgb(0.38,0.43,0.39), line=rgb(0.82,0.85,0.81);
  const pageW=612,pageH=792,margin=42;
  const perPage=18;
  const chunks:Array<BoletaRow[]>=[]; for(let i=0;i<data.rows.length;i+=perPage) chunks.push(data.rows.slice(i,i+perPage)); if(!chunks.length)chunks.push([]);

  chunks.forEach((rows,pageIndex)=>{
    const page=pdf.addPage([pageW,pageH]);
    page.drawRectangle({x:0,y:pageH-8,width:pageW*.72,height:8,color:green});
    page.drawRectangle({x:pageW*.72,y:pageH-8,width:pageW*.28,height:8,color:yellow});
    const logoSize=64; page.drawImage(logo,{x:margin,y:pageH-95,width:logoSize,height:logoSize});
    page.drawText('CENTRO DE BACHILLERATO TECNOLOGICO AGROPECUARIO No. 241',{x:margin+78,y:pageH-49,size:10,font:bold,color:green});
    page.drawText('BOLETA SEMESTRAL DE CALIFICACIONES',{x:margin+78,y:pageH-69,size:16,font:bold,color:dark});
    page.drawText(`${data.periodLabel} · ${data.semesterLabel} semestre · Grupo ${data.groupName}`,{x:margin+78,y:pageH-86,size:8.5,font:regular,color:muted});
    let y=pageH-128;
    page.drawText('ALUMNO',{x:margin,y,size:7,font:bold,color:muted}); page.drawText(fit(data.studentName,58),{x:margin,y:y-14,size:10,font:bold,color:dark});
    page.drawText('MATRICULA',{x:395,y,size:7,font:bold,color:muted}); page.drawText(data.enrollmentNumber,{x:395,y:y-14,size:10,font:bold,color:dark});
    y-=44;
    const cols=[{x:margin,w:210,label:'MATERIA'},{x:252,w:42,label:'P1'},{x:294,w:42,label:'P2'},{x:336,w:42,label:'P3'},{x:378,w:62,label:'ORD.'},{x:440,w:52,label:'EXTRA'},{x:492,w:78,label:'ESTADO'}];
    page.drawRectangle({x:margin,y:y-20,width:pageW-margin*2,height:20,color:green});
    cols.forEach(c=>page.drawText(c.label,{x:c.x+4,y:y-13,size:6.7,font:bold,color:rgb(1,1,1)}));
    y-=20;
    rows.forEach((r,idx)=>{
      const h=24; if(idx%2===1)page.drawRectangle({x:margin,y:y-h,width:pageW-margin*2,height:h,color:rgb(.97,.98,.96)});
      const values=[fit(r.subject,37),r.p1,r.p2,r.p3,r.ordinary,r.extraordinary,fit(r.status,14)];
      cols.forEach((c,i)=>{page.drawText(values[i]??'—',{x:c.x+4,y:y-15,size:i===0?7.3:7,font:i===0?bold:regular,color:dark});page.drawLine({start:{x:c.x,y},end:{x:c.x,y:y-h},thickness:.3,color:line});});
      page.drawLine({start:{x:pageW-margin,y},end:{x:pageW-margin,y:y-h},thickness:.3,color:line});
      page.drawLine({start:{x:margin,y:y-h},end:{x:pageW-margin,y:y-h},thickness:.3,color:line}); y-=h;
    });
    if(pageIndex===chunks.length-1){
      y=Math.min(y-30,220);
      page.drawImage(signature,{x:110,y:y-5,width:105,height:45});
      page.drawLine({start:{x:85,y:y-10},end:{x:240,y:y-10},thickness:.6,color:muted});
      page.drawText(fit(assets.directorName,35),{x:90,y:y-23,size:7.5,font:bold,color:dark});
      page.drawText('Director(a)',{x:135,y:y-34,size:7,font:regular,color:muted});
      page.drawImage(seal,{x:360,y:y-25,width:78,height:78});
      page.drawText('Sello institucional',{x:354,y:y-37,size:7,font:regular,color:muted});
      page.drawImage(qr,{x:pageW-margin-62,y:42,width:62,height:62});
      page.drawText('Verificacion publica',{x:pageW-margin-75,y:30,size:6.5,font:regular,color:muted});
    }
    page.drawText(`Folio ${data.folio} · Version ${data.version} · Emitida ${data.issuedAt.toLocaleDateString('es-MX')}`,{x:margin,y:20,size:6.8,font:regular,color:muted});
    if(chunks.length>1)page.drawText(`Pagina ${pageIndex+1} de ${chunks.length}`,{x:pageW-105,y:20,size:6.8,font:regular,color:muted});
  });
  return pdf.save({useObjectStreams:false});
}
