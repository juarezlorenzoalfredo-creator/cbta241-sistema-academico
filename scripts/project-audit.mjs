import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const failures = [];
const checks = [];

function pass(name) { checks.push({ name, status: 'PASS' }); }
function fail(name, detail) { checks.push({ name, status: 'FAIL', detail }); failures.push(`${name}: ${detail}`); }
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}
function resolveLocal(fromFile, spec) {
  const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`,
    join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js')
  ];
  return candidates.some(existsSync);
}

const sourceFiles = ['app', 'components', 'features', 'lib', 'validation', 'tests', 'e2e']
  .flatMap((dir) => walk(join(root, dir)))
  .filter((file) => ['.ts', '.tsx'].includes(extname(file)));

let unresolved = [];
for (const file of sourceFiles) {
  const body = readFileSync(file, 'utf8');
  const importRegex = /(?:from\s+|import\s*\()(['"])([^'"]+)\1/g;
  for (const match of body.matchAll(importRegex)) {
    const spec = match[2];
    if ((spec.startsWith('@/') || spec.startsWith('.')) && !resolveLocal(file, spec)) {
      unresolved.push(`${relative(root, file)} -> ${spec}`);
    }
  }
}
unresolved.length ? fail('Local imports resolve', unresolved.join('; ')) : pass('Local imports resolve');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scriptFileRefs = Object.entries(pkg.scripts ?? {})
  .flatMap(([name, command]) => [...String(command).matchAll(/node\s+(scripts\/[^\s;&]+)/g)].map((m) => [name, m[1]]));
const missingScripts = scriptFileRefs.filter(([, file]) => !existsSync(join(root, file)));
missingScripts.length ? fail('Package script targets exist', missingScripts.map(([n, f]) => `${n}:${f}`).join(', ')) : pass('Package script targets exist');

const migrationDir = join(root, 'supabase', 'migrations');
const migrations = readdirSync(migrationDir).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
const numbers = migrations.map((name) => Number(name.slice(0, 3)));
const sequential = numbers.every((n, i) => n === i + 1);
sequential ? pass('SQL migrations are sequential') : fail('SQL migrations are sequential', migrations.join(', '));

const requiredDocs = ['README.md', 'ARCHITECTURE.md', 'DATABASE.md', 'SECURITY.md', 'TESTING.md', 'DEPLOYMENT.md', 'CHANGELOG.md', 'docs/QA_REPORT.md', 'docs/FINAL_AUDIT.md', 'docs/RELEASE_CHECKLIST.md', 'docs/BACKUP_RESTORE.md', 'docs/SUPABASE_VALIDATION.md', 'docs/RELEASE_MANIFEST.json'];
const missingDocs = requiredDocs.filter((file) => !existsSync(join(root, file)) || statSync(join(root, file)).size === 0);
missingDocs.length ? fail('Required documentation exists', missingDocs.join(', ')) : pass('Required documentation exists');

const requiredRolePages = [
  'app/alumno/page.tsx','app/alumno/calificaciones/page.tsx','app/alumno/materias/page.tsx','app/alumno/historial/page.tsx','app/alumno/extraordinarios/page.tsx','app/alumno/documentos/page.tsx','app/alumno/notificaciones/page.tsx','app/alumno/perfil/page.tsx',
  'app/docente/page.tsx','app/docente/materias/page.tsx','app/docente/grupos/page.tsx','app/docente/captura/page.tsx','app/docente/publicaciones/page.tsx','app/docente/riesgo/page.tsx','app/docente/solicitudes/page.tsx','app/docente/correcciones/page.tsx','app/docente/extraordinarios/page.tsx','app/docente/reportes/page.tsx',
  'app/control/page.tsx','app/control/alumnos/page.tsx','app/control/docentes/page.tsx','app/control/materias/page.tsx','app/control/grupos/page.tsx','app/control/periodos/page.tsx','app/control/inscripciones/page.tsx','app/control/asignaciones/page.tsx','app/control/evaluaciones/page.tsx','app/control/seguimiento/page.tsx','app/control/publicaciones/page.tsx','app/control/correcciones/page.tsx','app/control/extraordinarios/page.tsx','app/control/documentos/page.tsx','app/control/reportes/page.tsx','app/control/importaciones/page.tsx','app/control/auditoria/page.tsx','app/control/configuracion/page.tsx',
  'app/admin/page.tsx','app/admin/usuarios/page.tsx','app/admin/auditoria/page.tsx','app/admin/seguridad/page.tsx','app/admin/configuracion/page.tsx'
];
const missingRolePages = requiredRolePages.filter((file) => !existsSync(join(root,file)));
missingRolePages.length ? fail('Required role module pages exist', missingRolePages.join(', ')) : pass('Required role module pages exist');

const requiredAssets = ['public/institution/cbta241-logo.png', 'public/institution/icon-192.png', 'public/institution/icon-512.png', 'public/institution/icon-maskable-512.png', 'public/manifest.webmanifest', 'public/sw.js', 'public/offline.html'];
const missingAssets = requiredAssets.filter((file) => !existsSync(join(root, file)));
missingAssets.length ? fail('Institution/PWA assets exist', missingAssets.join(', ')) : pass('Institution/PWA assets exist');

function pngDimensions(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'));
const iconFailures = (manifest.icons ?? []).flatMap((icon) => {
  const match = String(icon.sizes ?? '').match(/^(\d+)x(\d+)$/);
  if (!match) return [`${icon.src}:invalid-size`];
  const file = join(root, 'public', String(icon.src).replace(/^\//, ''));
  if (!existsSync(file)) return [`${icon.src}:missing`];
  const actual = pngDimensions(file);
  return actual && actual[0] === Number(match[1]) && actual[1] === Number(match[2]) ? [] : [`${icon.src}:dimension-mismatch`];
});
iconFailures.length ? fail('PWA icon dimensions match manifest', iconFailures.join(', ')) : pass('PWA icon dimensions match manifest');

const allTs = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const explicitAny = /:\s*any\b|<any>|\bas\s+any\b/.test(allTs);
explicitAny ? fail('No explicit TypeScript any', 'Explicit any type pattern found') : pass('No explicit TypeScript any');

const routeChecks = [
  ['app/api/grading/draft/route.ts', /getAuthContext\(\)/, /DOCENTE/, /CONTROL_ESCOLAR/],
  ['app/api/grading/publish/route.ts', /getAuthContext\(\)/, /DOCENTE/, /CONTROL_ESCOLAR/],
  ['app/api/documents/issue-boleta/route.ts', /getAuthContext\(\)/, /CONTROL_ESCOLAR/],
  ['app/api/documents/issue-partial/route.ts', /getAuthContext\(\)/, /CONTROL_ESCOLAR/],
  ['app/api/reports/teacher-grades-xlsx/route.ts', /getAuthContext\(\)/, /DOCENTE/]
];
const routeFailures = [];
for (const [file, ...patterns] of routeChecks) {
  const full = join(root, file);
  const body = existsSync(full) ? readFileSync(full, 'utf8') : '';
  if (!existsSync(full) || patterns.some((pattern) => !pattern.test(body))) routeFailures.push(file);
}
routeFailures.length ? fail('Sensitive API routes authenticate and role-gate', routeFailures.join(', ')) : pass('Sensitive API routes authenticate and role-gate');

const sql = migrations.map((name) => readFileSync(join(migrationDir, name), 'utf8')).join('\n');
const hardeningContracts = [
  ['RLS forced on sensitive tables', /force row level security/i],
  ['Anon table access revoked', /revoke all on all tables in schema public from anon/i],
  ['PUBLIC function execute revoked', /revoke execute on all functions in schema public from public/i],
  ['Institution settings restricted', /create policy institution_settings_read[\s\S]*current_user_has_role\('CONTROL_ESCOLAR'\)[\s\S]*current_user_has_role\('SUPERADMIN'\)/i],
  ['Student document storage current-only', /academic_documents_storage_student_read[\s\S]*dv\.version=d\.current_version[\s\S]*dv\.state='VIGENTE'/i]
];
for (const [name, pattern] of hardeningContracts) pattern.test(sql) ? pass(name) : fail(name, 'SQL contract not found');

console.log('PROJECT AUDIT');
console.table(checks);
if (failures.length) {
  console.error('\nFAILURES');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`PASS: ${checks.length}/${checks.length} project integrity checks.`);
