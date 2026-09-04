import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

function loadTypeScript() {
  try {
    return require('typescript');
  } catch {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return require(join(globalRoot, 'typescript'));
  }
}

const ts = loadTypeScript();
const root = resolve(new URL('..', import.meta.url).pathname);
const roots = ['app','components','features','hooks','lib','server','services','tests','e2e','types','validation'];
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}

for (const candidate of roots) {
  const dir = join(root, candidate);
  if (existsSync(dir)) walk(dir);
}

const errors = [];
for (const file of files.sort()) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const diagnostic of source.parseDiagnostics) {
    const location = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    errors.push(`${file}:${location.line + 1}:${location.character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  }
}

console.log(`TypeScript syntax audit: ${files.length} files / ${errors.length} errors.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS: TS/TSX syntax is parseable.');
