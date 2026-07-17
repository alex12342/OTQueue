# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/sidebar-logout.spec.ts >> Sidebar logout >> logout link exists in sidebar and redirects to login
- Location: tests/sidebar-logout.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Logout' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img [ref=e6]
        - generic [ref=e9]: OTQue
      - generic [ref=e10]:
        - navigation [ref=e11]:
          - generic [ref=e12]: Menu
          - link "Up Next" [ref=e13] [cursor=pointer]:
            - /url: /
            - img [ref=e14]
            - text: Up Next
          - link "Log Event" [ref=e19] [cursor=pointer]:
            - /url: /events/new
            - img [ref=e20]
            - text: Log Event
          - link "Event Log" [ref=e22] [cursor=pointer]:
            - /url: /log
            - img [ref=e23]
            - text: Event Log
          - link "Employees" [ref=e27] [cursor=pointer]:
            - /url: /employees
            - img [ref=e28]
            - text: Employees
        - generic [ref=e33]:
          - link "Settings" [ref=e34] [cursor=pointer]:
            - /url: /settings
            - img [ref=e35]
            - text: Settings
          - link "Help" [ref=e38] [cursor=pointer]:
            - /url: /help
            - img [ref=e39]
            - text: Help
    - main [ref=e42]:
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic [ref=e46]:
            - heading "Employees" [level=1] [ref=e47]
            - paragraph [ref=e48]: Manage roster, seniority, and active status.
          - button "Add Employee" [disabled]:
            - img
            - text: Add Employee
        - table [ref=e52]:
          - rowgroup [ref=e53]:
            - row "Name Seniority Role Subclass Status Offered Hours Actions" [ref=e54]:
              - columnheader "Name" [ref=e55]
              - columnheader "Seniority" [ref=e56]
              - columnheader "Role" [ref=e57]
              - columnheader "Subclass" [ref=e58]
              - columnheader "Status" [ref=e59]
              - columnheader "Offered Hours" [ref=e60]
              - columnheader "Actions" [ref=e61]
          - rowgroup [ref=e62]:
            - row "Select a roster to view employees." [ref=e63]:
              - cell "Select a roster to view employees." [ref=e64]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Sidebar logout', () => {
  4  |   test('logout link exists in sidebar and redirects to login', async ({ page }) => {
  5  |     // Login first
  6  |     await page.goto('http://localhost:8085/login');
  7  |     await page.getByLabel('Email Address').fill('admin@otqueue.local');
  8  |     await page.getByLabel('Password').fill('Admin@123!');
  9  |     await page.getByRole('button', { name: 'Sign In' }).click();
  10 |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  11 |     await page.waitForTimeout(2000);
  12 | 
  13 |     // Admin has passwordChangeRequired=true, so redirected to /change-password
  14 |     // Change password first to unlock full navigation
  15 |     await page.getByRole('textbox', { name: 'Current Password' }).fill('Admin@123!');
  16 |     await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('NewAdmin@123!abc');
  17 |     await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('NewAdmin@123!abc');
  18 |     await page.getByRole('button', { name: 'Change Password' }).click();
  19 |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  20 |     await page.waitForTimeout(1000);
  21 | 
  22 |     // Click "Continue to Dashboard" button to get to the main app
  23 |     await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
  24 |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  25 |     await page.waitForTimeout(2000);
  26 | 
  27 |     // Verify we're on the home page
  28 |     expect(page.url()).toContain('/');
  29 | 
  30 |     // Click the logout link in the sidebar
> 31 |     await page.getByRole('link', { name: 'Logout' }).click();
     |                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  32 | 
  33 |     // Should redirect to login page
  34 |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  35 |     await page.waitForTimeout(1000);
  36 |     expect(page.url()).toContain('/login');
  37 |     await expect(page.locator('text=Welcome back! Please sign in to continue.')).toBeVisible();
  38 |   });
  39 | });
  40 | 
```