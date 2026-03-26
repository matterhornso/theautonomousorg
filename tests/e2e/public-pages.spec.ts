import { test, expect } from '@playwright/test';

const publicPages = [
  { path: '/privacy', name: 'Privacy page' },
  { path: '/terms', name: 'Terms page' },
  { path: '/contact', name: 'Contact page' },
  { path: '/blog', name: 'Blog index' },
  { path: '/blog/what-are-ai-agents', name: 'Blog: what are AI agents' },
  { path: '/blog/ai-agents-vs-chatbots', name: 'Blog: AI agents vs chatbots' },
  { path: '/blog/how-to-automate-sales', name: 'Blog: how to automate sales' },
];

for (const { path, name } of publicPages) {
  test(`${name} loads (${path})`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });
}

test('blog index has at least one post link', async ({ page }) => {
  await page.goto('/blog');
  const links = page.locator('a[href*="/blog/"]');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
});

test('privacy page has content', async ({ page }) => {
  await page.goto('/privacy');
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(100);
});

test('terms page has content', async ({ page }) => {
  await page.goto('/terms');
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(100);
});
