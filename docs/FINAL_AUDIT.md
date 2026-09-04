# Auditoría técnica — Release Candidate 1.0.0-rc.5

Fecha: 2026-09-03

## CRÍTICO

Ningún hallazgo crítico pendiente en los gates ejecutados.

### Hallazgo crítico cerrado en RC4

**Revocación incompleta de acceso con JWT aún válido.** `current_student_id()` y `current_teacher_id()` validaban el estado académico de alumno/docente, pero no exigían que `profiles.is_active` siguiera activo. Una cuenta desactivada podía conservar visibilidad RLS mientras su JWT previo permaneciera criptográficamente válido. Se corrigió en migración `025_inactive_profile_rls_revocation.sql` y se verificó en Supabase real con seis aserciones: identidades activas visibles, identidades inactivas nulas y lectura académica anulada para alumno y docente.

## ALTO

## Hallazgo alto cerrado en RC5

**Confianza excesiva en parámetros del bootstrap inicial.** La RPC original verificaba la existencia del UUID Auth, pero aceptaba el correo recibido como parámetro sin exigir que coincidiera con `auth.users.email` ni que el correo estuviera confirmado. La migración `027_real_auth_superadmin_binding_guard.sql` ahora exige ambas condiciones antes de crear el perfil o el rol. La suite pgTAP correspondiente pasó **8/8**.


Ningún hallazgo alto pendiente en los controles ejecutados.

### Hallazgos altos/operativos cerrados RC4

1. El primer Superadmin carecía de un bootstrap transaccional y auditable. Se agregó una RPC `service_role`-only y un script que elimina el usuario Auth automáticamente si falla el enlace de base de datos.
2. Se añadió defensa para impedir desactivar o retirar el último Superadmin activo.
3. Supabase Performance Advisor detectó una FK compuesta sin índice de cobertura en `grades`. Se agregó `grades_publication_context_idx`; el aviso `unindexed_foreign_keys` desapareció.
4. Se alineó la prioridad de `homeForRoles()` con `current_primary_role()` (`SUPERADMIN → CONTROL_ESCOLAR → DOCENTE → ALUMNO`).

## Hallazgos runtime cerrados en RC3 y conservados

- grants DML implícitos de Supabase;
- exposición accidental de `SECURITY DEFINER`;
- timestamps iguales en lifecycle dentro de una transacción;
- casteo enum en publicación extraordinaria;
- integridad entre `grades` y `grade_publications`;
- seed antiguo con publicaciones sin contexto.

## Evidencia RC4

- Dominio: **9/9 PASS**.
- TS/TSX parseable: **96 archivos / 0 errores sintácticos**.
- Seguridad estática: **PASS**.
- Contratos SQL estáticos: **40/40 PASS**.
- Integridad de proyecto: **14/14 PASS**.
- Accesibilidad estática: **PASS**.
- PostgreSQL schema contracts base: **21/21 PASS**; bootstrap ampliado validado hasta aserción 24.
- PostgreSQL RLS adversarial: suite reejecutada tras RC4 y llegó a **test 22 OK**; prueba específica de revocación por perfil inactivo **6/6 PASS**.
- PostgreSQL workflow académico/documental: **37/37 PASS** de RC3; las migraciones RC4 no modifican sus reglas académicas.
- Storage privado/policies: **PASS**.
- Proyecto remoto limpio después de pruebas transaccionales: **PASS**.
- Performance Advisor: FK compuesta sin índice **RESUELTA**.

## Dependencias

RC4 fija `next` y `eslint-config-next` en **16.3.4**, versión estable confirmada en el registro npm al preparar esta RC.

## Bloqueos de certificación final

1. Este sandbox continúa sin resolver `registry.npmjs.org`, por lo que no existe todavía evidencia local de `npm ci`, lockfile final, `next build`, ESLint instalado, Vitest instalado ni Playwright real.
2. El SUPERADMIN institucional real ya existe y está enlazado. Faltan identidades Auth de prueba para DOCENTE, CONTROL_ESCOLAR y ALUMNO para completar E2E multirol sin utilizar datos reales.
3. Falta E2E web autenticado por los cuatro roles.
4. Falta backup→restore en un entorno aislado.
5. Director, firma y sello reales siguen siendo requisitos institucionales antes de emitir documentos oficiales.

## Conclusión

La RC5 incorpora una identidad Auth institucional real confirmada y enlazada como SUPERADMIN, refuerza el bootstrap para exigir identidad confirmada y email exacto, y conserva el corte inmediato de identidad RLS al desactivar cuentas. El backend está validado sobre Supabase real; la aplicación aún no se etiqueta como producción certificada hasta completar build, E2E multirol y recuperación.

- Bootstrap SUPERADMIN runtime: **6/6 PASS** en transacción revertida; creación inicial, rol, auditoría, unicidad y auto-protección verificadas.
