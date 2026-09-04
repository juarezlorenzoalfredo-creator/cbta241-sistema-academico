import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../docs/qa-visual/', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

createServer(async (req, res) => {
  const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const requested = rawPath === '/' ? '/preview.html' : rawPath;
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const target = join(root, safe);

  if (!target.startsWith(root) || !existsSync(target)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('NOT_FILE');
    res.writeHead(200, {
      'content-type': mime[extname(target)] ?? 'application/octet-stream',
      'cache-control': 'no-store'
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`QA static preview: http://127.0.0.1:${port}`);
});
