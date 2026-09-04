import type { GradeValue } from './grading';

export type PublicationRow = {
  studentId: string;
  grade: GradeValue;
};

export type PublicationValidation = {
  total: number;
  numeric: number;
  np: number;
  pending: number;
  errors: string[];
  publishable: boolean;
};

export function validatePublication(rows: PublicationRow[]): PublicationValidation {
  const unique = new Set<string>();
  const errors: string[] = [];
  let numeric = 0;
  let np = 0;
  let pending = 0;

  for (const row of rows) {
    if (!row.studentId) errors.push('STUDENT_ID_REQUIRED');
    if (unique.has(row.studentId)) errors.push(`DUPLICATE_STUDENT:${row.studentId}`);
    unique.add(row.studentId);
    if (row.grade.kind === 'NUMERIC') {
      numeric += 1;
      if (row.grade.value < 0 || row.grade.value > 10 || Math.round(row.grade.value * 10) !== row.grade.value * 10) {
        errors.push(`INVALID_GRADE:${row.studentId}`);
      }
    } else if (row.grade.kind === 'NP') {
      np += 1;
    } else {
      pending += 1;
    }
  }

  return {
    total: rows.length,
    numeric,
    np,
    pending,
    errors,
    publishable: rows.length > 0 && pending === 0 && errors.length === 0
  };
}
