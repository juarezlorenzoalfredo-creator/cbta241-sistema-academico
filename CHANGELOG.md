# Changelog

## 1.0.0-rc.5 — certificación ejecutable — 2026-09-04

- `package-lock.json` real versionado y `npm ci` validado en GitHub Actions.
- Audit de dependencias de producción: **0 vulnerabilidades**.
- ESLint y TypeScript semántico completos: PASS.
- Vitest ampliado a **14/14 PASS**, incluyendo generación real de boleta semestral y reporte parcial PDF con QR, activos de prueba y paginación.
- `next build` de producción: PASS, 57 rutas.
- CI endurecido con Supabase local limpio, 27 migraciones, seed, pgTAP y cuentas Auth efímeras para los cuatro roles.
- Playwright autenticado de Alumno/Docente/Control Escolar/Superadmin en desktop Chromium y Android: PASS.
- Playwright público desktop/Android: PASS.
- Gate backup/restore reparado y certificado: backup lógico de datos de aplicación → reconstrucción por migraciones → restore → conteos → RLS/pgTAP.
- Documentación de despliegue corregida: `SUPABASE_SERVICE_ROLE_KEY` es server-only y sí es necesaria para las operaciones Superadmin que administran identidades Auth.
- Advisors Supabase re-auditados: WARN esperados de RPC `SECURITY DEFINER`, WARN operativo de leaked-password protection deshabilitada e INFO de índices sin uso por base sin carga persistente.

## 1.0.0-rc.5 — 2026-09-03

- Primer usuario Supabase Auth real confirmado y enlazado como `SUPERADMIN` en el proyecto dedicado, con perfil activo y evento de bootstrap auditado.
- Smoke RLS real del SUPERADMIN: `auth.uid()`, rol primario, lectura de perfiles, auditoría y configuración institucional validados bajo rol `authenticated`.
- Autoprotección del SUPERADMIN real: auto-desactivación y auto-degradación rechazadas en pruebas transaccionales.
- Migración `027_real_auth_superadmin_binding_guard`: el bootstrap exige correo Auth confirmado y coincidencia exacta entre identidad Auth y perfil solicitado.
- Suite `004_superadmin_bootstrap.sql` ampliada a 8/8 PASS.
- Contratos SQL estáticos ampliados a 40/40 PASS.

## 1.0.0-rc.4 — 2026-09-03

- Next.js y `eslint-config-next` actualizados a 16.3.4.
- Migraciones remotas ampliadas a `001`–`026`.
- Bootstrap seguro del primer Superadmin y continuidad administrativa.
- Corrección de revocación RLS por `profiles.is_active=false`.
- Índice de cobertura `grades_publication_context_idx`.

## 1.0.0-rc.3 — 2026-09-03

- Proyecto Supabase dedicado y validación real de PostgreSQL/RLS.
- pgTAP: 21/21 esquema, 22/22 RLS y 37/37 workflow académico/documental.
- Hardening de grants, permisos, publicación y seed.

## 1.0.0-rc.2 — 2026-09-03

- Exportación docente XLSX e historial.
- Auditoría de sesión, observabilidad y módulos Superadmin.
- Documentación de backup/restore y gates adicionales.

## 1.0.0-rc.1 — 2026-09-03

- Arquitectura AgroTech Académico CBTA 241.
- Auth/roles, paneles, P1/P2/P3, NP, riesgo, publicación, correcciones, extraordinario, RLS, PWA, PDF/QR/versionado, tests y CI inicial.
