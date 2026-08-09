import { customFetch, setAuthTokenGetter } from "@workspace/api-client-react";

let _isLoggedIn = false;
let _userEmail: string | null = null;
let _userRole: "user" | "admin" | "viewer" | null = null;
let _userId: string | null = null;
let _isAuthInitialized = false;
let _passwordChangeRequired = false;
let _currentUser: { id: string; email: string; name: string; role: string; passwordChangeRequired: boolean } | null = null;
let _token: string | null = null;

const TOKEN_STORAGE_KEY = "otqueue_token";
const USER_STORAGE_KEY = "otqueue_user";

/**
 * Dispatched whenever the server rejects a request with 401 Unauthorized.
 * Components listen for this event to know they need to redirect to /login.
 */
export const AUTH_EXPIRED_EVENT = "otqueue:auth-expired";

/**
 * Clear all in-memory auth state, purge localStorage, and redirect to /login.
 * Call this when you know the session is no longer valid (401, explicit sign-out, etc.).
 */
export function handleAuthExpired() {
  // Signal the rest of the app that auth is gone
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));

  _token = null;
  setAuthTokenGetter(null);
  _isLoggedIn = false;
  _userEmail = null;
  _userRole = null;
  _userId = null;
  _currentUser = null;
  _passwordChangeRequired = false;

  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {}

  // Force a full page reload to /login so React re-mounts and AuthGuard
  // runs the "no-session" path on the next navigation cycle.
  window.location.href = "/login";
}

/**
 * Initialize the auth system by checking for a stored JWT token
 */
export async function initAuth() {
  _token = getStoredToken();
  
  // Register the token getter so customFetch attaches Authorization headers
  if (_token) {
    setAuthTokenGetter(() => _token);
  }

  const user = await fetchCurrentUser();
  if (user) {
    _isLoggedIn = true;
    _userEmail = user.email;
    _userRole = user.role;
    _userId = user.id || null;
    _passwordChangeRequired = user.passwordChangeRequired || false;
  } else {
    _isLoggedIn = false;
    _userEmail = null;
    _userRole = null;
    _userId = null;
    _passwordChangeRequired = false;
  }
  _isAuthInitialized = true;
}

/**
 * Get the auth token (JWT)
 */
export function getAuthToken(): string | null {
  return _token;
}

/**
 * Set the current user info and token (called after successful login)
 */
export function setCurrentUser(email: string, role: "user" | "admin" | "viewer", token: string, user: { id: string; name: string; passwordChangeRequired: boolean }) {
  _token = token;
  setAuthTokenGetter(() => _token);
  _isLoggedIn = true;
  _userEmail = email;
  _userRole = role;
  _userId = user.id || null;
  _passwordChangeRequired = user.passwordChangeRequired || false;
  _currentUser = { id: user.id, email, name: user.name, role, passwordChangeRequired: user.passwordChangeRequired || false };
  
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(_currentUser));
  } catch {}
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    await customFetch("/api/auth/logout", {
      method: "POST",
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    _token = null;
    setAuthTokenGetter(null);
    _isLoggedIn = false;
    _userEmail = null;
    _userRole = null;
    _userId = null;
    _currentUser = null;
    _passwordChangeRequired = false;
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {}
  }
}

/**
 * Get the stored token from localStorage
 */
function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Get the stored user from localStorage
 */
function getStoredUser(): { id: string; email: string; name: string; role: "user" | "admin" | "viewer"; passwordChangeRequired: boolean } | null {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Check if the user is currently logged in
 */
export function isLoggedIn(): boolean {
  return _isLoggedIn;
}

/**
 * Get the current user's email
 */
export function getUserEmail(): string | null {
  return _userEmail;
}

/**
 * Get the current user's role (admin or user)
 */
export function getUserRole(): string | null {
  return _userRole;
}

/**
 * Get the current user's ID
 */
export function getUserId(): string | null {
  return _userId;
}

/**
 * Set the current user info (called after successful login)
 * Kept for backwards compatibility
 */
export function setCurrentUserEmail(email: string, role: "user" | "admin" | "viewer", id: string) {
  _isLoggedIn = true;
  _userEmail = email;
  _userRole = role;
  _userId = id;
  _currentUser = { id, email, name: '', role, passwordChangeRequired: false };
}

/**
 * Fetch current user info from the API
 */
export async function fetchCurrentUser(): Promise<{ email: string; role: "user" | "admin" | "viewer"; id: string; passwordChangeRequired?: boolean } | null> {
  // Always verify with the API when we have a token — server is the source of truth
  // for passwordChangeRequired and other server-managed fields
  if (_token) {
    try {
      const data = await customFetch<{ authenticated: boolean; user: { id: string; email: string; role: "user" | "admin" | "viewer"; passwordChangeRequired?: boolean } }>("/api/auth/verify-session", {
        method: "GET",
      });
      if (data.authenticated && data.user) {
        _isLoggedIn = true;
        _userEmail = data.user.email;
        _userRole = data.user.role;
        _userId = data.user.id || null;
        _passwordChangeRequired = data.user.passwordChangeRequired || false;
        _currentUser = { id: data.user.id, email: data.user.email, name: data.user.email, role: data.user.role, passwordChangeRequired: data.user.passwordChangeRequired || false };
        return {
          email: data.user.email,
          role: data.user.role,
          id: data.user.id,
          passwordChangeRequired: data.user.passwordChangeRequired || false,
        };
      }
      // Server explicitly says not authenticated — session is invalid
      return null;
    } catch (err: any) {
      // If the server returned 401 (or the fetch failed while a token was set),
      // the token is stale or the session is gone. Do NOT fall back to localStorage.
      if (err?.status === 401) {
        return null;
      }
      // Network error (server down, DNS, etc.) — fall through to localStorage cache
      console.warn('[auth] fetchCurrentUser: network error, falling back to localStorage', err);
    }
  }

  // Fallback to stored user in localStorage only when no token is available
  // (i.e., user is genuinely not logged in or the token was never set).
  const storedUser = getStoredUser();
  console.log('[auth] fetchCurrentUser: storedUser =', storedUser);
  if (storedUser) {
    _isLoggedIn = true;
    _userEmail = storedUser.email;
    _userRole = storedUser.role;
    _userId = storedUser.id || null;
    _passwordChangeRequired = storedUser.passwordChangeRequired || false;
    _currentUser = storedUser;
    return {
      email: storedUser.email,
      role: storedUser.role,
      id: storedUser.id,
      passwordChangeRequired: storedUser.passwordChangeRequired || false,
    };
  }

  return null;
}

/**
 * Check if the user has admin privileges
 */
export function isAdmin(): boolean {
  return _isLoggedIn && _userRole === "admin";
}

export function isViewer(): boolean {
  return _isLoggedIn && _userRole === "viewer";
}

export function isAuthInitialized(): boolean {
  return _isAuthInitialized;
}

export function getPasswordChangeRequired(): boolean {
  return _passwordChangeRequired;
}

export function setPasswordChangeRequired(required: boolean) {
  _passwordChangeRequired = required;
  if (_currentUser) {
    _currentUser = { ..._currentUser, passwordChangeRequired: required };
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(_currentUser));
    } catch {}
  }
}

export default {
  initAuth,
  getAuthToken,
  setCurrentUser,
  signOut,
  isLoggedIn,
  getUserEmail,
  getUserRole,
  isAdmin,
  isViewer,
  isAuthInitialized,
};
