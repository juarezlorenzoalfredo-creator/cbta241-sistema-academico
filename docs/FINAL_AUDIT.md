# Auditoría técnica final — Sistema Académico Digital CBTA 241 — RC5

Fecha: 2026-09-04

## Conclusión técnica

La aplicación alcanzó **certificación ejecutable** después de completar los gates que anteriormente estaban pendientes. No hay hallazgos CRÍTICOS ni ALTOS abiertos en el código probado.

## Evidencia

- instalación reproducible `npm ci`: PASS;
- audit de dependencias de producción: **0 vulnerabilidades**;
- lint: PASS;
- TypeScript strict: PASS;
- dominio/unit: **14/14 PASS**;
- PDF oficial de prueba: PASS para boleta y reporte parcial con QR, firma/sello de prueba y paginación;
- seguridad estática: PASS;
- contratos SQL: **40/40 PASS**;
- integridad: **14/14 PASS**;
- accesibilidad estática: PASS;
- `next build`: PASS, 57 rutas;
- Supabase limpio con migraciones `001`–`027` + seed + pgTAP: PASS;
- E2E Auth de cuatro roles desktop/Android: PASS;
- E2E público desktop/Android: PASS;
- backup → rebuild → restore → conteos → RLS/pgTAP: PASS.

La ejecución integral de GitHub Actions `33876602498` cerró los cuatro jobs críticos (`app`, `database-auth`, `backup-restore`, `e2e-public`) en `success`.

## Hallazgos cerrados durante el desarrollo

- revocación incompleta de acceso con JWT residual;
- bootstrap inicial sin enlace Auth suficientemente fuerte;
- continuidad del último Superadmin;
- grants/DML implícitos;
- exposición accidental de funciones;
- integridad publicación-calificación;
- clocks de lifecycle en la misma transacción;
- casteo enum extraordinario;
- FK compuesta sin índice;
- seed con publicaciones sin contexto;
- dependencias vulnerables/transitivas;
- CI que podía omitir E2E autenticado;
- ensayo de restore inicialmente contaminado por objetos de Storage; corregido limitando el backup lógico a datos de aplicación y reconstruyendo infraestructura desde migraciones.

## Advisors / riesgos residuales

Los WARN de Supabase para RPC `SECURITY DEFINER` son esperados por diseño: las funciones mutadoras ejecutables por `authenticated` comprueban rol/asignación internamente y `anon` no posee DML de tablas. `verify_academic_document` es deliberadamente pública y minimizada.

Permanece un WARN **operativo** de Auth: Leaked Password Protection está deshabilitada en el proyecto remoto. Debe activarse antes de producción. Los avisos `unused_index` son INFO y se explican por la ausencia deliberada de carga académica persistente.

## Distinción ejecución / producción

La aplicación está técnicamente lista para ejecutarse. Esto no autoriza todavía carga de datos reales. Producción requiere configuración externa legítima: signup público deshabilitado, leaked-password protection activa, SITE_URL/redirects definitivos, secretos server-only en hosting, director/firma/sello autorizados y autorización institucional expresa.
