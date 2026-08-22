// Shared password-strength rules, applied identically to every place a new
// password is accepted (self-service changes, resets, admin-setup, and
// admin-managed user updates) so the policy can't drift between endpoints.
export function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < 12) {
    return { valid: false, message: "Password must be at least 12 characters long" };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password must not exceed 128 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character" };
  }
  return { valid: true, message: "" };
}
