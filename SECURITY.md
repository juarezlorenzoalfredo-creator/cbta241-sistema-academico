# Seguridad

## Modelo

**DENY BY DEFAULT** y defensa en profundidad: UI + servidor + RLS + constraints + Storage.

## Controles principales

- RLS habilitado y forzado en tablas sensibles.
- Sin DML directo para calificaciones, publicaciones, correcciones, extraordinarios o auditoría; se mutan por RPC autorizadas.
- Helpers `SECURITY DEFINER` con `search_path` explícito y superficie `EXECUTE` deliberada.
- `PUBLIC` sin ejecución implícita y `ALTER DEFAULT PRIVILEGES` endurecido para objetos futuros.
- Alumno derivado desde `auth.uid() → students.profile_id`.
- Docente derivado desde `auth.uid() → teachers.profile_id → teacher_assignments`.
- No se confía en UUID recibidos del navegador como fuente de autorización.
- Firma, sello y PDFs en buckets privados.
- Verificación QR pública minimizada: autenticidad/estado/folio/versión sin exponer calificaciones ni descargas privadas.
- `SUPABASE_SERVICE_ROLE_KEY` solo en runtime servidor o scripts administrativos; nunca `NEXT_PUBLIC_*`.
- La Service Role se usa para gestión Auth del Superadmin; la autorización de la acción se valida previamente con sesión/rol.
- Security headers en `next.config.ts`.
- LOGIN/LOGOUT auditados con actor/rol derivados de sesión; LOGIN_FAILED no guarda correo, contraseña ni secretos.
- Errores hacia cliente no exponen SQL ni mensajes internos del proveedor.
- `anon` no tiene privilegios sobre tablas/vistas del dominio; solo puede ejecutar la verificación pública mínima de documentos.
- `authenticated` ve únicamente lo permitido por RLS; las escrituras críticas pasan por workflows RPC.
- Los helpers de identidad RLS exigen `profiles.is_active=true`, cortando acceso aunque exista un JWT previo no expirado.
- Bootstrap del primer Superadmin restringido a `service_role`, correo Auth confirmado y coincidencia exacta de identidad.
- Continuidad administrativa: no se puede desactivar/degradar al último Superadmin activo.

## Threat model

Se controlan Broken Access Control/IDOR, bypass RLS, role tampering, mass assignment, XSS, CSRF en operaciones sensibles, SQL injection, enumeración de documentos, exposición de secretos, replay/doble clic, idempotencia y concurrencia optimista.

## Evidencia ejecutada

- audit npm de producción: **0 vulnerabilidades**;
- seguridad estática: PASS sin CRÍTICO/ALTO;
- pgTAP/RLS y workflow académico: PASS;
- E2E autenticado por cuatro roles desktop/Android: PASS;
- backup/restore con revalidación RLS: PASS.

## Advisors Supabase

El linter sigue mostrando WARN para RPC `SECURITY DEFINER` deliberadamente disponibles a `authenticated` y para `verify_academic_document` deliberadamente pública. Son parte de la arquitectura: cada workflow mutador realiza autorización interna por rol/asignación y `anon` carece de DML de tablas.

Existe además un WARN operativo: **Leaked Password Protection Disabled**. Debe habilitarse en Auth antes de producción; no es una migración SQL y no se fuerza desde el código de la aplicación.

Los avisos `unused_index` son INFO en una base deliberadamente sin carga académica persistente; no se eliminan índices de integridad/consulta basándose en estadísticas de una base vacía.

## Aprovisionamiento demo

Las cuentas demo solo se permiten en Supabase local/controlado y generan contraseñas fuertes de una sola ocasión. No usar credenciales demo en producción.
