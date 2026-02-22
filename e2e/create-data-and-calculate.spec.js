// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002';

// 6 rows: 2 transekts (1, 2) × 3 kvadrats (1, 2, 3), each with a different species (latin name from stancode)
const ROWS = [
  { transekt: '1', kvadrat: '1', latin: 'Lemanea fluviatilis' },
  { transekt: '1', kvadrat: '2', latin: 'Chondrus crispus' },
  { transekt: '1', kvadrat: '3', latin: 'Nostoc pruniforme' },
  { transekt: '2', kvadrat: '1', latin: 'Hildenbrandia rivularis' },
  { transekt: '2', kvadrat: '2', latin: 'Ceramium tenuicorne' },
  { transekt: '2', kvadrat: '3', latin: 'Batrachospermum moniliforme' },
];

test.describe('Opret data og få beregning fra backend', () => {
  test('6 rækker i 2 transekts og 3 kvadrats med forskellige arter – udfyld grid, klik Genberegn DVPI og få svar fra API', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto('/');
    await page.getByRole('button', { name: /Åbn tabel til manuel indtastning/i }).click();
    await expect(page.getByRole('heading', { name: /Indtastningsdata/i })).toBeVisible();

    // Start with 1 row; add 5 more to get 6 rows
    const addRowBtn = page.getByRole('button', { name: /Tilføj række/i });
    for (let i = 0; i < 5; i++) {
      await addRowBtn.click();
    }

    // Fill each row: Transektnr., Kvadratnr., Videnskabeligt navn (species)
    const transektInputs = page.getByPlaceholder('Transektnr.');
    const kvadratInputs = page.getByPlaceholder('Kvadratnr.');
    const latinInputs = page.getByPlaceholder('Videnskabeligt navn');

    for (let r = 0; r < ROWS.length; r++) {
      const { transekt, kvadrat, latin } = ROWS[r];
      await transektInputs.nth(r).fill(transekt);
      await kvadratInputs.nth(r).fill(kvadrat);
      // Species: type min 3 chars to open dropdown, then select option
      await latinInputs.nth(r).click();
      await latinInputs.nth(r).fill(latin);
      await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10000 });
      const option = page.getByRole('option').filter({ hasText: latin }).first();
      await option.scrollIntoViewIfNeeded();
      await option.click();
    }

    // Trigger calculation and wait for backend API response
    const calculateBtn = page.getByRole('button', { name: /Genberegn DVPI/i });
    await expect(calculateBtn).toBeEnabled();

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/process-json') && res.request().method() === 'POST',
      { timeout: 25000 }
    );

    await calculateBtn.click();

    // Wait for calculation to finish (button may show "Beregner…" briefly, then "Genberegn DVPI")
    await expect(calculateBtn).toHaveText(/Genberegn DVPI/, { timeout: 20000 });

    // Assert we got a successful calculation response from the backend API
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('results');
    expect(body).toHaveProperty('totalRows');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.totalRows).toBe(ROWS.length);

    // Log calculation response for inspection
    console.log('--- Backend calculation response ---');
    console.log('totalRows:', body.totalRows);
    console.log('results:', JSON.stringify(body.results, null, 2));
    console.log('--- End response ---');

    // Assert UI shows result: either ResultsGrid (DVPI column) or summary or error
    const resultsTable = page.getByRole('columnheader', { name: 'DVPI' });
    const resultsSummary = page.getByText(/Behandlet \d+ rækker/);
    const errorDiv = page.getByText(/^Fejl:/);
    await expect(resultsTable.or(resultsSummary).or(errorDiv)).toBeVisible({ timeout: 5000 });
  });
});
