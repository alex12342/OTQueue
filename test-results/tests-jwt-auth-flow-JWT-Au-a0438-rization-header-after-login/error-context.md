# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/jwt-auth-flow.spec.ts >> JWT Auth flow >> API requests include Authorization header after login
- Location: tests/jwt-auth-flow.spec.ts:75:7

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e6]:
      - heading "OTQue" [level=1] [ref=e7]
      - generic [ref=e8]: Welcome back! Please sign in to continue.
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11]:
          - text: Email Address
          - generic [ref=e12]:
            - img [ref=e13]
            - textbox "Email Address" [ref=e16]:
              - /placeholder: name@example.com
        - generic [ref=e17]:
          - text: Password
          - generic [ref=e18]:
            - img [ref=e19]
            - textbox "Password" [ref=e22]:
              - /placeholder: Enter your password
            - button [ref=e23]:
              - img [ref=e24]
        - button "Sign In" [disabled]
      - link "Forgot password?" [ref=e28] [cursor=pointer]:
        - /url: /forgot-password
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  2   | 
  3   | test.describe('JWT Auth flow', () => {
  4   |   test('login returns JWT token and redirects appropriately', async ({ page }) => {
  5   |     const consoleMessages: string[] = [];
  6   |     page.on('console', msg => {
  7   |       const text = msg.text();
  8   |       if (text.includes('[login]') || text.includes('[auth]') || text.includes('[AuthGuard]') || text.includes('fetchCurrentUser')) {
  9   |         consoleMessages.push(`[${msg.type()}] ${text}`);
  10  |       }
  11  |     });
  12  | 
  13  |     // Go to login page
  14  |     await page.goto('http://localhost:8085/login');
  15  |     await expect(page.locator('text=Welcome back! Please sign in to continue.')).toBeVisible();
  16  | 
  17  |     // Fill in credentials
  18  |     await page.getByLabel('Email Address').fill('admin@otqueue.local');
  19  |     await page.getByLabel('Password').fill('Admin@123!');
  20  | 
  21  |     // Click sign in and wait for full navigation
  22  |     await page.getByRole('button', { name: 'Sign In' }).click();
  23  |     
  24  |     // Wait for navigation
  25  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  26  |     await page.waitForTimeout(3000);
  27  | 
  28  |     const url = page.url();
  29  |     console.log('Final URL:', url);
  30  |     console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));
  31  |     
  32  |     // Check sessionStorage has user and token
  33  |     const storedUser = await page.evaluate(() => sessionStorage.getItem('otqueue_user'));
  34  |     const storedToken = await page.evaluate(() => sessionStorage.getItem('otqueue_token'));
  35  |     console.log('sessionStorage user:', storedUser);
  36  |     console.log('sessionStorage token:', storedToken);
  37  | 
  38  |     // Take screenshot
  39  |     await page.screenshot({ path: '/tmp/test-jwt-login.png', fullPage: true });
  40  | 
  41  |     // Verify token was stored
  42  |     expect(storedToken).toBeTruthy();
  43  |     expect(storedToken!.length).toBeGreaterThan(10);
  44  | 
  45  |     // Verify user was stored
  46  |     expect(storedUser).toBeTruthy();
  47  |     const parsedUser = JSON.parse(storedUser!);
  48  |     expect(parsedUser.email).toBe('admin@otqueue.local');
  49  |   });
  50  | 
  51  |   test('unauthenticated access to / should redirect to /login', async ({ page }) => {
  52  |     // Clear cookies and storage via browser context
  53  |     const context = await page.context();
  54  |     await context.clearCookies();
  55  |     
  56  |     // Go directly to home page
  57  |     await page.goto('http://localhost:8085/');
  58  |     
  59  |     // Wait for page to settle
  60  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  61  |     await page.waitForTimeout(2000);
  62  | 
  63  |     const url = page.url();
  64  |     console.log('Final URL:', url);
  65  | 
  66  |     // Should be redirected to /login
  67  |     const currentPath = new URL(url).pathname;
  68  |     console.log('Current path:', currentPath);
  69  |     expect(currentPath).toBe('/login');
  70  |     
  71  |     // Should show the login form
  72  |     await expect(page.locator('text=Welcome back! Please sign in to continue.')).toBeVisible();
  73  |   });
  74  | 
  75  |   test('API requests include Authorization header after login', async ({ page }) => {
  76  |     // Login first
  77  |     await page.goto('http://localhost:8085/login');
  78  |     await page.getByLabel('Email Address').fill('admin@otqueue.local');
  79  |     await page.getByLabel('Password').fill('Admin@123!');
  80  |     await page.getByRole('button', { name: 'Sign In' }).click();
  81  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  82  |     await page.waitForTimeout(2000);
  83  | 
  84  |     // Intercept API calls and check for Authorization header
  85  |     const authHeaders: string[] = [];
  86  |     page.on('request', async request => {
  87  |       const url = request.url();
  88  |       if (url.startsWith('http://localhost:8085/api/')) {
  89  |         const auth = await request.headerValue('authorization');
  90  |         if (auth) {
  91  |           authHeaders.push(auth);
  92  |         }
  93  |       }
  94  |     });
  95  | 
  96  |     // Trigger a session verify call (AuthGuard does this on page load)
  97  |     await page.goto('http://localhost:8085/');
  98  |     await page.waitForLoadState('networkidle', { timeout: 10000 });
  99  |     await page.waitForTimeout(3000);
  100 | 
  101 |     console.log('Authorization headers seen:', authHeaders);
> 102 |     expect(authHeaders.length).toBeGreaterThan(0);
      |                                ^ Error: expect(received).toBeGreaterThan(expected)
  103 |     
  104 |     // Verify the header starts with "Bearer "
  105 |     for (const header of authHeaders) {
  106 |       expect(header).toMatch(/^Bearer [A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/);
  107 |     }
  108 |   });
  109 | });
  110 | 
```