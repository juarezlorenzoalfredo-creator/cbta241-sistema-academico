# Base de datos

## Migraciones versionadas

La RC4 contiene una cadena reproducible `001`–`026`:

1. `001_core_schema.sql`: modelo académico, constraints, índices, workflows base, auditoría y RLS.
2. `002_storage_and_verification.sql`: buckets privados, políticas Storage y verificación pública mínima.
3. `003_admin_workflows_and_hardening.sql`: workflows administrativos y grants explícitos.
4. `004_document_workflows.sql`: registro, sustitución y revocación documental.
5. `005_operational_hardening.sql`: cierre académico, notificaciones y configuración institucional.
6. `006_user_access_workflows.sql`: vinculación auditable Auth ↔ perfiles académicos.
7. `007_partial_document_scope.sql`: alcance por parcial y versionado de reportes.
8. `008_document_version_integrity_and_close_gate.sql`: token por versión y gate de cierre.
9. `009_sensitive_metadata_and_document_access_hardening.sql`: minimización de metadatos y documentos vigentes.
10. `010_people_status_and_assignment_substitution.sql`: baja/reactivación y sustitución docente histórica.
11. `011_student_average_minimization.sql`: promedio ordinario oculto al alumno hasta P3.
12. `012_extraordinary_eligibility_and_student_privacy.sql`: elegibilidad completa y privacidad extraordinaria.
13. `013_session_audit_workflow.sql`: auditoría LOGIN/LOGOUT derivada de `auth.uid()`.
14. `014_security_advisor_hardening.sql`: `search_path`, `EXECUTE` y grants mínimos de RPC.
15. `015_rls_and_performance_hardening.sql`: índices FK y políticas RLS optimizadas.
16. `016_pgtap_test_support.sql`: pgTAP en esquema `extensions`.
17. `017_direct_dml_and_assignment_lifecycle_hardening.sql`: DML crítico solo por RPC y cierre seguro de sustituciones.
18. `018_default_privilege_hardening.sql`: evita grants implícitos futuros a `anon`/`authenticated`.
19. `019_publication_and_audit_integrity.sql`: vínculo fuerte calificación↔publicación y auditoría no escribible por cliente.
20. `020_evaluation_period_lifecycle_clock_hardening.sql`: cierre de parcial con reloj no estable de transacción.
21. `021_extraordinary_publish_enum_hardening.sql`: transición extraordinaria con enum explícito.
22. `022_teacher_deactivation_clock_hardening.sql`: desactivación docente preservando `active_until > active_from`.
23. `023_first_superadmin_bootstrap.sql`: bootstrap inicial de SUPERADMIN restringido exclusivamente a `service_role`, una sola vez y auditado.
24. `024_superadmin_continuity_guard.sql`: impide desactivar o degradar al último SUPERADMIN activo.
25. `025_inactive_profile_rls_revocation.sql`: una cuenta desactivada deja de resolver rol/identidad académica incluso con un JWT aún no expirado.
26. `026_publication_context_fk_index.sql`: índice de cobertura para la FK compuesta calificación↔publicación.

> En el proyecto Supabase de validación las migraciones iniciales se aplicaron mediante Management API y por ello su historial remoto usa versiones temporales generadas por Supabase. El contenido fuente de esta RC es la referencia reproducible para instalaciones nuevas.

## Integridad

- UUID internos.
- FK/NOT NULL/UNIQUE/CHECK en PostgreSQL.
- `grades`: NUMERIC exige 0–10; NP/PENDING no admiten `numeric_grade`.
- Un `PUBLISHED` exige `published_at`, `published_by` y `publication_id`; un `DRAFT` exige que los tres sean `NULL`.
- `publication_id + assignment_id + evaluation_period_id` está ligado por FK compuesta a la cabecera real de publicación.
- `grade_publications.row_count = numeric_count + np_count`.
- Extraordinario: una fila por `student_subject_enrollment_id`.
- Periodo actual: índice parcial único.
- Asignación responsable: índice parcial único materia+grupo+periodo para `is_active=true`.
- Documentos: versiones inmutables, SHA-256 y token único por versión.

## Historial

`students` no tiene un semestre mutable que borre historia. La trayectoria es:

`student → enrollment → academic_period/semester/group → student_subject_enrollment → grades`.

Las sustituciones docentes cierran la asignación anterior y crean una nueva; nunca reasignan retrospectivamente autoría histórica.

## Tiempo

Los eventos normales usan `timestamptz` del servidor. En transiciones donde dos marcas pueden ocurrir dentro de la misma transacción se usa `clock_timestamp()` y un margen mínimo de 1 microsegundo para cumplir invariantes estrictas como `closes_at > opens_at` y `active_until > active_from`. La zona institucional solo afecta presentación.

## Evidencia PostgreSQL real

Proyecto de validación dedicado: `hwytxddwuffbcingovlg`.

- `001_schema_contracts.sql`: **24/24 PASS** (21 contratos base + 3 contratos del bootstrap SUPERADMIN).
- `002_rls_adversarial.sql`: **22/22 PASS**; adicionalmente, revocación por perfil inactivo **6/6 PASS**.
- `003_academic_workflow_e2e.sql`: **37/37 PASS**.
- `004_superadmin_bootstrap.sql`: **6/6 PASS** sobre bootstrap, unicidad, auditoría y continuidad del SUPERADMIN.
- Seed actualizado: **32 alumnos, 6 materias, 6 publicaciones, 192 calificaciones, 12 NP, 0 publicadas sin contexto**; probado dentro de transacción y revertido.

Las pruebas cubren Alumno A→B, Docente A→Asignación B, publicación atómica/idempotente, corrección antes/después de 72 h, NP=0, extraordinario único, cierre semestral y documentos VIGENTE→SUSTITUIDO→REVOCADO.
