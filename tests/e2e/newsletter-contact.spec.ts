import { test, expect } from '@playwright/test';

test.describe('Newsletter API', () => {
  test('POST /api/newsletter with valid email → 200', async ({ request }) => {
    const res = await request.post('/api/newsletter', {
      data: { email: 'e2e-test@example.com' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /api/newsletter with empty body → 400', async ({ request }) => {
    const res = await request.post('/api/newsletter', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/newsletter with invalid email → 400', async ({ request }) => {
    const res = await request.post('/api/newsletter', {
      data: { email: 'not-an-email' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  test('newsletter form submits and shows confirmation', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.scrollIntoViewIfNeeded();
    await emailInput.fill('e2e-newsletter@example.com');
    await page.locator('button:has-text("Subscribe")').click();
    await expect(page.locator('text=subscribed')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Contact API', () => {
  test('POST /api/contact with valid data → 200', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: {
        name: 'E2E Tester',
        email: 'e2e@example.com',
        subject: 'general',
        message: 'Automated test message',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /api/contact with missing fields → 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'Tester' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/contact with invalid email → 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: {
        name: 'Tester',
        email: 'bad-email',
        subject: 'general',
        message: 'Test',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  test('contact form submits and shows confirmation', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('input[placeholder="Jane Smith"]').fill('E2E Tester');
    await page.locator('input[placeholder="jane@company.com"]').fill('e2e@test.com');
    await page.locator('select').selectOption('general');
    await page.locator('textarea').fill('E2E test message');
    await page.locator('button:has-text("Send message")').click();
    await expect(page.locator('text=Message sent')).toBeVisible({ timeout: 10000 });
  });
});
