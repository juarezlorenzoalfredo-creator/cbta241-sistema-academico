const required = [
  'E2E_STUDENT_EMAIL','E2E_STUDENT_PASSWORD',
  'E2E_TEACHER_EMAIL','E2E_TEACHER_PASSWORD',
  'E2E_CONTROL_EMAIL','E2E_CONTROL_PASSWORD',
  'E2E_SUPERADMIN_EMAIL','E2E_SUPERADMIN_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Authenticated E2E gate blocked. Missing: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Authenticated E2E credentials gate: PASS.');
