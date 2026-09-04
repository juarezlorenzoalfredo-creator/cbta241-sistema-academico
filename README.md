# Sistema Académico Digital CBTA 241

PWA institucional para el **Centro de Bachillerato Tecnológico Agropecuario No. 241**. Release Candidate actual: **1.0.0-rc.4**. Implementa alumnos, docentes, Control Escolar y Superadmin; P1/P2/P3, NP, publicación atómica, correcciones de 72 horas, extraordinario único, historial, auditoría, boletas PDF versionadas, verificación QR y exportación docente XLSX con historial de cambios.

## Stack fijado

- Next.js 16.3.4 / React 19.2.0 / TypeScript strict.
- Tailwind CSS 4.3.3 + tokens CSS institucionales.
- Supabase Auth, PostgreSQL/RLS y Storage privado.
- Vitest, Playwright, pgTAP/Supabase CLI y GitHub Actions.

## Ejecución local

1. Instala Node.js 22 LTS o compatible (`>=20`).
2. Instala Docker Desktop y Supabase CLI para el entorno local de base de datos.
3. Copia `.env.example` a `.env.local`.
4. Ejecuta `supabase start` y copia URL/anon/service-role locales a `.env.local` (Service Role se usa solo en scripts administrativos server-side).
5. Ejecuta `supabase db reset` para migraciones + seed.
6. Para cuentas demo **solo en Supabase local**: `ALLOW_DEMO_USERS=true node scripts/provision-demo-users.mjs`. El script genera contraseñas fuertes de una sola ocasión y las muestra únicamente en la terminal; puedes definir `DEMO_*_PASSWORD` solo para pruebas controladas.
7. Ejecuta `npm install` y `npm run dev`.
8. Abre `http://localhost:3000`.

> En producción no uses las contraseñas demo. `enable_signup=false`: las cuentas se aprovisionan de forma administrativa.

## Gates de calidad

```bash
npm run lint
npm run typecheck
npm run test
npm run test:security
npm run test:sql
npm run test:project
npm run test:a11y:static
npm run build
npm run test:e2e
supabase test db
```

`npm run qa:static` agrupa los gates reproducibles sin dependencias externas; `npm run qa` ejecuta lint/typecheck/unit/security/SQL/project/a11y/build; `npm run qa:release` añade pgTAP y E2E autenticado obligatorio. `test:e2e:required` falla si falta cualquiera de las ocho variables de credenciales por rol, evitando un falso verde por tests omitidos.

## Reglas académicas implementadas

- Tres parciales con el mismo peso.
- Escala 0.0–10.0 con una decimal.
- `ROUND HALF UP` a una decimal.
- Aprobación mínima 6.0.
- `NP` se presenta como `NP` y computa 0.0.
- `PENDIENTE` nunca equivale a NP y bloquea publicación normal.
- Publicación por asignación + parcial en una transacción todo/nada.
- Corrección docente hasta 72 horas desde `published_at` de servidor.
- Después de 72 horas: solicitud y resolución de Control Escolar con motivo.
- Una sola evaluación extraordinaria por inscripción-materia; no es P4.
- El ordinario se conserva aunque exista extraordinario.

## Seguridad

La aplicación usa `DENY BY DEFAULT`. Los estudiantes solo ven su información publicada; los docentes se autorizan desde la asignación vigente y nunca desde IDs enviados por navegador. Las mutaciones académicas críticas se realizan mediante RPC de PostgreSQL auditables; las tablas sensibles no otorgan DML directo a `authenticated`.

Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` como `NEXT_PUBLIC_*`.


## Evidencia de base de datos real — RC4

La RC4 fue validada contra un proyecto Supabase dedicado y limpio (`hwytxddwuffbcingovlg`):

- esquema/contratos pgTAP base: **21/21 PASS** y bootstrap `service_role` validado;
- RLS adversarial: suite de **22 tests** reejecutada; adicionalmente, revocación por perfil inactivo **6/6 PASS**;
- workflow académico/documental E2E en PostgreSQL: **37/37 PASS**;
- seed de demostración: **192 calificaciones / 6 publicaciones / 0 publicaciones sin contexto** dentro de transacción rollback;
- buckets `academic-documents` e `institution-private`: **privados** y con políticas verificadas.

Las pruebas runtime de PostgreSQL se ejecutaron contra Supabase real y se revirtieron al finalizar, por lo que el proyecto validado permanece sin datos académicos de prueba persistentes. Las migraciones remotas llegan a `001`–`026`. El build Next.js/Vitest/Playwright completo sigue sujeto a un entorno que pueda descargar dependencias npm.

## Bootstrap inicial de SUPERADMIN

El primer Superadmin se crea una sola vez con `npm run bootstrap:superadmin`. Requiere `SUPABASE_SERVICE_ROLE_KEY` únicamente en servidor/terminal, `BOOTSTRAP_SUPERADMIN_EMAIL` y `BOOTSTRAP_SUPERADMIN_NAME`; la contraseña puede suministrarse por entorno o generarse criptográficamente. La RPC correspondiente rechaza `anon` y `authenticated`, y el script elimina el usuario Auth si el enlace transaccional de perfil/rol falla.

## Boletas oficiales

La emisión oficial exige en `institution_settings`:

- `director_name`;
- `director_signature_storage_path` en bucket privado `institution-private`;
- `institutional_seal_storage_path` en el mismo bucket.

Sin firma y sello reales, el sistema **bloquea** la emisión oficial. No fabrica activos institucionales.

## Documentación

Consulta `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `TESTING.md`, `DEPLOYMENT.md`, `CHANGELOG.md`, `docs/QA_REPORT.md`, `docs/FINAL_AUDIT.md`, `docs/RELEASE_CHECKLIST.md`, `docs/SUPABASE_VALIDATION.md` y `docs/BACKUP_RESTORE.md`.
