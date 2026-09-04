# QA Report — Certificación ejecutable RC5

Fecha: 2026-09-04

## Resultado global

**PASS técnico para ejecución.** La aplicación fue instalada, compilada, probada con Auth multirol, PostgreSQL/RLS, navegador desktop/Android y recuperación de datos.

## Aplicación

- `npm ci`: PASS.
- `npm audit --omit=dev --audit-level=high`: PASS, **0 vulnerabilidades de producción**.
- ESLint: PASS.
- TypeScript `tsc --noEmit`: PASS.
- Dominio: PASS.
- Vitest: **14/14 PASS**.
- Seguridad estática: PASS, sin CRÍTICO/ALTO.
- Contratos SQL estáticos: **40/40 PASS**.
- Integridad: **14/14 PASS**.
- Accesibilidad estática: PASS.
- `next build`: PASS; 57 rutas.
- PDFs: boleta semestral y reporte parcial generados y parseados en tests, incluyendo paginación, QR y activos de firma/sello de prueba.

## Supabase/PostgreSQL

Proyecto dedicado remoto: `hwytxddwuffbcingovlg`.

- migraciones `001`–`027`: aplicadas;
- schema base: **21/21 PASS**;
- RLS adversarial: **22/22 PASS**;
- revocación por perfil inactivo: **6/6 PASS**;
- bootstrap Superadmin: **8/8 PASS**;
- workflow académico/documental: **37/37 PASS**;
- seed estricto: PASS en transacción/entorno aislado;
- buckets `academic-documents` e `institution-private`: privados;
- FK compuesta de publicación con índice de cobertura.

## Auth + E2E

En CI se levantó Supabase local limpio, se crearon cuatro identidades Auth efímeras (Alumno, Docente, Control Escolar, Superadmin) con contraseñas aleatorias y se ejecutaron journeys autenticados en Chromium desktop y Android. Resultado: **PASS**. Las pruebas públicas también pasaron en ambos perfiles de dispositivo.

## Recuperación

Backup lógico de datos de aplicación → eliminación del origen → reconstrucción por migraciones → restore → comparación de conteos → comprobación RLS → pgTAP: **PASS**.

## Advisors finales

- Seguridad: WARN esperados para RPC `SECURITY DEFINER` intencionales y un WARN operativo por protección de contraseñas filtradas deshabilitada.
- Performance: solo INFO `unused_index` debido a base sin carga académica persistente; no se eliminan preventivamente.

## Condiciones externas para producción real

No son defectos del ejecutable, pero deben completarse antes de usar datos reales: deshabilitar signup público, activar leaked-password protection, configurar SITE_URL/redirects, variables server-only del hosting, director/firma/sello reales autorizados y autorización institucional expresa.
