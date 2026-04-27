import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authFile = 'tests/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Config para garantir que o diretório auth existe
  const dir = path.dirname(authFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await page.goto('/login');
  await page.fill('input[type="email"]', 'tarcisio@lunardeli.com.br');
  await page.fill('input[type="password"]', 'Senha123');
  await page.click('button[type="submit"]');

  // Wait until the page receives the cookies and navigates to either /select-obra or /dashboard
  // Since obra might not be selected, we wait for navigation away from login
  await page.waitForURL((url) => !url.pathname.includes('/login'));

  // Se cair no select de obras, selecionamos a primeira
  if (page.url().includes('/select-obra')) {
    const cardObra = page.locator('.grid > div').first();
    await cardObra.waitFor();
    await cardObra.click();
    await page.waitForURL('/dashboard');
  }

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});
