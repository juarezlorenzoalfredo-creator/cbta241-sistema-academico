# Testing y gates

## Unit / dominio

`tests/grading.test.ts` cubre HALF_UP, NP, PENDIENTE, provisionales, riesgo, aprobado/reprobado, extraordinario, 72 h, periodos y publicación. `npm run verify:domain`: **9/9 PASS**.

## Gates estáticos RC4

- `npm run test:syntax`: **PASS 96 TS/TSX / 0 errores sintácticos**.
- `npm run test:security`: **PASS**, sin CRÍTICO/ALTO estático pendiente.
- `npm run test:sql`: **31/31 PASS**.
- `npm run test:project`: **14/14 PASS**.
- `npm run test:a11y:static`: **PASS** (81 controles nombrados; 4 imágenes con `alt`).
- `npm run qa:static`: **PASS**.

## PostgreSQL / RLS real

Se instaló pgTAP y se ejecutaron las suites sobre el proyecto Supabase dedicado `hwytxddwuffbcingovlg`:

- contratos de esquema: **21/21 PASS**;
- RLS adversarial: **22/22 PASS**;
- workflow académico/documental integral: **37/37 PASS**.

El workflow integral cubre captura P1, publicación, idempotencia, corrección ≤72 h, rechazo de corrección directa >72 h, solicitud y aprobación de Control Escolar, P2=NP, P3, promedio ordinario, cierre de parciales, bloqueo de cierre con reprobación sin resolver, extraordinario único, captura/publicación extraordinaria, cierre semestral y documentos QR versionados/revocados. Todas las fixtures se ejecutaron en transacción con `ROLLBACK`.

## Seed

El seed de regresión fue probado en PostgreSQL real dentro de una transacción revertida: **32 estudiantes, 6 materias, 6 publicaciones, 192 calificaciones, 12 NP y 0 filas PUBLISHED sin contexto de publicación**.

## E2E web

Playwright contempla desktop Chromium y Pixel 7. Las pruebas autenticadas requieren cuentas Supabase Auth aisladas y dependencias npm instaladas. Este gate todavía no se marca PASS.

## Gate de release

No publicar si falla lint, typecheck, unit, security, SQL contracts, project audit, accesibilidad, build, E2E crítico o RLS/pgTAP. La lista completa está en `docs/RELEASE_CHECKLIST.md`.

`npm run qa:static` no sustituye `npm run qa`; `npm run test:syntax` tampoco sustituye el typecheck semántico completo.

## Gate E2E obligatorio de release

`npm run test:e2e` permite omitir journeys autenticados si no hay credenciales, útil durante desarrollo. La liberación usa `npm run test:e2e:required`, que primero ejecuta `scripts/assert-e2e-env.mjs` y falla si falta cualquier cuenta Alumno/Docente/Control Escolar/Superadmin. `npm run qa:release` combina gates de aplicación, pgTAP y este E2E obligatorio.

- Bootstrap inicial SUPERADMIN y continuidad: **6/6 PASS** en Supabase real.
