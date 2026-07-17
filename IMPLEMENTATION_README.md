# User Authentication & Admin Panel Implementation Guide

## Overview
This document describes the user authentication and admin panel features implemented for OTQue.

## Features Implemented

### 1. Authentication System (`/api/auth/*`)
- **Login** (`POST /login`): Authenticates users with email/password, sets session cookie
- **Register** (`POST /register`): Creates new user accounts
- **Admin Creation** (`POST /admin`): Creates admin user accounts (for setup)
- **Logout** (`POST /logout`): Clears session and logs out user

### 2. Admin Panel (`/admin/*`)
- **Dashboard** (`/admin`): Overview of all users with statistics
- **User Management** (`/admin/users`): CRUD operations for users
  - List all users
  - Toggle active/inactive status
  - View user details
  - Delete users

### 3. Frontend Pages
- **Login Page** (`/login`)
- **Register Page** (`/register`)  
- **Admin Dashboard** (`/admin`)
- **Admin Users Management** (`/admin/users`)

## Setup Instructions

### Server-Side (API Server)

1. Install dependencies:
```bash
cd artifacts/api-server
pnpm install express-session uuid
```

2. The auth routes are automatically included in `src/routes/index.ts`

3. Session configuration is handled by cookie-parser middleware

### Frontend (Overtime Tracker)

1. All new pages are located in `artifacts/overtime-tracker/src/pages/`:
   - `login.tsx`
   - `register.tsx`
   - `admin-dashboard.tsx`
   - `admin-users.tsx`

2. Routes have been added to `App.tsx`:
```typescript
<Route path="/login" component={Login} />
<Route path="/register" component={Register} />
<Route path="/admin" component={AdminDashboard} />
<Route path="/admin/users" component={AdminUsers} />
```

## Authentication Flow

### Login Process
1. User enters email and password
2. Server validates credentials against `users` table
3. If valid, session cookie (`sessionId`) is set
4. User is redirected to dashboard or previous page
5. Session includes role information for admin route protection

### Session Management
- Sessions are stored as HTTP-only cookies
- Cookies expire after 7 days by default
- Production deployments should use HTTPS for secure sessions

## Admin Access Control

Admin-only routes are protected:

1. **Route-level check**: Admin users must have `role: "admin"` in database
2. **Session verification**: Routes check session cookie before accessing admin endpoints
3. **Automatic redirect**: Non-admin users attempting to access `/admin/*` are redirected to login

### Protected API Endpoints
- `GET /api/admin/users` - List all users (admin only)
- `POST /api/admin/users` - Create user (admin only)
- `PUT /api/admin/users/:id` - Update user (admin only)
- `DELETE /api/admin/users/:id` - Delete user (admin only)
- `GET /api/admin/stats` - View statistics (admin only)

## Creating Admin User

To create the initial admin user:

```bash
POST /api/auth/admin
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123",
  "name": "Admin User"
}
```

## Database Schema

The `users` table includes:
- `id`: UUID primary key
- `email`: Unique email address
- `passwordHash`: Bcrypt hashed password
- `name`: User display name
- `role`: "user" or "admin"
- `isActive`: Active/inactive status
- `lastLoginAt`: Timestamp of last login
- `createdAt`: Account creation timestamp
- `updatedAt`: Last update timestamp

## Security Considerations

1. **Password Hashing**: All passwords are hashed with bcrypt (cost factor 10)
2. **Session Cookies**: HTTP-only, secure (in production), SameSite cookies
3. **Admin Access**: Role-based access control enforced at both API and UI level
4. **Login Attempts**: Consider implementing rate limiting for login attempts
5. **HTTPS Required**: Production deployments must use HTTPS for session security

## Next Steps

1. **Implement JWT Tokens (Optional)**: For mobile apps or cross-origin scenarios
2. **Add Session Storage Table**: Track active sessions in separate table
3. **Implement Rate Limiting**: Protect against brute force attacks
4. **Add Password Reset**: Email-based password recovery
5. **Multi-Factor Authentication**: For enhanced security on admin accounts

## Files Created/Modified

### New Files
- `artifacts/overtime-tracker/src/pages/login.tsx`
- `artifacts/overtime-tracker/src/pages/register.tsx`
- `artifacts/overtime-tracker/src/pages/admin-dashboard.tsx`
- `artifacts/overtime-tracker/src/pages/admin-users.tsx`
- `artifacts/overtime-tracker/src/pages/logout.tsx`
- `lib/api-client-react/src/custom-fetch.ts` (updated)

### Modified Files
- `artifacts/api-server/src/routes/auth.ts` (session handling)
- `artifacts/api-server/src/routes/index.ts` (added auth & admin routes)
- `artifacts/overtime-tracker/src/App.tsx` (added auth routes)
- `artifacts/overtime-tracker/src/components/layout/sidebar-layout.tsx` (admin link added)

## Testing Checklist

- [ ] Can create new user account via /register
- [ ] Can login with valid credentials
- [ ] Can logout and clear session
- [ ] Admin panel accessible only to admin users
- [ ] User management works correctly (CRUD operations)
- [ ] Session persists across page reloads
- [ ] Statistics display correctly in admin dashboard
