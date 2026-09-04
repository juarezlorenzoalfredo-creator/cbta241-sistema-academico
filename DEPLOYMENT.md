# Despliegue

## Estado de release

`package-lock.json` está versionado y `npm ci` fue validado en CI. La aplicación puede ejecutarse localmente y en un entorno de staging con las variables correctas.

## Supabase

1. Usar el proyecto dedicado o un proyecto de staging limpio.
2. Aplicar únicamente migraciones versionadas `001`–`027`.
3. Ejecutar `supabase test db` y revisar pgTAP/RLS.
4. Confirmar privados los buckets `academic-documents` e `institution-private`.
5. Configurar SITE_URL y redirects Auth.
6. Deshabilitar signup público antes de producción.
7. Activar protección de contraseñas filtradas en Auth antes de producción.
8. Ejecutar una sola vez `npm run bootstrap:superadmin` cuando no exista ningún Superadmin.
9. Cargar firma y sello reales autorizados en `institution-private` y registrar sus rutas desde Superadmin.
10. Ejecutar ensayo de backup/restore conforme a `docs/BACKUP_RESTORE.md`.

## Variables web / Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `INSTITUTION_TIMEZONE`
- `DOCUMENT_VERIFICATION_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` **server-only**

La Service Role es necesaria para las operaciones de gestión de identidades Auth disponibles al Superadmin (crear/deshabilitar cuentas) y para scripts administrativos. Nunca debe usar prefijo `NEXT_PUBLIC_*`, imprimirse en logs ni quedar en Git.

## CI/CD

`.github/workflows/ci.yml` separa cuatro superficies críticas:

- aplicación: instalación reproducible, audit, lint, typecheck, dominio, unit, seguridad, SQL estático, integridad, accesibilidad y build;
- database-auth: Supabase local limpio, 27 migraciones, seed, pgTAP, cuatro identidades Auth efímeras y E2E autenticado desktop/Android;
- backup-restore: respaldo lógico de datos de aplicación, reconstrucción limpia, restore, conteos, RLS y pgTAP;
- e2e-public: navegación pública desktop/Android.

No promover un commit si cualquiera de estos jobs falla.

## Producción con datos reales

La certificación técnica no constituye autorización para cargar información real. Antes de producción deben completarse los controles operativos externos: Auth signup deshabilitado, protección de contraseñas filtradas activa, variables seguras del hosting, SITE_URL/redirects correctos, director/firma/sello autorizados y autorización expresa institucional.
