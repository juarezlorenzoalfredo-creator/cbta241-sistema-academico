# Release checklist — Sistema Académico Digital CBTA 241 — RC5

## Código

- [ ] `package-lock.json` resuelto y versionado.
- [ ] `npm ci`.
- [ ] `npm run lint` con dependencias reales.
- [ ] `npm run typecheck` semántico.
- [ ] `npm run test` (Vitest instalado).
- [x] `npm run verify:domain` — 9/9.
- [x] `npm run test:syntax` — 96 TS/TSX / 0 errores.
- [x] `npm run test:security` — PASS.
- [x] `npm run test:sql` — 40/40.
- [x] `npm run test:project` — 14/14.
- [x] `npm run test:a11y:static` — PASS.
- [ ] `npm run build`.
- [x] Gate anti-skip `test:e2e:required` implementado; actualmente bloquea correctamente por falta de credenciales reales.
- [ ] `npm run qa:release` completo.

## PostgreSQL / Supabase

- [x] Migraciones `001`–`027` aplicadas a proyecto dedicado.
- [x] pgTAP schema base — 21/21.
- [x] Contrato bootstrap `service_role` — 8/8 PASS; exige Auth confirmado y email exacto.
- [x] RLS adversarial — 22-test suite reejecutada hasta test 22 OK.
- [x] Revocación RLS por perfil inactivo — 6/6.
- [x] Workflow académico/documental — 37/37.
- [x] Seed compatible con integridad estricta — validado en rollback.
- [x] Storage `academic-documents` privado.
- [x] Storage `institution-private` privado.
- [x] FK compuesta publicación con índice de cobertura.
- [ ] Deshabilitar signup público de Auth en el proyecto remoto antes de producción (configuración Dashboard/Management API).
- [ ] Backup + restore en entorno aislado.

## Bootstrap y Auth

- [x] Script `npm run bootstrap:superadmin` implementado.
- [x] RPC del primer Superadmin restringida exclusivamente a `service_role`.
- [x] Cleanup automático del Auth user si falla el enlace DB.
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY` solo en runtime servidor/CI para altas y bajas Auth; nunca en cliente ni Git.
- [x] Crear primer Superadmin real y enlazarlo a perfil `SUPERADMIN` auditado.
- [ ] Crear cuentas E2E aisladas por rol.

## E2E web

- [ ] Alumno: Auth real → calificaciones publicadas → documentos propios.
- [ ] Docente: Auth real → captura → publicación → corrección → exportación XLSX.
- [ ] Control Escolar: periodo → extraordinario → cierre → boleta.
- [ ] Superadmin: usuarios/roles → auditoría → configuración institucional.
- [x] Aislamiento PostgreSQL Alumno A→B y Docente A→Asignación B.
- [x] JWT simulado de cuenta inactiva pierde identidad RLS inmediatamente.
- [ ] Aislamiento repetido desde navegador/API con sesiones Auth reales.

## Documentos oficiales

- [ ] Director configurado.
- [ ] Firma real privada autorizada.
- [ ] Sello real privado autorizado.
- [ ] PDF oficial visualmente validado con datos de prueba.
- [x] Workflow QR VIGENTE/SUSTITUIDO/REVOCADO validado.

## Producción

- [ ] CI verde.
- [ ] Variables Vercel/Supabase configuradas sin secretos públicos.
- [ ] Build/E2E web completos.
- [ ] Backup/restore aprobado.
- [ ] Autorización expresa para publicar con datos reales.
