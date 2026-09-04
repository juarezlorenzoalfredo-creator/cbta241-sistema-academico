import { PageTitle } from '@/components/PageTitle';
import { ImportWizard } from '@/components/ImportWizard';
import { requireAuth } from '@/lib/auth/session';
export default async function ImportsPage(){await requireAuth(['CONTROL_ESCOLAR']);return <><PageTitle eyebrow="Migración controlada" title="Importaciones CSV / XLSX" description="Subir → validar → previsualizar → confirmar → reportar. Ningún archivo inserta datos directamente sin prevalidación."/><ImportWizard/></>}
