// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('DVPI-app', () => {
  test('viser WSP-logo og dansk titel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /DVPI-beregner/i })).toBeVisible();
    await expect(page.getByAltText('WSP')).toBeVisible();
    await expect(page.getByText(/Upload en CSV-fil/)).toBeVisible();
  });

  test('kan åbne tabellen til manuel indtastning', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Åbn tabel til manuel indtastning/i }).click();
    await expect(page.getByRole('heading', { name: /Indtastningsdata/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Transektnr.' })).toBeVisible();
  });

  test('fil-upload zone vises og accepterer klik', async ({ page }) => {
    await page.goto('/');
    const uploadArea = page.getByText(/Træk og slip en CSV-fil/).first();
    await expect(uploadArea).toBeVisible();
    await uploadArea.click();
  });
});

test.describe('Artsvælger (Videnskabeligt navn / Art)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Åbn tabel til manuel indtastning/i }).click();
    await expect(page.getByRole('heading', { name: /Indtastningsdata/i })).toBeVisible();
  });

  test('søgning i Videnskabeligt navn viser dropdown og valg opdaterer begge felter', async ({
    page,
  }) => {
    const latinInput = page.getByPlaceholder('Videnskabeligt navn').first();
    await latinInput.click();
    await latinInput.fill('Lem');
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('option').filter({ hasText: 'Lemanea' }).first()).toBeVisible();
    await page.getByRole('option').filter({ hasText: 'Lemanea' }).first().click();
    await expect(latinInput).toHaveValue(/Lemanea/);
    const artInput = page.getByPlaceholder('Art').first();
    await expect(artInput).not.toHaveValue('');
  });

  test('søgning i Art viser dropdown og valg opdaterer begge felter', async ({
    page,
  }) => {
    const artInput = page.getByPlaceholder('Art').first();
    await artInput.click();
    await artInput.fill('Chon');
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10000 });
    await page.getByRole('option').filter({ hasText: 'Chondrus' }).first().click();
    await expect(artInput).not.toHaveValue('');
    const latinInput = page.getByPlaceholder('Videnskabeligt navn').first();
    await expect(latinInput).toHaveValue(/Chondrus/);
  });

  test('under 3 tegn viser ingen dropdown', async ({ page }) => {
    const latinInput = page.getByPlaceholder('Videnskabeligt navn').first();
    await latinInput.click();
    await latinInput.fill('Le');
    await page.waitForTimeout(400);
    await expect(page.getByRole('listbox')).not.toBeVisible();
  });
});
