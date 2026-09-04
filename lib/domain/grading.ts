export type GradeValue =
  | { kind: 'NUMERIC'; value: number }
  | { kind: 'NP' }
  | { kind: 'PENDING' };

export type AcademicStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED_ORDINARY'
  | 'FAILED_ORDINARY'
  | 'ACCREDITED_EXTRAORDINARY'
  | 'NOT_ACCREDITED_EXTRAORDINARY';

export const PASSING_GRADE = 6.0;

/** Decimal ROUND HALF UP to exactly one decimal place. */
export function roundHalfUp1(value: number): number {
  if (!Number.isFinite(value)) throw new Error('GRADE_NON_FINITE');
  const sign = value < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(value) * 10 + 0.5 + Number.EPSILON) / 10;
}

export function assertNumericGrade(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    throw new Error('GRADE_OUT_OF_RANGE');
  }
  const rounded = roundHalfUp1(value);
  if (Math.abs(value - rounded) > 1e-9) throw new Error('GRADE_MORE_THAN_ONE_DECIMAL');
  return rounded;
}

export function gradeForCalculation(grade: GradeValue): number | null {
  if (grade.kind === 'PENDING') return null;
  if (grade.kind === 'NP') return 0;
  return assertNumericGrade(grade.value);
}

export function displayGrade(grade: GradeValue): string {
  if (grade.kind === 'NP') return 'NP';
  if (grade.kind === 'PENDING') return '—';
  return grade.value.toFixed(1);
}

export function provisionalAverage(grades: GradeValue[]): number | null {
  if (grades.length < 1 || grades.length > 3) throw new Error('INVALID_PARTIAL_COUNT');
  const values = grades.map(gradeForCalculation);
  if (values.some((value) => value === null)) return null;
  return roundHalfUp1((values as number[]).reduce((sum, value) => sum + value, 0) / values.length);
}

export function ordinaryAverage(p1: GradeValue, p2: GradeValue, p3: GradeValue): number | null {
  return provisionalAverage([p1, p2, p3]);
}

export function isAtRisk(grades: GradeValue[]): boolean {
  if (grades.length !== 1 && grades.length !== 2) return false;
  const average = provisionalAverage(grades);
  return average !== null && average < PASSING_GRADE;
}

export function ordinaryStatus(p1: GradeValue, p2: GradeValue, p3: GradeValue): AcademicStatus {
  const average = ordinaryAverage(p1, p2, p3);
  if (average === null) return 'IN_PROGRESS';
  return average >= PASSING_GRADE ? 'APPROVED_ORDINARY' : 'FAILED_ORDINARY';
}

export function finalStatus(ordinary: number | null, extraordinary: number | null): AcademicStatus {
  if (ordinary === null) return 'IN_PROGRESS';
  if (ordinary >= PASSING_GRADE) return 'APPROVED_ORDINARY';
  if (extraordinary === null) return 'FAILED_ORDINARY';
  assertNumericGrade(extraordinary);
  return extraordinary >= PASSING_GRADE
    ? 'ACCREDITED_EXTRAORDINARY'
    : 'NOT_ACCREDITED_EXTRAORDINARY';
}

export function correctionDeadline(publishedAt: Date): Date {
  if (Number.isNaN(publishedAt.getTime())) throw new Error('INVALID_PUBLISHED_AT');
  return new Date(publishedAt.getTime() + 72 * 60 * 60 * 1000);
}

export function teacherMayCorrectDirectly(publishedAt: Date, serverNow: Date): boolean {
  return serverNow.getTime() <= correctionDeadline(publishedAt).getTime();
}
