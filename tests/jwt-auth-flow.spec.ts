import { test, expect } from '@playwright/test';

test.describe('JWT Auth flow', () => {
  test('login returns JWT token and redirects appropriately', async ({ page }) => {
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
    
    // Wait for navigation
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('Final URL:', url);
    console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));
    
    // Check localStorage has user and token
    const storedUser = await page.evaluate(() => localStorage.getItem('otqueue_user'));
    const storedToken = await page.evaluate(() => localStorage.getItem('otqueue_token'));
    console.log('localStorage user:', storedUser);
    console.log('localStorage token:', storedToken);

    // Take screenshot
    await page.screenshot({ path: '/tmp/test-jwt-login.png', fullPage: true });

    // Verify token was stored
    expect(storedToken).toBeTruthy();
    expect(storedToken!.length).toBeGreaterThan(10);

    // Verify user was stored
    expect(storedUser).toBeTruthy();
    const parsedUser = JSON.parse(storedUser!);
    expect(parsedUser.email).toBe('admin@otqueue.local');
  });

  test('unauthenticated access to / should redirect to /login', async ({ page }) => {
    // Clear cookies and storage via browser context
    const context = await page.context();
    await context.clearCookies();
    
    // Go directly to home page
    await page.goto('http://localhost:8085/');
    
    // Wait for page to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    console.log('Final URL:', url);

    // Should be redirected to /login
    const currentPath = new URL(url).pathname;
    console.log('Current path:', currentPath);
    expect(currentPath).toBe('/login');
    
    // Should show the login form
    await expect(page.locator('text=Welcome back! Please sign in to continue.')).toBeVisible();
  });

  test('API requests include Authorization header after login', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:8085/login');
    await page.getByLabel('Email Address').fill('admin@otqueue.local');
    await page.getByLabel('Password').fill('Admin@123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Intercept API calls and check for Authorization header
    const authHeaders: string[] = [];
    page.on('request', async request => {
      const url = request.url();
      if (url.startsWith('http://localhost:8085/api/')) {
        const auth = await request.headerValue('authorization');
        if (auth) {
          authHeaders.push(auth);
        }
      }
    });

    // Trigger a session verify call (AuthGuard does this on page load)
    await page.goto('http://localhost:8085/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(3000);

    console.log('Authorization headers seen:', authHeaders);
    expect(authHeaders.length).toBeGreaterThan(0);
    
    // Verify the header starts with "Bearer "
    for (const header of authHeaders) {
      expect(header).toMatch(/^Bearer [A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/);
    }
  });
});
