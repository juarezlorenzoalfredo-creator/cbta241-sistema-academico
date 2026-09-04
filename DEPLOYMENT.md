# Despliegue

## Prerrequisito de release

Generar y **versionar `package-lock.json`** en un entorno con acceso a npm antes de la promoción final. Después usar `npm ci`, no una resolución nueva de dependencias, para CI y producción.

## Supabase

1. Crear proyecto no productivo/staging.
2. Vincular Supabase CLI.
3. Ejecutar `supabase db reset` en local limpio o aplicar migraciones versionadas en staging.
4. Ejecutar `supabase test db` y revisar pgTAP/RLS.
5. Verificar buckets `academic-documents` e `institution-private` como privados.
6. Configurar URL del sitio/redirects de Auth.
7. Antes de cualquier otra cuenta, ejecutar una sola vez `npm run bootstrap:superadmin` con la Service Role en una terminal segura. Después aprovisionar cuentas mediante la interfaz Superadmin.
8. Deshabilitar signup público de Auth para producción y configurar redirects/SITE_URL.
9. Subir firma/sello reales a `institution-private` y registrar sus rutas mediante la interfaz Superadmin.
10. Ejecutar prueba de backup/restore conforme a `docs/BACKUP_RESTORE.md`.

## Vercel

Variables de runtime web:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `INSTITUTION_TIMEZONE`
- `DOCUMENT_VERIFICATION_SECRET`

`SUPABASE_SERVICE_ROLE_KEY` no es necesario para el runtime web normal. Se utiliza únicamente por scripts administrativos explícitos como aprovisionamiento de usuarios; si se configura en un entorno automatizado debe permanecer server-only con alcance mínimo.

## CI/CD

`.github/workflows/ci.yml` separa:

- gates de aplicación;
- PostgreSQL/pgTAP con Supabase CLI;
- E2E dependiente de app + database.

La rama de producción no debe aceptar una release si alguno de esos jobs críticos está rojo.

## Producción

No apuntar a datos reales hasta:

- lockfile versionado;
- migraciones/RLS auditadas en staging;
- E2E por rol aprobado;
- firma/sello institucionales autorizados;
- backup/restore probado;
- CI verde;
- autorización expresa de publicación.
