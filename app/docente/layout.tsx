import { requireAuth } from '@/lib/auth/session';
import { PortalShell } from '@/components/PortalShell';
const nav=[
  {href:'/docente',label:'Inicio',shortLabel:'Inicio'},
  {href:'/docente/materias',label:'Mis materias',shortLabel:'Materias'},
  {href:'/docente/grupos',label:'Mis grupos',shortLabel:'Grupos'},
  {href:'/docente/captura',label:'Captura de calificaciones',shortLabel:'Captura'},
  {href:'/docente/publicaciones',label:'Publicaciones'},
  {href:'/docente/riesgo',label:'Alumnos en riesgo',shortLabel:'Riesgo'},
  {href:'/docente/solicitudes',label:'Solicitudes de corrección',shortLabel:'Solicitudes'},
  {href:'/docente/correcciones',label:'Corregir publicaciones'},
  {href:'/docente/extraordinarios',label:'Extraordinarios'},
  {href:'/docente/reportes',label:'Reportes'}
];
export default async function TeacherLayout({children}:{children:React.ReactNode}){const context=await requireAuth(['DOCENTE']);return <PortalShell context={context} roleLabel="Docente" nav={nav}>{children}</PortalShell>}
