import fs from 'node:fs';
import path from 'node:path';

const roots=['app','components','features'];
const files=[];
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(p.endsWith('.tsx'))files.push(p)}}
for(const root of roots) if(fs.existsSync(root)) walk(root);

const failures=[];
let controls=0;
let images=0;
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const htmlForIds=new Set([...source.matchAll(/htmlFor=["']([^"']+)["']/g)].map(m=>m[1]));
  for(const match of source.matchAll(/<(input|select|textarea)\b([^>]*)>/gs)){
    const attrs=match[2];
    if(/type=["']hidden["']/.test(attrs)) continue;
    controls++;
    const aria=/aria-label=|aria-labelledby=/.test(attrs);
    const id=attrs.match(/\bid=["']([^"']+)["']/)?.[1];
    if(!aria && !(id&&htmlForIds.has(id))) failures.push(`${file}: control <${match[1]}> sin nombre accesible explícito`);
  }
  for(const match of source.matchAll(/<(?:Image|img)\b([^>]*)>/gs)){
    images++;
    if(!/\balt=/.test(match[1])) failures.push(`${file}: imagen sin atributo alt`);
  }
}
if(failures.length){
  console.error('Accessibility static audit: FAIL');
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Accessibility static audit: PASS (${controls} controles con nombre accesible; ${images} imágenes con alt)`);
