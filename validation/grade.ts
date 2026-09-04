import { z } from 'zod';

export const gradeInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NUMERIC'), value: z.number().min(0).max(10).multipleOf(0.1) }),
  z.object({ kind: z.literal('NP') }),
  z.object({ kind: z.literal('PENDING') })
]);

export const publishGradesSchema = z.object({
  assignmentId: z.uuid(),
  evaluationPeriodId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  rows: z.array(z.object({
    studentSubjectEnrollmentId: z.uuid(),
    grade: gradeInputSchema
  })).min(1).max(120),
  idempotencyKey: z.string().min(16).max(128)
});
