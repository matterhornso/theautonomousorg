import { test, expect } from '@playwright/test';

test.describe('API Health', () => {
  test('GET /api/health returns status and checks', async ({ request }) => {
    const res = await request.get('/api/health');
    const body = await res.json();
    expect(body.status).toBeTruthy();
    expect(body.checks.ANTHROPIC_API_KEY).toBe('set');
    expect(body.checks.CLERK_SECRET_KEY).toBe('set');
    expect(body.checks.ENCRYPTION_KEY).toBe('set');
  });
});

test.describe('SEO & Meta', () => {
  test('homepage has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Autonomous/i);
  });

  test('homepage has meta description', async ({ page }) => {
    await page.goto('/');
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute('content', /.+/);
  });

  test('homepage has Open Graph tags', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /Autonomous/i);
    const ogDesc = page.locator('meta[property="og:description"]');
    await expect(ogDesc).toHaveAttribute('content', /.+/);
  });

  test('homepage has JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toBeAttached();
    const content = await jsonLd.textContent();
    const parsed = JSON.parse(content!);
    expect(parsed['@context']).toBe('https://schema.org');
  });

  test('sitemap.xml returns valid XML', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('theautonomous.org');
  });

  test('manifest.json is valid', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('The Autonomous');
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test('icon-192.png is a real image', async ({ request }) => {
    const res = await request.get('/icon-192.png');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('image/png');
    const body = await res.body();
    expect(body.length).toBeGreaterThan(500);
  });
});

test.describe('Design System', () => {
  test('homepage uses Instrument Serif for hero heading', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    const fontFamily = await h1.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Instrument Serif');
  });

  test('homepage uses DM Sans for body text', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    const fontFamily = await body.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('DM Sans');
  });

  test('homepage has correct accent color on CTA button', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('button:has-text("Get recommendations")');
    const bgColor = await btn.evaluate(el => getComputedStyle(el).backgroundColor);
    // #D4A853 in RGB is rgb(212, 168, 83)
    expect(bgColor).toContain('212');
    expect(bgColor).toContain('168');
  });

  test('html has data-scroll-behavior attribute', async ({ page }) => {
    await page.goto('/');
    const attr = await page.locator('html').getAttribute('data-scroll-behavior');
    expect(attr).toBe('smooth');
  });
});
