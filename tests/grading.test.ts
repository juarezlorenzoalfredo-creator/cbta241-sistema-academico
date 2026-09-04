import { describe, expect, it } from 'vitest';
import { assertNumericGrade, correctionDeadline, displayGrade, finalStatus, isAtRisk, ordinaryAverage, ordinaryStatus, provisionalAverage, roundHalfUp1, teacherMayCorrectDirectly } from '@/lib/domain/grading';
import { periodLabel } from '@/lib/domain/periods';
import { validatePublication } from '@/lib/domain/publication';

const N=(value:number)=>({kind:'NUMERIC' as const,value}); const NP={kind:'NP' as const}; const P={kind:'PENDING' as const};

describe('CBTA 241 domain rules',()=>{
  it('rounds HALF_UP to one decimal',()=>{expect(roundHalfUp1(8.54)).toBe(8.5);expect(roundHalfUp1(8.55)).toBe(8.6);expect(roundHalfUp1(8.56)).toBe(8.6)});
  it('validates one-decimal grade range',()=>{expect(assertNumericGrade(10)).toBe(10);expect(()=>assertNumericGrade(10.1)).toThrow('GRADE_OUT_OF_RANGE');expect(()=>assertNumericGrade(8.55)).toThrow('GRADE_MORE_THAN_ONE_DECIMAL')});
  it('keeps NP visible while calculating as zero',()=>{expect(displayGrade(NP)).toBe('NP');expect(ordinaryAverage(N(8),NP,N(7))).toBe(5)});
  it('never treats pending as zero',()=>{expect(ordinaryAverage(N(8),P,N(7))).toBeNull();expect(ordinaryStatus(N(8),P,N(7))).toBe('IN_PROGRESS')});
  it('computes provisional P1 and P1+P2',()=>{expect(provisionalAverage([N(5.9)])).toBe(5.9);expect(provisionalAverage([N(7),N(5)])).toBe(6)});
  it('flags risk only after one or two resolved partials',()=>{expect(isAtRisk([N(5.9)])).toBe(true);expect(isAtRisk([N(7),N(5)])).toBe(false);expect(isAtRisk([N(5),P])).toBe(false)});
  it('uses rounded ordinary result for pass/fail',()=>{expect(ordinaryStatus(N(6),N(6),N(6))).toBe('APPROVED_ORDINARY');expect(ordinaryStatus(N(5.9),N(5.9),N(5.9))).toBe('FAILED_ORDINARY')});
  it('preserves ordinary outcome and applies one independent extraordinary result',()=>{expect(finalStatus(5,7.5)).toBe('ACCREDITED_EXTRAORDINARY');expect(finalStatus(5,5.9)).toBe('NOT_ACCREDITED_EXTRAORDINARY');expect(finalStatus(7,null)).toBe('APPROVED_ORDINARY')});
  it('enforces exact 72-hour direct correction window',()=>{const p=new Date('2026-09-01T12:00:00Z');expect(correctionDeadline(p).toISOString()).toBe('2026-09-04T12:00:00.000Z');expect(teacherMayCorrectDirectly(p,new Date('2026-09-04T12:00:00Z'))).toBe(true);expect(teacherMayCorrectDirectly(p,new Date('2026-09-04T12:00:00.001Z'))).toBe(false)});
  it('builds academic period labels without hardcoding current years',()=>{expect(periodLabel('AUG_JAN',2026)).toBe('AGOSTO 2026 – ENERO 2027');expect(periodLabel('FEB_JUL',2027)).toBe('FEBRERO 2027 – JULIO 2027')});
  it('blocks atomic publication when any row is pending',()=>{const r=validatePublication([{studentId:'a',grade:N(8)},{studentId:'b',grade:NP},{studentId:'c',grade:P}]);expect(r).toMatchObject({numeric:1,np:1,pending:1,publishable:false})});
  it('detects duplicate students before publication',()=>{const r=validatePublication([{studentId:'a',grade:N(8)},{studentId:'a',grade:N(9)}]);expect(r.publishable).toBe(false);expect(r.errors[0]).toContain('DUPLICATE_STUDENT')});
});
