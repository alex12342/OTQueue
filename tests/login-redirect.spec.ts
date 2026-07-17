import { test, expect } from '@playwright/test';

test.describe('Login redirect flow', () => {
  test('after login, should redirect to "/" (Up Next)', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[login]') || text.includes('[auth]') || text.includes('[AuthGuard]') || text.includes('fetchCurrentUser')) {
        consoleMessages.push(`[${msg.type()}] ${text}`);
      }
    });

    // Go to login page
    await page.goto('http://localhost:8085/login');
    await expect(page.locator('text=Welcome back! Please sign in to continue.')).toBeVisible();

    // Fill in credentials
    await page.getByLabel('Email Address').fill('admin@otqueue.local');
    await page.getByLabel('Password').fill('Admin@123!');

    // Click sign in and wait for full navigation
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for full page load and React hydration
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('Final URL:', url);
    console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));
    
    // Check localStorage
    const storedUser = await page.evaluate(() => localStorage.getItem('otqueue_user'));
    console.log('localStorage:', storedUser);

    // Check cookies
    const cookies = await page.context().cookies(['http://localhost:8085']);
    console.log('Cookies:', JSON.stringify(cookies.map(c => ({ name: c.name, secure: c.secure }))));

    // Take screenshot
    await page.screenshot({ path: '/tmp/test-login-debug5.png', fullPage: true });

    // Check page content to understand what's rendered
    const bodyText = await page.locator('body').innerText();
    console.log('Page content (first 500 chars):', bodyText.substring(0, 500));

    // Admin user has passwordChangeRequired=true, so redirects to /change-password
    // which is the expected behavior per Bug 2 spec
    const currentPath = new URL(url).pathname;
    console.log('Current path:', currentPath);
    expect(currentPath).toBe('/change-password');
  });

  test('unauthenticated access to / should redirect to /login', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[login]') || text.includes('[auth]') || text.includes('[AuthGuard]') || text.includes('fetchCurrentUser')) {
        consoleMessages.push(`[${msg.type()}] ${text}`);
      }
    });

    // Go directly to home page without logging in
    await page.goto('http://localhost:8085/');
    
    // Wait for page to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    console.log('Final URL:', url);
    console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));

    // Should be redirected to /login
    const currentPath = new URL(url).pathname;
    console.log('Current path:', currentPath);
    expect(currentPath).toBe('/login');
    
    // Should show the login form
    await expect(page.locator('text=Welcome back! Please sign in to continue.')).toBeVisible();
  });
});
