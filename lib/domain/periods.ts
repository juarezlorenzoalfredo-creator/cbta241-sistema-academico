export type PeriodKind = 'AUG_JAN' | 'FEB_JUL';

export function periodLabel(kind: PeriodKind, startYear: number): string {
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2200) throw new Error('INVALID_YEAR');
  if (kind === 'AUG_JAN') return `AGOSTO ${startYear} – ENERO ${startYear + 1}`;
  return `FEBRERO ${startYear} – JULIO ${startYear}`;
}

export function inferPeriod(date: Date): { kind: PeriodKind; startYear: number; label: string } {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (month >= 8) return { kind: 'AUG_JAN', startYear: year, label: periodLabel('AUG_JAN', year) };
  if (month === 1) return { kind: 'AUG_JAN', startYear: year - 1, label: periodLabel('AUG_JAN', year - 1) };
  return { kind: 'FEB_JUL', startYear: year, label: periodLabel('FEB_JUL', year) };
}
