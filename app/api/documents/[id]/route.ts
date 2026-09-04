export const runtime='nodejs';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/errors/server';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const s=await createSupabaseServerClient();
  const {data:doc,error:docError}=await s.from('academic_documents').select('id,folio,current_version').eq('id',id).maybeSingle();
  if(docError)return NextResponse.json(apiFailure('No fue posible consultar el documento.','DOCUMENT_QUERY_FAILED',docError),{status:500});
  if(!doc)return NextResponse.json({error:'NOT_FOUND_OR_FORBIDDEN'},{status:404});
  const {data:v,error:versionError}=await s.from('document_versions').select('storage_path').eq('document_id',id).eq('version',doc.current_version).maybeSingle();
  if(versionError)return NextResponse.json(apiFailure('No fue posible consultar la versión del documento.','DOCUMENT_VERSION_QUERY_FAILED',versionError),{status:500});
  if(!v)return NextResponse.json({error:'VERSION_NOT_FOUND'},{status:404});
  const {data,error}=await s.storage.from('academic-documents').download(v.storage_path);
  if(error||!data)return NextResponse.json(apiFailure('El PDF no está disponible en este momento.','PDF_NOT_AVAILABLE',error),{status:404});
  return new NextResponse(await data.arrayBuffer(),{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${doc.folio}.pdf"`,'cache-control':'private, no-store'}});
}
