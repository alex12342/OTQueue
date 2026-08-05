import { SsoProvider, SsoUserInfo } from ".";

function getWhitelist(): Promise<string[]> {
  const whitelistFile = process.env.SSO_WHITELIST_FILE || "/app/data/sso-whitelist.json";
  const fs = require("fs");
  const path = require("path");

  const dir = path.dirname(whitelistFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(whitelistFile)) {
    fs.writeFileSync(whitelistFile, "[]", "utf-8");
  }

  const content = fs.readFileSync(whitelistFile, "utf-8");
  try {
    const data = JSON.parse(content);
    return Promise.resolve(Array.isArray(data) ? data : []);
  } catch {
    return Promise.resolve([]);
  }
}

function matchesDomain(email: string, domain: string): boolean {
  const normalizedDomain = domain.startsWith("@") ? domain.slice(1) : domain;
  const normalizedEmail = email.toLowerCase();
  return normalizedEmail.endsWith(`@${normalizedDomain}`);
}

function buildAuthorizationUrl(): string {
  const clientID = process.env.SSO_CLIENT_ID || "";
  const appUrl = process.env.APP_URL || "http://localhost:8080";
  const callbackURL = `${appUrl}/api/sso/callback`;

  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientID)}` +
    `&redirect_uri=${encodeURIComponent(callbackURL)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` +
    `&prompt=select_account` +
    `&access_type=offline`
  );
}

async function exchangeCodeForUserInfo(code: string, callbackUrl: string): Promise<SsoUserInfo> {
  const clientID = process.env.SSO_CLIENT_ID || "";
  const clientSecret = process.env.SSO_CLIENT_SECRET || "";

  // Exchange authorization code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientID,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Failed to exchange code: ${text}`);
  }

  const tokenData = (await tokenResponse.json()) as { id_token?: string };
  const idToken = tokenData.id_token;

  if (!idToken) {
    throw new Error("Google did not return an ID token");
  }

  // Decode the ID token payload (middle part of JWT)
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ID token format");
  }

  const payload = Buffer.from(parts[1], "base64").toString("utf-8");
  const decoded: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    hd?: string;
  } = JSON.parse(payload);

  return {
    googleId: decoded.sub || "",
    email: decoded.email || "",
    emailVerified: decoded.email_verified || false,
    name: decoded.name || decoded.email || "",
    hd: decoded.hd,
  };
}

async function validateUser(userInfo: SsoUserInfo): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  // 1. Check email verification (critical for account linking safety)
  if (!userInfo.emailVerified) {
    return { allowed: false, reason: "email_unverified" };
  }

  // 2. Check explicit whitelist first (if enabled)
  const allowWhitelist = process.env.SSO_ALLOW_WHITELIST === "true";
  if (allowWhitelist) {
    const whitelist = await getWhitelist();
    if (whitelist.includes(userInfo.email.toLowerCase())) {
      return { allowed: true };
    }
  }

  // 3. Check domain restriction (if enabled)
  const allowedDomain = process.env.SSO_ALLOWED_DOMAIN;
  if (allowedDomain) {
    if (matchesDomain(userInfo.email, allowedDomain)) {
      return { allowed: true };
    }
  }

  // 4. If domain restriction is set but email doesn't match, reject
  if (allowedDomain) {
    return { allowed: false, reason: "domain_restricted" };
  }

  // No domain restriction and not in whitelist (or whitelist not enabled) — allow
  return { allowed: true };
}

export class GoogleAuthProvider implements SsoProvider {
  name = "google";

  init(): void {
    const clientID = process.env.SSO_CLIENT_ID;
    const clientSecret = process.env.SSO_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      throw new Error("SSO_CLIENT_ID and SSO_CLIENT_SECRET are required for Google OAuth");
    }
  }

  getAuthorizationUrl(): Promise<string> {
    return Promise.resolve(buildAuthorizationUrl());
  }

  async exchangeCode(code: string, callbackUrl: string): Promise<SsoUserInfo> {
    return exchangeCodeForUserInfo(code, callbackUrl);
  }

  async validateUser(userInfo: SsoUserInfo): Promise<{ allowed: true } | { allowed: false; reason: string }> {
    return validateUser(userInfo);
  }
}
