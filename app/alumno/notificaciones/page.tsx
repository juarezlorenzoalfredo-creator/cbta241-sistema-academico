import { PageTitle } from '@/components/PageTitle';
import { markNotificationReadAction } from '@/features/control/profile-actions';
import { requireAuth } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default async function Notifications() {
  const context = await requireAuth(['ALUMNO']);
  const supabase = await createSupabaseServerClient();
  const { data: rawNotifications } = await supabase.from('notifications').select('id,type,title,body,read_at,created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(100);
  const notifications = (rawNotifications ?? []) as unknown as NotificationRow[];

  return (
    <>
      <PageTitle eyebrow="Avisos" title="Notificaciones" description="Publicaciones, correcciones, extraordinarios y documentos disponibles aparecen aquí." />
      <div className="flow-list">
        {notifications.map((notification) => (
          <div className="flow-row" key={notification.id}>
            <div><div className="primary">{notification.title}</div><div className="secondary">{notification.body}</div></div>
            <div>{new Date(notification.created_at).toLocaleString('es-MX')}</div>
            <div><span className={`badge ${notification.read_at ? '' : 'badge-warn'}`}>{notification.read_at ? 'LEÍDA' : 'NUEVA'}</span></div>
            <div>{!notification.read_at && <form action={markNotificationReadAction}><input type="hidden" name="id" value={notification.id} /><button className="btn btn-ghost">Marcar leída</button></form>}</div>
          </div>
        ))}
      </div>
      {notifications.length === 0 && <div className="empty-state">No tienes notificaciones.</div>}
    </>
  );
}
