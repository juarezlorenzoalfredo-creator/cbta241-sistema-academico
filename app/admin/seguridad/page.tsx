import { PageTitle } from '@/components/PageTitle';
import { MetricBand } from '@/components/MetricBand';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminSecurityPage() {
  await requireAuth(['SUPERADMIN']);
  const supabase = await createSupabaseServerClient();
  const [{ count: activeProfiles }, { count: superadmins }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'SUPERADMIN'),
    supabase.from('institution_settings').select('director_signature_storage_path,institutional_seal_storage_path').eq('singleton_key', 'CBTA241').maybeSingle()
  ]);
  const protectedAssets = Number(Boolean(settings?.director_signature_storage_path)) + Number(Boolean(settings?.institutional_seal_storage_path));
  return <>
    <PageTitle eyebrow="Defensa en profundidad" title="Estado de seguridad" description="Controles de seguridad aplicados por diseño. Esta pantalla no expone claves, tokens ni rutas públicas a activos sensibles." />
    <MetricBand items={[{ value: activeProfiles ?? 0, label: 'Perfiles activos' }, { value: superadmins ?? 0, label: 'Superadmin' }, { value: `${protectedAssets}/2`, label: 'Activos institucionales', hint: 'Firma / sello privados' }, { value: 'FORCED RLS', label: 'Tablas sensibles' }]} />
    <section className="section">
      <div className="section-heading"><div><h2>Controles obligatorios</h2><p>Resumen operativo de la frontera de confianza.</p></div></div>
      <div className="flow-list">
        <div className="flow-row"><strong>Autorización</strong><span>auth.uid() + roles + asignación vigente</span><span>IDs del navegador no autorizan</span><span className="badge badge-success">ACTIVO</span></div>
        <div className="flow-row"><strong>Base de datos</strong><span>RLS forzado + constraints + RPC</span><span>Deny by default</span><span className="badge badge-success">ACTIVO</span></div>
        <div className="flow-row"><strong>Funciones críticas</strong><span>SECURITY DEFINER con search_path fijo</span><span>PUBLIC EXECUTE revocado</span><span className="badge badge-success">ACTIVO</span></div>
        <div className="flow-row"><strong>Documentos</strong><span>Storage privado + versiones inmutables</span><span>QR minimizado</span><span className="badge badge-success">ACTIVO</span></div>
        <div className="flow-row"><strong>PWA</strong><span>No cachea datos académicos privados</span><span>Fallback offline aislado</span><span className="badge badge-success">ACTIVO</span></div>
        <div className="flow-row"><strong>Service Role</strong><span>Solo scripts administrativos server-side</span><span>Nunca NEXT_PUBLIC_*</span><span className="badge badge-success">AISLADO</span></div>
      </div>
    </section>
    <div className="alert">Los intentos de autenticación fallidos se registran en observabilidad del servidor sin correo ni contraseña. Los LOGIN/LOGOUT exitosos se escriben en auditoría mediante una RPC que deriva actor y rol de la sesión.</div>
  </>;
}
