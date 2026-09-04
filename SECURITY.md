# Seguridad

## Modelo

**DENY BY DEFAULT** y defensa en profundidad: UI + servidor + RLS + constraints + Storage.

## Controles principales

- RLS habilitado y forzado en tablas sensibles.
- Sin DML directo para calificaciones, publicaciones, correcciones, extraordinarios o auditoría; se mutan por RPC autorizadas.
- Helpers `SECURITY DEFINER` con `search_path` explícito.
- `EXECUTE` por defecto de `PUBLIC` revocado; además se endurecieron `ALTER DEFAULT PRIVILEGES` para que objetos futuros no reaparezcan con permisos implícitos. Solo se conceden workflows explícitos.
- Alumno derivado desde `auth.uid() → students.profile_id`.
- Docente derivado desde `auth.uid() → teachers.profile_id → teacher_assignments`.
- No se confía en `teacher_id`, `student_id`, `group_id` o UUID enviados desde navegador como autorización.
- Firma/sello y PDFs en buckets privados.
- Página QR devuelve datos mínimos, nunca calificaciones ni descarga privada.
- Service Role solo en scripts administrativos server-side; nunca `NEXT_PUBLIC_*`.
- Security headers en `next.config.ts`.
- LOGIN/LOGOUT exitosos se auditan mediante RPC con actor/rol derivados de la sesión.
- LOGIN_FAILED se registra en observabilidad estructurada sin almacenar correo, contraseña ni secretos.
- Respuestas de error hacia cliente no exponen SQL ni mensajes internos del proveedor.
- `anon` no tiene privilegios sobre tablas/vistas del dominio; únicamente puede ejecutar la verificación pública mínima de documentos.
- `authenticated` tiene `SELECT` de dominio según RLS y solo dos mutaciones columnares directas deliberadas: `profiles.display_name` propio y `notifications.read_at` propio; el resto de escrituras críticas son RPC.
- Los helpers de identidad RLS (`current_student_id`, `current_teacher_id`, `current_primary_role`) exigen un perfil activo; desactivar una cuenta corta acceso DB aun si un JWT anterior no ha expirado.
- El primer Superadmin se enlaza mediante una RPC exclusiva de `service_role`; navegador y usuarios autenticados no pueden ejecutarla.
- El sistema impide dejar la operación sin un Superadmin activo.

## Threat model

Se controlan IDOR, Broken Access Control, RLS bypass, role tampering, mass assignment, XSS, CSRF de operaciones sensibles, SQL injection, enumeración de documentos, fugas de secretos, doble clic/retry y concurrencia.

## Continuidad

Ver `docs/BACKUP_RESTORE.md`. La recuperación debe probar RLS, integridad, Storage privado y hashes documentales; un dump sin restauración verificada no se considera backup suficiente.

## Obligación operativa

RLS/pgTAP ya fue ejecutado contra PostgreSQL Supabase real (21/21 contratos base, suite adversarial de 22 tests y 37/37 workflow). RC4 añadió además 6/6 comprobaciones de revocación inmediata por `profiles.is_active=false`. Antes de producción todavía debe ejecutarse E2E web con cuentas Auth reales de prueba aisladas y el build completo de Next.js. Rotar cualquier secreto que haya sido expuesto accidentalmente.

## Aprovisionamiento de demostración

- El aprovisionamiento demo no contiene contraseñas predecibles: genera credenciales fuertes o recibe overrides explícitos por entorno.
- Está restringido a Supabase local salvo confirmación explícita de entorno no productivo.

## Auditoría Supabase RC4

Después del despliegue de migraciones se revisaron grants, RLS, Storage y advisors. Los avisos restantes del linter sobre `SECURITY DEFINER` corresponden a RPC deliberadamente expuestas a `authenticated` que realizan autorización interna por rol/asignación, y a `verify_academic_document` deliberadamente pública; no existe DML anónimo sobre tablas del dominio.
