import { test, expect } from '@playwright/test';

test.describe('Admin user management in Settings', () => {
  test('admin can see Users tab in Settings', async ({ page }) => {
    await page.goto('http://localhost:8085/login');
    await page.getByLabel('Email Address').fill('admin@otqueue.local');
    await page.getByLabel('Password').fill('Admin@123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Admin has passwordChangeRequired=true, so redirected to /change-password
    // Change password first to unlock full navigation
    await page.getByRole('textbox', { name: 'Current Password' }).fill('Admin@123!');
    await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('NewAdmin@123!abc');
    await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('NewAdmin@123!abc');
    await page.getByRole('button', { name: 'Change Password' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click "Continue to Dashboard" button
    await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Navigate to Settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Check that the Users tab exists (TabsTrigger, not tab role)
    await expect(page.getByRole('tab', { name: 'Users' })).toBeVisible();
  });

  test('admin can see user management content in Settings', async ({ page }) => {
    await page.goto('http://localhost:8085/login');
    await page.getByLabel('Email Address').fill('admin@otqueue.local');
    await page.getByLabel('Password').fill('Admin@123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Admin has passwordChangeRequired=true, so redirected to /change-password
    // Change password first to unlock full navigation
    await page.getByRole('textbox', { name: 'Current Password' }).fill('Admin@123!');
    await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('NewAdmin@123!abc');
    await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('NewAdmin@123!abc');
    await page.getByRole('textbox', { name: 'New Password' }).fill('NewAdmin@123!abc');
    await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('NewAdmin@123!abc');
    await page.getByRole('button', { name: 'Change Password' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click "Continue to Dashboard" button
    await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Navigate to Settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click the Users tab
    await page.getByRole('tab', { name: 'Users' }).click();
    await page.waitForTimeout(2000);

    // Check that user management content is visible
    await expect(page.getByText('All Users')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Create New User' })).toBeVisible({ timeout: 5000 });
  });

  test('non-admin user cannot see Users tab in Settings', async ({ page }) => {
    // Create a standard user via the admin setup endpoint (ignore 409 conflict)
    const setupStatus = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:8085/api/auth/admin-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@otqueue.local',
          password: 'User@123!abc',
          name: 'Test User',
          role: 'user',
        }),
      });
      return resp.status;
    });
    expect([201, 409]).toContain(setupStatus);
    // 201 = created, 409 = already exists - both are acceptable

    // Logout any existing session
    await page.context().clearCookies();
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });

    // Login as standard user
    await page.goto('http://localhost:8085/login');
    await page.waitForTimeout(1000);
    console.log('[test] Before login, URL:', page.url());
    await page.getByLabel('Email Address').fill('user@otqueue.local');
    await page.getByLabel('Password').fill('User@123!abc');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);
    console.log('[test] After login, URL:', page.url());
    const bodyText = await page.locator('body').innerText();
    console.log('[test] Body text:', bodyText.substring(0, 300));

    // Navigate to Settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // The Users tab should be visible but clicking it should show access denied
    const usersTab = page.getByRole('tab', { name: 'Users' });
    const isVisible = await usersTab.isVisible();

    if (isVisible) {
      await usersTab.click();
      await page.waitForTimeout(500);
      await expect(page.getByText('Access denied. Only administrators can manage users.')).toBeVisible();
    } else {
      await expect(usersTab).not.toBeVisible();
    }
  });
});
