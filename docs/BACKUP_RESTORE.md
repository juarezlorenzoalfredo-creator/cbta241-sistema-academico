# Backup, restauración y verificación

## Objetivo

Un respaldo no se considera válido hasta que exista una restauración de prueba y una verificación funcional. Para producción se separan tres capas: PostgreSQL, Storage privado y configuración/secretos.

## PostgreSQL / Supabase

1. Habilitar backups administrados del proyecto de producción según el plan contratado.
2. Antes de cambios de esquema de alto riesgo, generar además un dump lógico con herramientas PostgreSQL/Supabase compatibles con la versión del proyecto.
3. Mantener las migraciones versionadas en `supabase/migrations/` como fuente reproducible del esquema.
4. No guardar dumps con datos reales dentro del repositorio Git.

### Restauración de ensayo

- Restaurar en un proyecto/instancia aislada, nunca encima de producción como primera prueba.
- Aplicar la misma configuración de Auth y Storage necesaria para el entorno de prueba.
- Ejecutar `supabase test db`.
- Validar conteos e integridad referencial de: perfiles, alumnos, inscripciones, asignaciones, calificaciones, publicaciones, extraordinarios, documentos y auditoría.
- Ejecutar E2E por rol contra la instancia restaurada.

## Storage privado

Los buckets `academic-documents` e `institution-private` son privados. El plan de continuidad debe incluir copia/recuperación de objetos y conservar la correspondencia con `document_versions.storage_path`.

Después de restaurar:

- comprobar que cada `document_versions.storage_path` vigente existe;
- comprobar SHA-256 del PDF contra `document_versions.sha256`;
- verificar que firma y sello continúan en `institution-private`;
- confirmar que un alumno no puede descargar documentos de otro alumno.

## Secretos

Los secretos no forman parte del backup Git ni de un dump compartido. Se recuperan desde el gestor de secretos del entorno. Ante sospecha de exposición se rotan, no se restauran ciegamente.

## Criterio de éxito

Una restauración se considera verificada solo si: la base inicia, migraciones son coherentes, RLS sigue denegando accesos cruzados, documentos vigentes son recuperables, hashes coinciden y los recorridos críticos por rol pasan.
