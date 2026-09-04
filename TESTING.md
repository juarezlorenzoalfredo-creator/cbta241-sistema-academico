# Testing y gates

## Dominio y unitarios

`tests/grading.test.ts` cubre HALF_UP, NP, PENDIENTE, provisionales, riesgo, aprobado/reprobado, extraordinario, ventana de 72 horas, periodos y publicación. `tests/documents.test.ts` genera PDFs reales de boleta semestral y reporte parcial con activos PNG de prueba, QR y paginación.

Última certificación ejecutada: **14/14 tests Vitest PASS**.

## Aplicación

En GitHub Actions se verificó con dependencias reales:

- `npm ci` — PASS;
- `npm audit --omit=dev --audit-level=high` — **0 vulnerabilidades de producción**;
- ESLint — PASS;
- `tsc --noEmit` — PASS;
- `npm run verify:domain` — PASS;
- Vitest — **14/14 PASS**;
- seguridad estática — PASS, sin CRÍTICO/ALTO;
- contratos SQL estáticos — **40/40 PASS**;
- integridad de proyecto — **14/14 PASS**;
- accesibilidad estática — PASS;
- `next build` — PASS, 57 rutas.

## PostgreSQL / RLS

La suite reproducible levanta Supabase local desde cero, aplica migraciones `001`–`027`, ejecuta seed y corre pgTAP. Además, el proyecto Supabase dedicado fue validado previamente con:

- contratos de esquema base: **21/21 PASS**;
- RLS adversarial: **22/22 PASS**;
- revocación por perfil inactivo: **6/6 PASS**;
- bootstrap Superadmin: **8/8 PASS**;
- workflow académico/documental: **37/37 PASS**.

## E2E navegador

La certificación aprovisiona cuatro identidades Auth efímeras con contraseñas criptográficamente aleatorias y ejecuta Playwright en desktop Chromium y Android:

- Alumno entra a su portal y calificaciones publicadas;
- Docente entra a captura y exportación XLSX limitada a asignaciones visibles;
- Control Escolar entra a operación y documentos;
- Superadmin entra a seguridad y auditoría;
- rutas públicas, verificación inválida y redirección anónima se validan también en ambos perfiles de dispositivo.

Resultado: **PASS**.

## Backup / restore

El gate crea respaldo lógico de datos de `public`, destruye el origen local, reconstruye una base limpia mediante las 27 migraciones, restaura datos, compara conteos críticos, comprueba RLS y vuelve a ejecutar pgTAP. Resultado: **PASS**.

## Gate de release

No considerar certificable un commit si falla instalación reproducible, audit de dependencias, lint, typecheck, unit, seguridad, SQL, integridad, accesibilidad, build, pgTAP/RLS, E2E crítico o backup/restore.
