# Changelog

## 1.0.0-rc.5 — 2026-09-03

- Primer usuario Supabase Auth real confirmado y enlazado como `SUPERADMIN` en el proyecto dedicado, con perfil activo y evento de bootstrap auditado.
- Smoke RLS real del SUPERADMIN: `auth.uid()`, rol primario, lectura de perfiles, auditoría y configuración institucional validados bajo rol `authenticated`.
- Autoprotección del SUPERADMIN real: auto-desactivación y auto-degradación rechazadas en pruebas transaccionales.
- Migración `027_real_auth_superadmin_binding_guard`: el bootstrap exige correo Auth confirmado y coincidencia exacta entre identidad Auth y perfil solicitado.
- Suite `004_superadmin_bootstrap.sql` ampliada a **8/8 PASS**, incluyendo rechazo de correo no confirmado y correo inconsistente.
- Contratos SQL estáticos ampliados a **40/40 PASS**.
- `qa:static` completo reejecutado tras el enlace Auth real: dominio 9/9, 96 TS/TSX sin error sintáctico, seguridad PASS, SQL 40/40, proyecto 14/14 y accesibilidad PASS.

## 1.0.0-rc.4 — 2026-09-03

- Next.js y `eslint-config-next` actualizados a **16.3.4**.
- Migraciones remotas ampliadas a `001`–`026`.
- Bootstrap seguro del primer Superadmin: RPC exclusiva de `service_role`, auditoría y cleanup de Auth en caso de fallo.
- Continuidad administrativa: defensa para no desactivar ni retirar el último Superadmin activo.
- Corrección de seguridad RLS: `current_student_id`, `current_teacher_id` y `current_primary_role` ahora exigen `profiles.is_active=true`, revocando acceso aun con JWT residual.
- Prueba real específica de revocación: **6/6 PASS** en Supabase.
- Suite RLS base actualizada para usar usuarios `auth.users` transaccionales en lugar de deshabilitar triggers FK.
- Supabase Performance Advisor: corregida FK compuesta sin índice con `grades_publication_context_idx`.
- Contratos SQL estáticos ampliados a **38/38 PASS**.
- Prioridad de portal alineada con rol primario: SUPERADMIN antes de los demás roles.

## 1.0.0-rc.3 — 2026-09-03

- Proyecto Supabase dedicado creado y migraciones `001`–`022` validadas sobre PostgreSQL real.
- pgTAP real: **21/21** contratos de esquema, **22/22** RLS adversarial y **37/37** workflow académico/documental.
- Hardening de permisos: `anon` sin DML/tablas; `authenticated` read-only de dominio salvo `display_name` propio y `read_at` propio; escrituras críticas solo por RPC.
- Default privileges endurecidos para impedir que nuevos objetos hereden grants amplios.
- Integridad publicación-calificación reforzada con FK compuesta y estado PUBLISHED/DRAFT consistente.
- Corrección de lifecycle de parciales con `clock_timestamp()` para evitar timestamps iguales en una misma transacción.
- Corrección del publish extraordinario con casteo explícito a `extraordinary_state`.
- Desactivación/sustitución docente endurecida para preservar `active_until > active_from`.
- Seed actualizado y validado: 32 alumnos, 6 materias, 6 publicaciones, 192 calificaciones, 12 NP y 0 publicaciones sin contexto.
- Tipos TypeScript generados correctamente desde el esquema Supabase como validación adicional del contrato PostgREST.
- Gate SQL estático ampliado a **31/31 PASS**.

## 1.0.0-rc.2 — 2026-09-03

- Exportación docente XLSX con calificaciones, borradores claramente marcados e historial auditable de cambios.
- Auditoría de sesión LOGIN/LOGOUT con actor y rol derivados desde `auth.uid()`.
- Observabilidad de LOGIN_FAILED sin almacenar correo ni contraseña.
- Nuevas vistas Superadmin de auditoría global y estado de seguridad.
- Migración 013 y ampliación de contratos SQL/pgTAP para sesión auditada.
- Documentación de backup/restore, checklist de release y auditoría final.
- Actualización de gates: SQL contracts 26/26; project integrity 14/14; accesibilidad estática PASS.
- Iconos PWA reales 192/512/maskable y verificación automática de dimensiones.
- Estados globales loading/error/not-found y hardening adicional de errores en descargas/reportes.

## 1.0.0-rc.1 — 2026-09-03

- Arquitectura AgroTech Académico CBTA 241.
- Auth/roles y paneles Alumno, Docente, Control Escolar, Superadmin.
- Modelo académico histórico con P1/P2/P3, NP, riesgo y HALF_UP.
- Captura docente optimizada y pegado controlado.
- Publicación atómica e idempotente.
- Correcciones directas 72 h + solicitudes posteriores.
- Extraordinario único independiente del ordinario.
- RLS deny-by-default y workflows RPC auditados.
- PWA con cache restrictivo.
- PDF/QR/versionado documental y Storage privado.
- Tests unitarios, E2E, SQL contract y auditoría estática.
- CI GitHub Actions y documentación operativa.

- Endurecimiento adicional: el aprovisionamiento demo ya no contiene contraseñas predecibles en el repositorio; genera credenciales fuertes o acepta overrides explícitos de entorno.
- Hardening PWA: el registro del Service Worker se movió a un componente cliente sin `dangerouslySetInnerHTML`.
- Se agregó `npm run qa:static` como gate reproducible cuando el entorno no puede instalar dependencias.
- Se formalizó `npm run test:syntax` como evidencia reproducible de parseo TS/TSX.
