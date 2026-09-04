import { PageTitle } from '@/components/PageTitle';
import { PendingSubmitButton } from '@/components/PendingSubmitButton';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateInstitutionAction } from '@/features/admin/actions';

type Settings={official_name:string;short_name:string;school_key:string|null;address:string|null;phone:string|null;email:string|null;director_name:string|null;timezone:string;director_signature_storage_path:string|null;institutional_seal_storage_path:string|null;passing_grade:number|string};

export default async function InstitutionSettings(){
  await requireAuth(['SUPERADMIN']);const s=await createSupabaseServerClient();
  const {data}=await s.from('institution_settings').select('official_name,short_name,school_key,address,phone,email,director_name,timezone,director_signature_storage_path,institutional_seal_storage_path,passing_grade').eq('singleton_key','CBTA241').single();
  const settings=data as unknown as Settings;
  return <><PageTitle eyebrow="Identidad protegida" title="Configuración institucional" description="Firma y sello se almacenan en bucket privado; únicamente operaciones autorizadas de documentos pueden leerlos."/>
    <section className="section"><form action={updateInstitutionAction} className="login-panel admin-grid" style={{boxShadow:'none'}}>
      <div className="field wide"><label>Nombre oficial</label><input aria-label="Nombre oficial" name="official_name" defaultValue={settings.official_name} required/></div>
      <div className="field"><label>Nombre corto</label><input aria-label="Nombre corto" name="short_name" defaultValue={settings.short_name} required/></div>
      <div className="field"><label>Clave del plantel</label><input aria-label="Clave del plantel" name="school_key" defaultValue={settings.school_key??''}/></div>
      <div className="field wide"><label>Dirección</label><input aria-label="Dirección" name="address" defaultValue={settings.address??''}/></div>
      <div className="field"><label>Teléfono</label><input aria-label="Teléfono" name="phone" defaultValue={settings.phone??''}/></div>
      <div className="field"><label>Correo institucional</label><input aria-label="Correo institucional" name="email" type="email" defaultValue={settings.email??''}/></div>
      <div className="field"><label>Director(a)</label><input aria-label="Director(a)" name="director_name" defaultValue={settings.director_name??''}/></div>
      <div className="field"><label>Zona horaria</label><input aria-label="Zona horaria" name="timezone" defaultValue={settings.timezone} required/></div>
      <div className="field"><label>Mínima aprobatoria</label><input aria-label="Mínima aprobatoria" value={Number(settings.passing_grade).toFixed(1)} readOnly/><small>Regla académica V1.0 fijada en 6.0.</small></div>
      <div className="field"><label>Firma del Director (PNG/JPEG/WebP, ≤5 MB)</label><input aria-label="Firma del Director (PNG/JPEG/WebP, ≤5 MB)" name="signature" type="file" accept="image/png,image/jpeg,image/webp"/><small>{settings.director_signature_storage_path?'Activo privado configurado':'Pendiente'}</small></div>
      <div className="field"><label>Sello institucional (PNG/JPEG/WebP, ≤5 MB)</label><input aria-label="Sello institucional (PNG/JPEG/WebP, ≤5 MB)" name="seal" type="file" accept="image/png,image/jpeg,image/webp"/><small>{settings.institutional_seal_storage_path?'Activo privado configurado':'Pendiente'}</small></div>
      <div className="wide"><PendingSubmitButton idleLabel="Guardar configuración" /></div>
    </form></section>
  </>;
}
