# Validación Supabase — RC5

- Proyecto: `Sistema Académico Digital CBTA 241`
- Ref: `hwytxddwuffbcingovlg`
- Región: `ca-central-1`
- Endpoint público: `https://hwytxddwuffbcingovlg.supabase.co`
- Fecha de validación: 2026-09-03

## Resultado

| Gate | Resultado |
|---|---:|
| Migraciones remotas | `001`–`027` aplicadas |
| Schema contracts pgTAP base | 21/21 PASS en RC3 |
| Bootstrap SUPERADMIN | 8/8 PASS transaccional; `service_role` only, email confirmado y coincidencia Auth/perfil |
| RLS adversarial base | 22/22 PASS; suite reejecutada tras RC4 hasta test 22 OK |
| Revocación de sesión por perfil inactivo | 6/6 PASS |
| Workflow académico/documental | 37/37 PASS en PostgreSQL real |
| Seed estricto | PASS |
| Buckets privados | PASS |
| Grants de tabla `anon` | 0 |
| DML crítico directo `authenticated` | bloqueado |
| Índice FK compuesta publicación | aplicado; advisor `unindexed_foreign_keys` resuelto |
| TypeScript types desde esquema | generado correctamente |

El proyecto remoto se mantiene sin fixtures académicas permanentes. Desde RC5 existe exactamente una identidad Auth institucional real, confirmada y enlazada a un perfil `SUPERADMIN`; los usuarios artificiales de pruebas siguen ejecutándose dentro de transacciones con `ROLLBACK` y no persisten.


## Auth real RC5

- identidad Supabase Auth institucional: creada y correo confirmado;
- perfil público asociado: activo;
- rol: `SUPERADMIN`;
- auditoría `FIRST_SUPERADMIN_BOOTSTRAPPED`: presente;
- RLS bajo JWT simulado `authenticated`: `current_primary_role() = SUPERADMIN`, lectura administrativa de perfiles/auditoría/configuración: PASS;
- auto-desactivación del SUPERADMIN real: bloqueada;
- auto-degradación del SUPERADMIN real: bloqueada.

La contraseña no se almacena ni se documenta en el repositorio.

## Hardening RC4–RC5

1. `bootstrap_first_superadmin(uuid,text,text)` permite enlazar el primer usuario Auth con `SUPERADMIN` solo mediante `service_role`. `anon` y `authenticated` no tienen `EXECUTE`.
2. `set_user_active_workflow` y `replace_user_role_workflow` preservan continuidad administrativa y evitan dejar el sistema sin un Superadmin activo.
3. `current_student_id`, `current_teacher_id` y `current_primary_role` exigen `profiles.is_active=true`. Esto revoca visibilidad RLS inmediatamente aunque un JWT emitido antes de la desactivación todavía no haya expirado.
4. Se agregó índice de cobertura `grades_publication_context_idx` para la FK compuesta que liga una calificación publicada con su cabecera exacta de publicación.

## Revocación comprobada

Prueba remota transaccional:

- alumno activo obtiene identidad académica: PASS;
- al desactivar su perfil, `current_student_id()` retorna `NULL`: PASS;
- el mismo JWT simulado deja de ver alumnos por RLS: PASS;
- docente activo obtiene identidad docente: PASS;
- al desactivar su perfil, `current_teacher_id()` retorna `NULL`: PASS;
- el mismo JWT simulado deja de ver alumnos por RLS: PASS.

## Workflow académico previamente probado

`captura → publicación → corrección ≤72h → solicitud >72h → aprobación → NP → P3 → cierre parciales → extraordinario único → captura → publicación → cierre semestre → documento V1 → sustitución V2 → revocación`.

## Seguridad

Los avisos del Supabase Database Linter sobre funciones `SECURITY DEFINER` expuestas a `authenticated` son esperados para las RPC de dominio: cada workflow realiza autorización interna por rol/asignación y su superficie `EXECUTE` es explícita. `verify_academic_document` es la única RPC deliberadamente disponible a `anon` y devuelve información minimizada. El bootstrap inicial no se expone a navegador.

Los avisos de índices `unused_index` no son accionables todavía porque el proyecto se mantiene deliberadamente sin carga persistente; no se eliminan índices basándose en estadísticas de una base vacía.
