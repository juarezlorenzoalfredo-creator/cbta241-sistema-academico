# Arquitectura

## Principio

`Presentation → Application/Workflows → Domain → Data Access → PostgreSQL/Supabase`.

El frontend nunca es la fuente de autorización. Las reglas académicas puras viven en `lib/domain`; workflows críticos y tiempo oficial viven en PostgreSQL. Server Components consultan; Route Handlers y Server Actions orquestan; RLS constituye la última frontera de acceso.

## Dominios

- **Identity**: Auth, perfiles, roles y ciclo LOGIN/LOGOUT auditado.
- **Academic Catalog**: periodos, semestres, grupos, materias, alumnos, docentes.
- **Enrollment**: inscripción histórica y materias del alumno.
- **Assignments**: responsabilidad docente por materia/grupo/periodo y sustitución histórica.
- **Grading**: P1/P2/P3, NP, borrador, riesgo y publicación.
- **Corrections**: 72 h + solicitudes posteriores.
- **Extraordinary**: evaluación independiente, única e histórica.
- **Documents**: PDF, versión, hash, QR y Storage privado.
- **Reporting**: CSV/XLSX docente restringido por asignación; XLSX incluye historial y borradores marcados.
- **Audit**: eventos críticos append-only, request_id y observabilidad segura.

## Idempotencia y concurrencia

- Publicaciones: `idempotency_key UNIQUE` + transacción RPC.
- Entidades editables: columna `version`, locks `FOR UPDATE` y `VERSION_CONFLICT`.
- Extraordinario: `UNIQUE(student_subject_enrollment_id)`.
- Documentos: folio y token hash únicos; versiones no destructivas.
- Sustitución docente: cierra asignación previa y crea una nueva sin reescribir autoría.

## Seguridad de sesión

LOGIN/LOGOUT se escriben mediante una RPC autenticada que deriva `actor_id` de `auth.uid()` y el rol desde la base. Un cliente no puede declarar un actor arbitrario. LOGIN_FAILED se registra en observabilidad del servidor sin correo ni contraseña para evitar crear un repositorio de PII/credenciales.

## PWA

El service worker solo cachea activos públicos institucionales y fallback offline. No cachea rutas académicas, APIs, verificación, tokens, calificaciones ni PDFs privados.
