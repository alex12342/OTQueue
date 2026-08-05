export interface SsoUserInfo {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  hd?: string;
}

export interface SsoProvider {
  /** The provider name (e.g. "google") */
  name: string;

  /** Initialize the provider with its credentials */
  init(): void;

  /** Get the authorization URL to redirect the user to */
  getAuthorizationUrl(returnTo?: string): Promise<string>;

  /** Exchange the authorization code for user info */
  exchangeCode(code: string, callbackUrl: string): Promise<SsoUserInfo>;

  /** Validate user info against domain/whitelist restrictions */
  validateUser(userInfo: SsoUserInfo): Promise<{ allowed: true } | { allowed: false; reason: string }>;
}
