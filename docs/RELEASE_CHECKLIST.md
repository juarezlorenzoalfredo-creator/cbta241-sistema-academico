# Release checklist — Sistema Académico Digital CBTA 241 — RC5 certificado

## Código

- [x] `package-lock.json` versionado.
- [x] `npm ci`.
- [x] audit npm de producción — 0 vulnerabilidades.
- [x] ESLint.
- [x] TypeScript `tsc --noEmit`.
- [x] dominio.
- [x] Vitest — 14/14.
- [x] seguridad estática.
- [x] contratos SQL — 40/40.
- [x] integridad — 14/14.
- [x] accesibilidad estática.
- [x] `next build` — 57 rutas.
- [x] generación PDF boleta/parcial con QR y paginación en tests.

## PostgreSQL / Supabase

- [x] migraciones `001`–`027`.
- [x] schema pgTAP base — 21/21.
- [x] RLS adversarial — 22/22.
- [x] revocación por perfil inactivo — 6/6.
- [x] bootstrap Superadmin — 8/8.
- [x] workflow académico/documental — 37/37.
- [x] seed estricto.
- [x] Storage académico privado.
- [x] Storage institucional privado.
- [x] índice FK compuesta de publicación.

## Auth / navegador

- [x] cuentas Auth efímeras aisladas para los cuatro roles.
- [x] E2E Alumno desktop + Android.
- [x] E2E Docente desktop + Android.
- [x] E2E Control Escolar desktop + Android.
- [x] E2E Superadmin desktop + Android.
- [x] E2E público desktop + Android.

## Continuidad

- [x] backup lógico de datos de aplicación.
- [x] reconstrucción desde cero mediante migraciones.
- [x] restore y comparación de conteos.
- [x] RLS + pgTAP después del restore.

## Operación de producción con datos reales

- [ ] deshabilitar signup público de Auth en el proyecto objetivo.
- [ ] activar Leaked Password Protection en Auth.
- [ ] configurar SITE_URL y redirects definitivos.
- [ ] configurar variables Vercel/hosting, incluida `SUPABASE_SERVICE_ROLE_KEY` solo server-side.
- [ ] director configurado.
- [ ] firma real privada autorizada.
- [ ] sello real privado autorizado.
- [ ] autorización expresa institucional para datos reales/publicación.

Los elementos pendientes de esta última sección son controles operativos externos. El código y su entorno de prueba están certificados para ejecución; no se deben sustituir esos controles con valores inventados.
