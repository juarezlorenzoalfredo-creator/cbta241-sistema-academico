import { requireAuth } from '@/lib/auth/session';
import { PortalShell } from '@/components/PortalShell';
const nav=[
  {href:'/admin',label:'Administración técnica',shortLabel:'Inicio'},
  {href:'/admin/usuarios',label:'Usuarios y roles',shortLabel:'Usuarios'},
  {href:'/admin/auditoria',label:'Auditoría global',shortLabel:'Auditoría'},
  {href:'/admin/seguridad',label:'Estado de seguridad',shortLabel:'Seguridad'},
  {href:'/admin/configuracion',label:'Institución y documentos',shortLabel:'Institución'}
];
export default async function AdminLayout({children}:{children:React.ReactNode}){const context=await requireAuth(['SUPERADMIN']);return <PortalShell context={context} roleLabel="Superadmin" nav={nav}>{children}</PortalShell>}
