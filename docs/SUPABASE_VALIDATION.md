# Validación Supabase — RC5 certificado

- Proyecto dedicado: `Sistema Académico Digital CBTA 241`
- Ref: `hwytxddwuffbcingovlg`
- Región: `ca-central-1`
- Endpoint: `https://hwytxddwuffbcingovlg.supabase.co`
- Validación actualizada: 2026-09-04

## Resultado

| Gate | Resultado |
|---|---:|
| Migraciones remotas | `001`–`027` aplicadas |
| Schema contracts base | 21/21 PASS |
| Bootstrap SUPERADMIN | 8/8 PASS |
| RLS adversarial | 22/22 PASS |
| Revocación perfil inactivo | 6/6 PASS |
| Workflow académico/documental | 37/37 PASS |
| Seed estricto | PASS |
| Buckets privados | PASS |
| DML anónimo | bloqueado |
| DML crítico directo autenticado | bloqueado |
| Índice FK publicación | PASS |
| Auth real SUPERADMIN remoto | PASS |

El proyecto remoto se mantiene sin fixtures académicas permanentes. La cuenta Superadmin institucional real permanece enlazada; las cuentas multirol de certificación CI son efímeras y viven únicamente en Supabase local aislado.

## Advisors 2026-09-04

### Seguridad

Supabase reporta WARN para funciones `SECURITY DEFINER` deliberadamente ejecutables por `authenticated` y para `verify_academic_document` deliberadamente disponible a `anon`. La arquitectura conserva estas RPC porque encapsulan autorización interna, transacciones y auditoría; las tablas no quedan abiertas por ello.

También reporta `auth_leaked_password_protection`: **Leaked Password Protection Disabled**. Es configuración Auth externa a las migraciones y debe activarse antes de producción.

### Performance

Solo se reportan `unused_index` en nivel INFO. Dado que el proyecto se mantiene deliberadamente sin carga académica persistente, no se eliminan índices de integridad/consulta basándose en estadísticas de uso vacías.

## Validación reproducible local/CI

CI levanta Supabase desde cero, aplica las 27 migraciones y seed, ejecuta pgTAP, aprovisiona cuatro identidades Auth efímeras, prueba navegador desktop/Android y ejecuta backup/rebuild/restore con revalidación RLS. Resultado certificado: PASS.
