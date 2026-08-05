import { Router } from "express";
import jwt from "jsonwebtoken";
import { usersTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { GoogleAuthProvider } from "../lib/auth-providers/google";
import type { SsoUserInfo } from "../lib/auth-providers";
import fs from "fs";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but was not provided.");
}

const router = Router();

// ── Persistent pending-code store (survives server restarts) ──────────────────

const PENDING_CODES_FILE = path.join(process.env.DATA_DIR || "/app/data", "sso-pending-codes.json");

function loadPendingCodes(): Record<string, { userId: string; email: string; name: string; role: string; passwordChangeRequired: boolean; expiresAt: number }> {
  try {
    const raw = fs.readFileSync(PENDING_CODES_FILE, "utf-8");
    return JSON.parse(raw) as typeof loadPendingCodes.prototype.returnType;
  } catch {
    return {};
  }
}

function savePendingCodes(codes: typeof loadPendingCodes.prototype.returnType): void {
  try {
    fs.writeFileSync(PENDING_CODES_FILE, JSON.stringify(codes, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write SSO pending codes:", err);
  }
}

let pendingCodes: Record<string, { userId: string; email: string; name: string; role: string; passwordChangeRequired: boolean; expiresAt: number }> = loadPendingCodes();

const SSO_CODE_TTL_MS = 60_000; // 60 seconds

// Cleanup old codes periodically and persist
setInterval(() => {
  const now = Date.now();
  const cleaned: typeof loadPendingCodes.prototype.returnType = {};
  for (const [code, data] of Object.entries(pendingCodes)) {
    if (now <= data.expiresAt) {
      cleaned[code] = data;
    }
  }
  pendingCodes = cleaned;
  savePendingCodes(pendingCodes);
}, 30_000);

function getProvider(): GoogleAuthProvider {
  const provider = process.env.SSO_PROVIDER || "google";
  if (provider === "google") {
    return new GoogleAuthProvider();
  }
  // eslint-disable-next-line @typescript-eslint/no-throw-literal
  throw new Error(`Unsupported SSO provider: ${provider}`) as never;
}

function getAppUrl(): string {
  const url = process.env.APP_URL || "http://localhost:8080";
  return url;
}

// ── Redirect to Google OAuth ─────────────────────────────────────────────────

router.get("/", async (_req: any, res: any) => {
  try {
    const enabled = process.env.SSO_ENABLED === "true";
    if (!enabled) {
      return res.status(403).json({ message: "SSO is not enabled" });
    }

    const provider = getProvider();
    provider.init();

    const authUrl = await provider.getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error: any) {
    console.error("SSO redirect error:", error);
    const appUrl = process.env.APP_URL || "http://localhost:8080";
    res.redirect(`${appUrl}/login?error=sso_unavailable`);
  }
});

// ── Google OAuth callback ────────────────────────────────────────────────────

router.get("/callback", async (req, res) => {
  try {
    const enabled = process.env.SSO_ENABLED === "true";
    if (!enabled) {
      const appUrl = process.env.APP_URL || "http://localhost:8080";
      return res.redirect(`${appUrl}/login?error=sso_disabled`);
    }

    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      const appUrl = process.env.APP_URL || "http://localhost:8080";
      const errorReason = typeof req.query.error_description === "string"
        ? req.query.error_description
        : "authentication_failed";
      const encodedError = encodeURIComponent(String(errorReason));
      return res.redirect(`${appUrl}/login?error=${encodedError}`);
    }

    if (!code) {
      const appUrl = process.env.APP_URL || "http://localhost:8080";
      return res.redirect(`${appUrl}/login?error=no_code`);
    }

    const provider = getProvider();
    provider.init();

    // Exchange code for user info
    const callbackUrl = `${process.env.APP_URL || "http://localhost:8080"}/api/sso/callback`;
    const userInfo = await provider.exchangeCode(code, callbackUrl);

    // Validate user against domain/whitelist
    const validation = await provider.validateUser(userInfo);

    if (!validation.allowed) {
      console.warn(`SSO user rejected: ${userInfo.email} — ${validation.reason}`);
      const appUrl = process.env.APP_URL || "http://localhost:8080";
      return res.redirect(`${appUrl}/login?error=${validation.reason}`);
    }

    // Find or create user
    let user: { id: string; email: string; name: string; role: string; passwordChangeRequired: boolean } | null = null;

    // 1. Try to find by googleId
    const [existingByGoogle] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleId, userInfo.googleId))
      .limit(1);

    if (existingByGoogle) {
      // Existing Google-linked user — sync name from Google
      await db.update(usersTable).set({
        name: userInfo.name,
        updatedAt: new Date(),
      }).where(eq(usersTable.id, existingByGoogle.id));

      user = {
        id: existingByGoogle.id,
        email: existingByGoogle.email,
        name: userInfo.name,
        role: existingByGoogle.role,
        passwordChangeRequired: existingByGoogle.passwordChangeRequired || false,
      };
    } else {
      // 2. Try to find by email (for linking to existing password user)
      const [existingByEmail] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, userInfo.email.toLowerCase()))
        .limit(1);

      if (existingByEmail) {
        if (!userInfo.emailVerified) {
          // Safety: don't link to existing account if email not verified by Google
          const appUrl = process.env.APP_URL || "http://localhost:8080";
          return res.redirect(`${appUrl}/login?error=email_unverified`);
        }

        // Link Google account to existing user
        await db.update(usersTable).set({
          googleId: userInfo.googleId,
          name: userInfo.name,
          updatedAt: new Date(),
        }).where(eq(usersTable.id, existingByEmail.id));

        user = {
          id: existingByEmail.id,
          email: existingByEmail.email,
          name: userInfo.name,
          role: existingByEmail.role,
          passwordChangeRequired: existingByEmail.passwordChangeRequired || false,
        };
      } else {
        // 3. Create new user (auto-provision as viewer)
        const [newUser] = await db
          .insert(usersTable)
          .values({
            email: userInfo.email.toLowerCase(),
            passwordHash: "",
            name: userInfo.name,
            role: "viewer",
            isActive: true,
            googleId: userInfo.googleId,
          })
          .returning();

        user = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          passwordChangeRequired: newUser.passwordChangeRequired || false,
        };
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: String(user.id) },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // Store JWT in single-use pending code map
    const codeId = randomUUID();
    pendingCodes[codeId] = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordChangeRequired: user.passwordChangeRequired,
      expiresAt: Date.now() + SSO_CODE_TTL_MS,
    };
    savePendingCodes(pendingCodes);

    // Redirect to frontend with single-use code
    const appUrl = process.env.APP_URL || "http://localhost:8080";
    res.redirect(`${appUrl}/login/callback?code=${codeId}`);
  } catch (error) {
    console.error("SSO callback error:", error);
    const appUrl = process.env.APP_URL || "http://localhost:8080";
    res.redirect(`${appUrl}/login?error=sso_callback_failed`);
  }
});

// ── Exchange single-use code for JWT ─────────────────────────────────────────

router.post("/sso-exchange", async (req, res) => {
  try {
    const { code } = req.body as { code?: string };

    if (!code) {
      return res.status(400).json({ message: "Code is required" });
    }

    const pending = pendingCodes[code];

    if (!pending) {
      return res.status(401).json({ message: "Invalid or expired SSO code" });
    }

    // Check if code has expired
    if (Date.now() > pending.expiresAt) {
      delete pendingCodes[code];
      savePendingCodes(pendingCodes);
      return res.status(401).json({ message: "SSO code has expired" });
    }

    // Verify user still exists and is active
    const [currentUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, pending.userId))
      .limit(1);

    if (!currentUser || !currentUser.isActive) {
      delete pendingCodes[code];
      savePendingCodes(pendingCodes);
      return res.status(401).json({ message: "User not found or inactive" });
    }

    // Generate fresh JWT
    const token = jwt.sign(
      { userId: String(currentUser.id) },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // Invalidate the single-use code
    delete pendingCodes[code];
    savePendingCodes(pendingCodes);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role,
        passwordChangeRequired: currentUser.passwordChangeRequired || false,
      },
    });
  } catch (error) {
    console.error("SSO exchange error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
