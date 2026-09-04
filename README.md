# Sistema Académico Digital CBTA 241

PWA institucional para el **Centro de Bachillerato Tecnológico Agropecuario No. 241**. Versión certificada ejecutable: **1.0.0-rc.5**. Implementa perfiles Alumno, Docente, Control Escolar y Superadmin; P1/P2/P3, NP, publicación atómica, correcciones de 72 horas, extraordinario único, historial, auditoría, documentos oficiales PDF versionados, verificación QR y exportación docente XLSX.

## Stack

- Next.js 16.3.4 / React 19.2.0 / TypeScript strict.
- Tailwind CSS 4.3.3 + tokens institucionales.
- Supabase Auth, PostgreSQL/RLS y Storage privado.
- Vitest, Playwright, pgTAP/Supabase CLI y GitHub Actions.

## Ejecución local

1. Instala Node.js 22 LTS, Docker Desktop y Supabase CLI.
2. Copia `.env.example` a `.env.local`.
3. Ejecuta `npm ci`.
4. Ejecuta `supabase start` y coloca URL, publishable/anon key y Service Role locales en `.env.local`.
5. Ejecuta `supabase db reset` para aplicar las 27 migraciones y el seed.
6. Para cuentas demo **solo en Supabase local**: `ALLOW_DEMO_USERS=true node scripts/provision-demo-users.mjs`. El script genera contraseñas fuertes de una sola ocasión si no se proporcionan overrides.
7. Ejecuta `npm run dev` y abre `http://localhost:3000`.

> `SUPABASE_SERVICE_ROLE_KEY` es server-only. La interfaz Superadmin la necesita para crear o deshabilitar identidades Auth; jamás debe exponerse como `NEXT_PUBLIC_*` ni incorporarse al repositorio.

## Certificación ejecutable

El commit de certificación previo al cierre de documentación superó en GitHub Actions:

- `npm ci` y `npm audit --omit=dev --audit-level=high` con **0 vulnerabilidades de producción**;
- ESLint y `tsc --noEmit`;
- Vitest **14/14 PASS**, incluyendo cálculo académico y generación real de PDF con QR/firma/sello de prueba;
- seguridad estática, contratos SQL **40/40**, integridad **14/14** y accesibilidad estática;
- `next build` de producción, **57 rutas** generadas/validadas;
- Supabase local desde cero con migraciones `001`–`027`, seed y pgTAP;
- E2E autenticado de los cuatro roles en Chromium desktop y Android;
- E2E público en Chromium desktop y Android;
- ensayo backup → destrucción → reconstrucción por migraciones → restore → comparación de conteos → RLS/pgTAP.

El workflow de CI vuelve a ejecutar estos gates para cualquier cambio en `main`, `develop`, `feat/**`, `fix/**` o `security/**`.

## Reglas académicas

- Tres parciales con el mismo peso.
- Escala 0.0–10.0, una decimal y `ROUND HALF UP`.
- Aprobación mínima 6.0.
- `NP` se muestra como `NP` y computa 0.0; `PENDIENTE` es distinto y bloquea publicación normal.
- Publicación por asignación + parcial, transaccional e idempotente.
- Corrección docente hasta 72 horas desde `published_at` de servidor.
- Después de 72 horas: solicitud y resolución por Control Escolar con motivo.
- Una sola oportunidad extraordinaria por inscripción-materia; no es P4 y conserva el ordinario.

## Seguridad

La aplicación usa **DENY BY DEFAULT**. Alumno y Docente se derivan desde `auth.uid()`; las autorizaciones no confían en IDs enviados por navegador. Las mutaciones críticas se realizan por RPC con autorización interna, auditoría y RLS. PDFs, firma y sello viven en buckets privados; la verificación QR pública devuelve únicamente metadatos mínimos.

Antes de usar datos reales deben configurarse en Supabase/Vercel las variables server-only, deshabilitar signup público, activar protección de contraseñas filtradas, definir SITE_URL/redirects, cargar firma/sello reales autorizados y obtener autorización expresa institucional para producción.

## Documentación

Consulta `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `TESTING.md`, `DEPLOYMENT.md`, `CHANGELOG.md`, `docs/QA_REPORT.md`, `docs/FINAL_AUDIT.md`, `docs/RELEASE_CHECKLIST.md`, `docs/SUPABASE_VALIDATION.md` y `docs/BACKUP_RESTORE.md`.
