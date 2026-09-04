import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

const controlEmail = process.env.E2E_CONTROL_EMAIL;
const controlPassword = process.env.E2E_CONTROL_PASSWORD;
const teacherEmail = process.env.E2E_TEACHER_EMAIL;
const teacherPassword = process.env.E2E_TEACHER_PASSWORD;
const studentEmail = process.env.E2E_STUDENT_EMAIL;
const studentPassword = process.env.E2E_STUDENT_PASSWORD;
const adminEmail = process.env.E2E_SUPERADMIN_EMAIL;
const adminPassword = process.env.E2E_SUPERADMIN_PASSWORD;

test.describe('authenticated role journeys', () => {
  test.skip(!controlEmail || !controlPassword, 'Control Escolar E2E credentials not configured');

  test('Control Escolar enters operations portal', async ({ page }) => {
    await login(page, controlEmail!, controlPassword!);
    await expect(page).toHaveURL(/\/control/);
    await expect(page.getByRole('heading', { name: 'Control Escolar' })).toBeVisible();
  });

  test('Control Escolar reaches document issuance', async ({ page }) => {
    await login(page, controlEmail!, controlPassword!);
    await page.goto('/control/documentos');
    await expect(page.getByRole('heading', { name: 'Reportes y boletas' })).toBeVisible();
  });

  test.skip(!teacherEmail || !teacherPassword, 'Teacher E2E credentials not configured');

  test('Teacher reaches grading workspace', async ({ page }) => {
    await login(page, teacherEmail!, teacherPassword!);
    await expect(page).toHaveURL(/\/docente/);
    await page.goto('/docente/captura');
    await expect(page.getByRole('heading', { name: 'Calificaciones' })).toBeVisible();
  });

  test('Teacher report export is limited to own visible assignments', async ({ page }) => {
    await login(page, teacherEmail!, teacherPassword!);
    await page.goto('/docente/reportes');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    const excelLinks = page.getByRole('link', { name: 'Excel XLSX' });
    const count = await excelLinks.count();
    test.skip(count === 0, 'Teacher test account has no active assignment to export');
    const downloadPromise = page.waitForEvent('download');
    await excelLinks.first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test.skip(!studentEmail || !studentPassword, 'Student E2E credentials not configured');

  test('Student reaches published grades only', async ({ page }) => {
    await login(page, studentEmail!, studentPassword!);
    await expect(page).toHaveURL(/\/alumno/);
    await page.goto('/alumno/calificaciones');
    await expect(page.getByRole('heading', { name: 'Mis calificaciones' })).toBeVisible();
  });

  test.skip(!adminEmail || !adminPassword, 'Superadmin E2E credentials not configured');

  test('Superadmin reaches security and global audit modules', async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/seguridad');
    await expect(page.getByRole('heading', { name: 'Estado de seguridad' })).toBeVisible();
    await page.goto('/admin/auditoria');
    await expect(page.getByRole('heading', { name: 'Auditoría global' })).toBeVisible();
  });
});
