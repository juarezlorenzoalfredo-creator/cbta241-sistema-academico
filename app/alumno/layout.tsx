import { requireAuth } from '@/lib/auth/session';
import { PortalShell } from '@/components/PortalShell';

const nav=[
  {href:'/alumno',label:'Inicio',shortLabel:'Inicio'},
  {href:'/alumno/calificaciones',label:'Mis calificaciones',shortLabel:'Notas'},
  {href:'/alumno/materias',label:'Mis materias',shortLabel:'Materias'},
  {href:'/alumno/historial',label:'Historial académico',shortLabel:'Historial'},
  {href:'/alumno/extraordinarios',label:'Extraordinarios'},
  {href:'/alumno/documentos',label:'Documentos',shortLabel:'Docs'},
  {href:'/alumno/notificaciones',label:'Notificaciones'},
  {href:'/alumno/perfil',label:'Mi perfil'}
];
export default async function StudentLayout({children}:{children:React.ReactNode}){const context=await requireAuth(['ALUMNO']);return <PortalShell context={context} roleLabel="Alumno" nav={nav}>{children}</PortalShell>}
