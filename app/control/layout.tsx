import { requireAuth } from '@/lib/auth/session';
import { PortalShell } from '@/components/PortalShell';

const nav=[
  {href:'/control',label:'Centro de operaciones',shortLabel:'Inicio'},
  {href:'/control/alumnos',label:'Alumnos',shortLabel:'Alumnos'},
  {href:'/control/docentes',label:'Docentes',shortLabel:'Docentes'},
  {href:'/control/materias',label:'Materias',shortLabel:'Materias'},
  {href:'/control/grupos',label:'Grupos'},
  {href:'/control/periodos',label:'Periodos y semestres'},
  {href:'/control/inscripciones',label:'Inscripciones'},
  {href:'/control/asignaciones',label:'Asignaciones'},
  {href:'/control/evaluaciones',label:'Evaluaciones'},
  {href:'/control/seguimiento',label:'Seguimiento de captura'},
  {href:'/control/publicaciones',label:'Publicaciones'},
  {href:'/control/correcciones',label:'Correcciones'},
  {href:'/control/extraordinarios',label:'Extraordinarios'},
  {href:'/control/documentos',label:'Boletas y documentos'},
  {href:'/control/reportes',label:'Reportes'},
  {href:'/control/importaciones',label:'Importaciones CSV / XLSX'},
  {href:'/control/auditoria',label:'Auditoría'},
  {href:'/control/configuracion',label:'Configuración académica'}
];
export default async function ControlLayout({children}:{children:React.ReactNode}){const context=await requireAuth(['CONTROL_ESCOLAR']);return <PortalShell context={context} roleLabel="Control Escolar" nav={nav}>{children}</PortalShell>}
