import { test, expect } from '@playwright/test';

test.describe('Sidebar logout', () => {
  test('logout link exists in sidebar and redirects to login', async ({ page }) => {
    // Login first
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

    // Click "Continue to Dashboard" button to get to the main app
    await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify we're on the home page
    expect(page.url()).toContain('/');

    // Click the logout link in the sidebar
    await page.getByRole('link', { name: 'Logout' }).click();

    // Should redirect to login page
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');
    await expect(page.locator('text=Welcome back! Please sign in to continue.')).toBeVisible();
  });
});
