import { PageTitle } from '@/components/PageTitle';
import { MetricBand } from '@/components/MetricBand';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { currentServerEpochMs } from '@/lib/server/time';

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_role: string | null;
  reason: string | null;
  request_id: string;
  occurred_at: string;
};

export default async function AdminAuditPage() {
  await requireAuth(['SUPERADMIN']);
  const supabase = await createSupabaseServerClient();
  const since = new Date(currentServerEpochMs() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: rawRows, count: total }, { count: sessionEvents }, { count: roleChanges }] = await Promise.all([
    supabase.from('audit_logs').select('id,action,entity,entity_id,actor_role,reason,request_id,occurred_at', { count: 'exact' }).order('occurred_at', { ascending: false }).limit(300),
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }).in('action', ['LOGIN', 'LOGOUT']).gte('occurred_at', since),
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'ROLE_CHANGED')
  ]);
  const rows = (rawRows ?? []) as unknown as AuditRow[];
  return <>
    <PageTitle eyebrow="Trazabilidad técnica" title="Auditoría global" description="Vista Superadmin de eventos críticos append-only. No muestra contraseñas, tokens ni secretos." />
    <MetricBand items={[{ value: total ?? 0, label: 'Eventos registrados' }, { value: sessionEvents ?? 0, label: 'Sesiones 24 h', hint: 'LOGIN / LOGOUT' }, { value: roleChanges ?? 0, label: 'Cambios de rol' }, { value: 'APPEND-ONLY', label: 'Integridad' }]} />
    <div className="flow-list">
      {rows.map((row) => <div className="flow-row" key={row.id}>
        <div><div className="primary">{row.action}</div><div className="secondary">{row.entity}{row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ''}</div></div>
        <div>{row.actor_role ?? 'SISTEMA'}</div>
        <div>{row.reason ?? `request ${row.request_id.slice(0, 8)}`}</div>
        <span className="badge">{new Date(row.occurred_at).toLocaleString('es-MX')}</span>
      </div>)}
    </div>
    {rows.length === 0 && <div className="empty-state">No existen eventos de auditoría.</div>}
  </>;
}
