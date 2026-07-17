# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/admin-settings-users.spec.ts >> Admin user management in Settings >> admin can see user management content in Settings
- Location: tests/admin-settings-users.spec.ts:35:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: 'Current Password' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e6]:
      - heading "OTQue" [level=1] [ref=e7]
      - generic [ref=e8]: Welcome back! Please sign in to continue.
    - generic [ref=e9]:
      - alert [ref=e10]:
        - generic [ref=e11]: Invalid credentials or account inactive
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Email Address
          - generic [ref=e14]:
            - img [ref=e15]
            - textbox "Email Address" [ref=e18]:
              - /placeholder: name@example.com
              - text: admin@otqueue.local
        - generic [ref=e19]:
          - text: Password
          - generic [ref=e20]:
            - img [ref=e21]
            - textbox "Password" [ref=e24]:
              - /placeholder: Enter your password
              - text: Admin@123!
            - button [ref=e25]:
              - img [ref=e26]
        - button "Sign In" [ref=e29]
      - link "Forgot password?" [ref=e31] [cursor=pointer]:
        - /url: /forgot-password
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Admin user management in Settings', () => {
  4   |   test('admin can see Users tab in Settings', async ({ page }) => {
  5   |     await page.goto('http://localhost:8085/login');
  6   |     await page.getByLabel('Email Address').fill('admin@otqueue.local');
  7   |     await page.getByLabel('Password').fill('Admin@123!');
  8   |     await page.getByRole('button', { name: 'Sign In' }).click();
  9   |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  10  |     await page.waitForTimeout(2000);
  11  | 
  12  |     // Admin has passwordChangeRequired=true, so redirected to /change-password
  13  |     // Change password first to unlock full navigation
  14  |     await page.getByRole('textbox', { name: 'Current Password' }).fill('Admin@123!');
  15  |     await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('NewAdmin@123!abc');
  16  |     await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('NewAdmin@123!abc');
  17  |     await page.getByRole('button', { name: 'Change Password' }).click();
  18  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  19  |     await page.waitForTimeout(1000);
  20  | 
  21  |     // Click "Continue to Dashboard" button
  22  |     await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
  23  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  24  |     await page.waitForTimeout(1000);
  25  | 
  26  |     // Navigate to Settings
  27  |     await page.getByRole('link', { name: 'Settings' }).click();
  28  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  29  |     await page.waitForTimeout(1000);
  30  | 
  31  |     // Check that the Users tab exists (TabsTrigger, not tab role)
  32  |     await expect(page.getByRole('tab', { name: 'Users' })).toBeVisible();
  33  |   });
  34  | 
  35  |   test('admin can see user management content in Settings', async ({ page }) => {
  36  |     await page.goto('http://localhost:8085/login');
  37  |     await page.getByLabel('Email Address').fill('admin@otqueue.local');
  38  |     await page.getByLabel('Password').fill('Admin@123!');
  39  |     await page.getByRole('button', { name: 'Sign In' }).click();
  40  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  41  |     await page.waitForTimeout(2000);
  42  | 
  43  |     // Admin has passwordChangeRequired=true, so redirected to /change-password
  44  |     // Change password first to unlock full navigation
> 45  |     await page.getByRole('textbox', { name: 'Current Password' }).fill('Admin@123!');
      |                                                                   ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  46  |     await page.getByRole('textbox', { name: 'New Password', exact: true }).fill('NewAdmin@123!abc');
  47  |     await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('NewAdmin@123!abc');
  48  |     await page.getByRole('textbox', { name: 'New Password' }).fill('NewAdmin@123!abc');
  49  |     await page.getByRole('textbox', { name: 'Confirm New Password' }).fill('NewAdmin@123!abc');
  50  |     await page.getByRole('button', { name: 'Change Password' }).click();
  51  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  52  |     await page.waitForTimeout(1000);
  53  | 
  54  |     // Click "Continue to Dashboard" button
  55  |     await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
  56  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  57  |     await page.waitForTimeout(1000);
  58  | 
  59  |     // Navigate to Settings
  60  |     await page.getByRole('link', { name: 'Settings' }).click();
  61  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  62  |     await page.waitForTimeout(1000);
  63  | 
  64  |     // Click the Users tab
  65  |     await page.getByRole('tab', { name: 'Users' }).click();
  66  |     await page.waitForTimeout(2000);
  67  | 
  68  |     // Check that user management content is visible
  69  |     await expect(page.getByText('All Users')).toBeVisible({ timeout: 5000 });
  70  |     await expect(page.getByRole('button', { name: 'Create New User' })).toBeVisible({ timeout: 5000 });
  71  |   });
  72  | 
  73  |   test('non-admin user cannot see Users tab in Settings', async ({ page }) => {
  74  |     // Create a standard user via the admin setup endpoint (ignore 409 conflict)
  75  |     const setupStatus = await page.evaluate(async () => {
  76  |       const resp = await fetch('http://localhost:8085/api/auth/admin-setup', {
  77  |         method: 'POST',
  78  |         headers: { 'Content-Type': 'application/json' },
  79  |         body: JSON.stringify({
  80  |           email: 'user@otqueue.local',
  81  |           password: 'User@123!abc',
  82  |           name: 'Test User',
  83  |           role: 'user',
  84  |         }),
  85  |       });
  86  |       return resp.status;
  87  |     });
  88  |     expect([201, 409]).toContain(setupStatus);
  89  |     // 201 = created, 409 = already exists - both are acceptable
  90  | 
  91  |     // Logout any existing session
  92  |     await page.context().clearCookies();
  93  |     await page.evaluate(() => { try { sessionStorage.clear(); } catch {} });
  94  | 
  95  |     // Login as standard user
  96  |     await page.goto('http://localhost:8085/login');
  97  |     await page.waitForTimeout(1000);
  98  |     console.log('[test] Before login, URL:', page.url());
  99  |     await page.getByLabel('Email Address').fill('user@otqueue.local');
  100 |     await page.getByLabel('Password').fill('User@123!abc');
  101 |     await page.getByRole('button', { name: 'Sign In' }).click();
  102 |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  103 |     await page.waitForTimeout(2000);
  104 |     console.log('[test] After login, URL:', page.url());
  105 |     const bodyText = await page.locator('body').innerText();
  106 |     console.log('[test] Body text:', bodyText.substring(0, 300));
  107 | 
  108 |     // Navigate to Settings
  109 |     await page.getByRole('link', { name: 'Settings' }).click();
  110 |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  111 |     await page.waitForTimeout(1000);
  112 | 
  113 |     // The Users tab should be visible but clicking it should show access denied
  114 |     const usersTab = page.getByRole('tab', { name: 'Users' });
  115 |     const isVisible = await usersTab.isVisible();
  116 | 
  117 |     if (isVisible) {
  118 |       await usersTab.click();
  119 |       await page.waitForTimeout(500);
  120 |       await expect(page.getByText('Access denied. Only administrators can manage users.')).toBeVisible();
  121 |     } else {
  122 |       await expect(usersTab).not.toBeVisible();
  123 |     }
  124 |   });
  125 | });
  126 | 
```