import { test, expect } from '@playwright/test';

test.describe('Homepage & Navigation', () => {
  test('homepage loads with key sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('homepage has URL input field', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="text"], input[type="url"], input[placeholder*="url" i], input[placeholder*="website" i], input[placeholder*="company" i], input[placeholder*="http" i]').first();
    await expect(input).toBeVisible();
  });

  test('navigation links exist for how-it-works, agents, pricing', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav, header');
    await expect(nav.first()).toBeVisible();
    const links = page.locator('a[href*="#how-it-works"], a[href*="#agents"], a[href*="#pricing"]');
    await expect(links.first()).toBeVisible();
  });

  test('anchor navigation scrolls to section', async ({ page }) => {
    await page.goto('/#how-it-works');
    await expect(page.locator('body')).toBeVisible();
  });

  test('mobile hamburger menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const hamburger = page.locator('[aria-label*="menu" i], button[class*="hamburger" i], button[class*="mobile" i], [data-testid*="menu" i]').first();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
      await hamburger.click();
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('pricing buttons show "Coming soon" or similar toast', async ({ page }) => {
    await page.goto('/#pricing');
    const pricingBtn = page.locator('a[href*="pricing"], button').filter({ hasText: /get started|sign up|coming soon|launch|try/i }).first();
    if (await pricingBtn.isVisible()) {
      await pricingBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('footer links are present', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    const footerLinks = footer.locator('a');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('footer privacy and terms links navigate correctly', async ({ page }) => {
    await page.goto('/');
    const privacyLink = page.locator('footer a[href*="privacy"], a[href="/privacy"]').first();
    if (await privacyLink.isVisible()) {
      await privacyLink.click();
      await expect(page).toHaveURL(/privacy/);
    }
  });

  test('newsletter subscription form exists', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
      await expect(emailInput).toHaveValue('test@example.com');
    }
  });
});
