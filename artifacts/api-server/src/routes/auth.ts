import { Router } from "express";
import { usersTable, insertUserSchema, passwordResetTokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import { sendPasswordResetEmail, sendUserInviteEmail, sendPasswordChangedEmail } from "../lib/email";
import { authMiddleware } from "../middlewares/auth";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but was not provided.");
}

const router = Router();

// ── Rate limiting for auth endpoints ─────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests, please try again later." },
});

// ── Password strength validation ─────────────────────────────────────────────

function validatePasswordStrength(password: string): { valid: boolean; message: string } {
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

// ── Login endpoint ───────────────────────────────────────────────────────────

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!existingUser) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, existingUser.passwordHash);

    if (!isValidPassword || !existingUser.isActive) {
      return res.status(401).json({ message: "Invalid credentials or account inactive" });
    }

    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, existingUser.id));

    const token = jwt.sign(
      { userId: String(existingUser.id) },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        passwordChangeRequired: existingUser.passwordChangeRequired || false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Registration status endpoint ─────────────────────────────────────────────

router.get("/registration-enabled", async (_req, res) => {
  try {
    const [existingUser] = await db.select().from(usersTable).limit(1);
    const enabled = !existingUser;
    return res.json({ enabled });
  } catch (error) {
    console.error("Registration status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Admin setup endpoint (for first-time admin creation) ────────────────────
// Note: Admin account is now seeded automatically via entrypoint.sh
// This endpoint is kept for backwards compatibility only.

router.post("/admin-setup", async (req, res) => {
  try {
    const insertData = insertUserSchema.parse(req.body);
    const { email, password, name } = insertData;

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (existingAdmin) {
      return res.status(409).json({ message: "Admin user already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newAdmin] = await db.insert(usersTable).values({
      email,
      passwordHash,
      name,
      role: "admin",
      passwordChangeRequired: true,
    }).returning();

    return res.status(201).json({
      message: "Admin user created successfully. Please log in with your credentials.",
      user: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    console.error("Admin creation error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Forgot password endpoint ─────────────────────────────────────────────────

router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    }

    // Generate reset token
    const resetToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Clean up any existing tokens for this user
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));

    // Store the reset token
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Still return success to prevent email enumeration
    }

    return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Verify password reset token ──────────────────────────────────────────────

router.get("/verify-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [resetToken] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.token, token))
      .limit(1);

    if (!resetToken) {
      return res.status(404).json({ message: "Invalid reset token" });
    }

    if (new Date(resetToken.expiresAt) < new Date()) {
      // Token expired, clean it up
      await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, resetToken.id));
      return res.status(410).json({ message: "Reset token has expired" });
    }

    return res.json({ valid: true, userId: resetToken.userId });
  } catch (error) {
    console.error("Verify reset token error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Reset password endpoint ──────────────────────────────────────────────────

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const [resetToken] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.token, token))
      .limit(1);

    if (!resetToken) {
      return res.status(404).json({ message: "Invalid reset token" });
    }

    if (new Date(resetToken.expiresAt) < new Date()) {
      await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, resetToken.id));
      return res.status(410).json({ message: "Reset token has expired" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password and clear password change required flag
    await db.update(usersTable)
      .set({ 
        passwordHash, 
        passwordChangeRequired: false,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, resetToken.userId));

    // Delete the used token
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.id, resetToken.id));

    // Send confirmation email
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, resetToken.userId)).limit(1);
      if (user) {
        await sendPasswordChangedEmail(user.email);
      }
    } catch (emailError) {
      console.error("Failed to send password changed email:", emailError);
    }

    return res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Change password endpoint (for logged-in users) ──────────────────────────

router.post("/change-password", authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(usersTable)
      .set({ 
        passwordHash, 
        passwordChangeRequired: false,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));

    // Send confirmation email
    try {
      await sendPasswordChangedEmail(user.email);
    } catch (emailError) {
      console.error("Failed to send password changed email:", emailError);
    }

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Create admin user (legacy, kept for backwards compatibility) ─────────────

router.post("/admin", async (req, res) => {
  try {
    const [admins] = await db.select().from(usersTable).limit(1);
    
    if (admins) {
      return res.status(403).json({ 
        message: "Admin user already exists. Use the admin panel to create users." 
      });
    }

    const insertData = insertUserSchema.parse(req.body);
    const { email, password, name } = insertData;

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newAdmin] = await db.insert(usersTable).values({
      email,
      passwordHash,
      name,
      role: "admin",
      passwordChangeRequired: true,
    }).returning();

    return res.status(201).json({
      message: "Admin user created successfully",
      user: {
        id: newAdmin[0].id,
        email: newAdmin[0].email,
        name: newAdmin[0].name,
        role: newAdmin[0].role,
      },
    });
  } catch (error) {
    console.error("Admin creation error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ── Logout endpoint ──────────────────────────────────────────────────────────

router.post("/logout", async (req, res) => {
  try {
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Verify token endpoint ───────────────────────────────────────────────────

router.get("/verify-session", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!bearerToken) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const decoded = jwt.verify(bearerToken, JWT_SECRET) as { userId: string };

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordChangeRequired: user.passwordChangeRequired || false,
      },
    });
  } catch (error) {
    console.error("Verify session error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

export default router;
