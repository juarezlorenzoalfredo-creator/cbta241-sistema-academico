import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
const root=new URL('..',import.meta.url).pathname;
rmSync(`${root}/.verified`,{recursive:true,force:true});
execFileSync('tsc',['-p',`${root}/tsconfig.verify.json`],{stdio:'inherit'});
const require=createRequire(import.meta.url);
const g=require(`${root}/.verified/lib/domain/grading.js`);
const p=require(`${root}/.verified/lib/domain/publication.js`);
const periods=require(`${root}/.verified/lib/domain/periods.js`);
const N=v=>({kind:'NUMERIC',value:v}),NP={kind:'NP'},P={kind:'PENDING'};
const checks=[
  ['half-up 8.55',g.roundHalfUp1(8.55)===8.6],
  ['NP calculation',g.ordinaryAverage(N(8),NP,N(7))===5],
  ['pending is null',g.ordinaryAverage(N(8),P,N(7))===null],
  ['risk',g.isAtRisk([N(5.9)])===true],
  ['passing 6.0',g.finalStatus(6,null)==='APPROVED_ORDINARY'],
  ['extra independent',g.finalStatus(5,7.5)==='ACCREDITED_EXTRAORDINARY'],
  ['72h boundary',g.teacherMayCorrectDirectly(new Date('2026-09-01T00:00:00Z'),new Date('2026-09-04T00:00:00Z'))===true],
  ['period label',periods.periodLabel('AUG_JAN',2026)==='AGOSTO 2026 – ENERO 2027'],
  ['pending blocks publish',p.validatePublication([{studentId:'1',grade:P}]).publishable===false]
];
const failed=checks.filter(([,ok])=>!ok); console.table(checks.map(([name,ok])=>({check:name,result:ok?'PASS':'FAIL'})));
if(failed.length) process.exit(1); console.log(`Domain verification PASS (${checks.length}/${checks.length}).`);
