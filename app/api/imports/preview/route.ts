import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/session';

type Kind='students'|'teachers'|'subjects'|'assignments';
const REQUIRED:Record<Kind,string[]>={students:['enrollment_number','full_name'],teachers:['employee_number','full_name'],subjects:['code','name'],assignments:['employee_number','subject_code','group','period_label']};

function parseCsv(text:string):string[][]{
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x.trim()))rows.push(row);row=[];}else cell+=c;}
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function clean(value:unknown){if(value===null||value===undefined)return '';if(typeof value==='object'&&value&&'text' in value)return String((value as {text?:unknown}).text??'').trim();return String(value).trim();}
function validate(kind:Kind, values:Record<string,string>):string[]{
  const errors:string[]=[];for(const col of REQUIRED[kind]){if(!values[col])errors.push(`${col}: requerido`)}
  if(kind==='students'&&values.enrollment_number&&values.enrollment_number.length<3)errors.push('enrollment_number: mínimo 3 caracteres');
  if(kind==='teachers'&&values.full_name?.length<2)errors.push('full_name: inválido');
  if(kind==='subjects'&&values.code?.length<1)errors.push('code: inválido');
  return errors;
}
export async function POST(request:Request){
  const auth=await getAuthContext();if(!auth?.roles.includes('CONTROL_ESCOLAR'))return NextResponse.json({error:'FORBIDDEN'},{status:403});
  const form=await request.formData();const kind=String(form.get('kind')??'') as Kind;const file=form.get('file');
  if(!(kind in REQUIRED)||!(file instanceof File))return NextResponse.json({error:'INVALID_REQUEST'},{status:400});
  if(file.size>5*1024*1024)return NextResponse.json({error:'FILE_TOO_LARGE'},{status:413});
  const lower=file.name.toLowerCase();let matrix:string[][]=[];
  try{
    if(lower.endsWith('.csv')||file.type==='text/csv'){matrix=parseCsv(new TextDecoder('utf-8').decode(await file.arrayBuffer()));}
    else if(lower.endsWith('.xlsx')){const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());const ws=wb.worksheets[0];if(!ws)throw new Error('EMPTY_WORKBOOK');ws.eachRow({includeEmpty:false},r=>matrix.push((r.values as unknown[]).slice(1).map(clean)));}
    else return NextResponse.json({error:'UNSUPPORTED_FILE_TYPE'},{status:415});
  }catch{return NextResponse.json({error:'FILE_PARSE_FAILED'},{status:400});}
  if(matrix.length<2)return NextResponse.json({error:'NO_DATA_ROWS'},{status:400});if(matrix.length>1001)return NextResponse.json({error:'ROW_LIMIT_1000'},{status:400});
  const headers=matrix[0].map(h=>h.trim().toLowerCase());const missing=REQUIRED[kind].filter(h=>!headers.includes(h));if(missing.length)return NextResponse.json({error:`MISSING_COLUMNS:${missing.join(',')}`},{status:400});
  const rows=matrix.slice(1).map((cells,index)=>{const values:Record<string,string>={};headers.forEach((h,i)=>values[h]=clean(cells[i]));return{row:index+2,values,errors:validate(kind,values)}});
  return NextResponse.json({headers:REQUIRED[kind],rows,valid:rows.filter(x=>x.errors.length===0).length,invalid:rows.filter(x=>x.errors.length>0).length});
}
