# QA Report — RC5

Fecha: 2026-09-03

## Código sin dependencias externas

- dominio: **9/9 PASS**;
- sintaxis TypeScript/TSX: **96 archivos / 0 errores**;
- seguridad estática: **PASS**, sin CRÍTICO/ALTO pendiente;
- contratos SQL estáticos: **40/40 PASS**;
- integridad de proyecto: **14/14 PASS**;
- accesibilidad estática: **PASS**, 81 controles con nombre accesible y 4 imágenes con `alt`;
- QA visual estructural existente: **PASS** en 390×844, 768×1024 y 1440×1000, sin overflow horizontal.

## Supabase/PostgreSQL real

Proyecto dedicado: `hwytxddwuffbcingovlg`.

- migraciones `001`–`027`: aplicadas;
- pgTAP disponible;
- esquema base: **21/21 PASS**;
- bootstrap SUPERADMIN endurecido: **8/8 PASS** (service role, email confirmado, email exacto, auditoría, unicidad y autoprotección);
- RLS adversarial base: suite de 22 tests reejecutada, último test **22 OK**;
- revocación de acceso con perfil inactivo: **6/6 PASS**;
- workflow académico/documental: **37/37 PASS** validado en RC3;
- seed: PASS dentro de rollback (32 alumnos, 6 materias, 192 calificaciones, 6 publication headers, 12 NP, 0 PUBLISHED sin publication context);
- buckets `academic-documents` y `institution-private`: privados;
- tipos TypeScript generables desde el esquema remoto: PASS;
- Performance Advisor: `unindexed_foreign_keys` sobre la FK compuesta de publicación fue corregido.


## Auth institucional RC5

Se verificó una identidad Auth real confirmada y enlazada como `SUPERADMIN`. Bajo contexto `authenticated`, `auth.uid()` resuelve al usuario institucional, `current_primary_role()` devuelve `SUPERADMIN` y las políticas RLS permiten únicamente el alcance administrativo esperado. Las pruebas transaccionales confirmaron que la cuenta no puede auto-desactivarse ni retirarse a sí misma el rol SUPERADMIN.

## Intento de typecheck sin dependencias

Existe `tsc` global, pero `tsc --noEmit` sobre toda la aplicación no se contabiliza como gate válido porque el sandbox carece de `node_modules`; los errores resultantes son principalmente módulos/tipos no resueltos (`next`, `react`, `@supabase/*`, `@playwright/test`, `vitest`, etc.). Por eso el gate semántico se mantiene pendiente y no se maquilla como PASS.

## Gates pendientes

- `package-lock.json` generado con resolución real npm;
- `npm ci`;
- ESLint instalado;
- `tsc --noEmit` con dependencias;
- Vitest del proyecto;
- `next build` verificable;
- Playwright web autenticado; `test:e2e:required` ya impide que credenciales ausentes conviertan el gate en falso PASS;
- Auth real permanente para DOCENTE, CONTROL_ESCOLAR y ALUMNO de prueba; SUPERADMIN institucional real ya está creado y enlazado;
- backup→restore.

## Estado

Backend académico y autorización RLS: **validación real fuerte**. Frontend: implementación RC con gates estáticos aprobados; certificación ejecutable completa todavía pendiente.
