import { Router } from "express";
import { usersTable, insertUserSchema, passwordResetTokensTable, systemSettingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import bcrypt from "bcryptjs";
import { adminAuthMiddleware } from "../middlewares/auth";
import { sendUserInviteEmail, sendEmail, getTransporter, clearTransporterCache } from "../lib/email";
import { logger } from "../lib/logger";
import { validatePasswordStrength } from "../lib/password";
import { randomUUID } from "crypto";

const router = Router();

// Apply admin auth middleware to all routes in this file
router.use(adminAuthMiddleware);

// Get all users (admin only)
router.get("/users", async (_req: any, res: any) => {
  try {
    const users = await db.select().from(usersTable);
    
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get single user (admin only)
router.get("/users/:id", async (req: any, res: any) => {
  try {
    const userId = req.params.id;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Create new user (admin only)
router.post("/users", async (req: any, res: any) => {
  try {
    const insertData = insertUserSchema.parse(req.body);
    
    // Check if user already exists
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, insertData.email)).limit(1);

    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    // Hash password and insert user
    const passwordHash = await bcrypt.hash(insertData.password, 10);
    
    const [newUser] = await db.insert(usersTable).values({
      email: insertData.email,
      passwordHash,
      name: insertData.name,
      role: insertData.role || "viewer",
      passwordChangeRequired: false,
    }).returning();

    // Send invite email with password setup link
    try {
      const inviteToken = randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await db.insert(passwordResetTokensTable).values({
        userId: newUser.id,
        token: inviteToken,
        expiresAt,
      });

      await sendUserInviteEmail(newUser.email, newUser.name, inviteToken);
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Don't fail the user creation if email fails
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update user (admin only)
router.put("/users/:id", async (req: any, res: any) => {
  try {
    const userId = req.params.id;
    const updateData = insertUserSchema.partial().parse(req.body);
    
    // Check if user exists
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password, ...restData } = updateData;

    const updatePayload: Record<string, unknown> = {
      ...restData,
      updatedAt: new Date(),
    };

    if (password !== undefined) {
      const validation = validatePasswordStrength(password);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
      updatePayload.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await db.update(usersTable)
      .set(updatePayload)
      .where(and(eq(usersTable.id, userId)))
      .returning();

    res.json(updatedUser[0]);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete user (admin only)
router.delete("/users/:id", async (req: any, res: any) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user
    await db.delete(usersTable)
      .where(eq(usersTable.id, userId));

    res.json({ message: `User ${userId} deleted successfully` });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get admin stats (admin only)
router.get("/stats", async (_req: any, res: any) => {
  try {
    const [userCount] = await db.select({ count: { _: db.$count(usersTable) } });

    res.json({
      totalUsers: userCount.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Send password reset email for a specific user (admin only)
router.post("/users/:id/reset-password", async (req: any, res: any) => {
  try {
    const userId = req.params.id;

    // Look up the user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a password reset token (reuses the same token table as forgot-password)
    const resetToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Clean up any existing tokens for this user, then store the new one
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, user.id));

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token: resetToken,
      expiresAt,
    });

    // Send the reset email (silently ignore failures, same as forgot-password)
    try {
      const appUrl = process.env.APP_URL || "http://localhost";
      const resetLink = `${appUrl}/set-password?token=${resetToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f5f2; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
            .header { background: #0d7a5e; color: #ffffff; padding: 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 32px; }
            .content p { color: #1f2c2a; line-height: 1.6; margin: 0 0 16px; }
            .button { display: inline-block; background: #0d7a5e; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 16px 0; }
            .button:hover { background: #0b664f; }
            .footer { background: #f9f8f6; padding: 24px 32px; text-align: center; color: #6b7a76; font-size: 12px; border-top: 1px solid #e8e5e0; }
            .link-text { color: #0d7a5e; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>OTQue - Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello ${user.name || "there"},</p>
              <p>An administrator has initiated a password reset for your account. Click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p class="link-text">${resetLink}</p>
              <p>This link will expire in 1 hour. If you did not request a password reset, please contact your administrator.</p>
            </div>
            <div class="footer">
              <p>This is an automated email from OTQue. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: user.email,
        subject: "OTQue - Password Reset Request",
        html,
      });

      logger.info({ msg: "Admin-initiated password reset email sent", userId: user.id, email: user.email });
    } catch (emailError) {
      logger.error({ msg: "Failed to send admin-initiated reset email", userId: user.id, error: emailError });
      // Don't fail the request if email fails — the token is still valid
    }

    return res.json({ message: "Password reset email sent successfully" });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Toggle user active status (admin only)
router.patch("/users/:id/status", async (req: any, res: any) => {
  try {
    const userId = req.params.id;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    // Check if user exists
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update active status
    const updatedUser = await db.update(usersTable)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(usersTable.id, userId)))
      .returning();

    res.json(updatedUser[0]);
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Email Configuration Endpoints ─────────────────────────────────────────────

router.get("/email-config", adminAuthMiddleware, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, "email_config"))
      .limit(1);

    let config: Record<string, string> = {};
    if (rows.length > 0) {
      config = JSON.parse(rows[0].value);
    }

    const rawProtocol = config.email_protocol || "starttls";
    const protocol: "none" | "starttls" | "implicit" =
      rawProtocol === "none" || rawProtocol === "starttls" || rawProtocol === "implicit"
        ? rawProtocol
        : "starttls";

    res.json({
      email_host: config.email_host || "",
      email_port: parseInt(config.email_port || "587", 10),
      email_user: config.email_user || "",
      email_pass: config.email_pass ? "••••••" : "",
      email_from: config.email_from || "",
      email_protocol: protocol,
      configured: Object.keys(config).length > 0,
    });
  } catch (error) {
    console.error("Get email config error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/email-config", adminAuthMiddleware, async (req, res) => {
  try {
    const { email_host, email_port, email_user, email_pass, email_from, email_protocol } = req.body;

    const rawProtocol = email_protocol || "starttls";
    const protocol: "none" | "starttls" | "implicit" =
      rawProtocol === "none" || rawProtocol === "starttls" || rawProtocol === "implicit"
        ? rawProtocol
        : "starttls";

    let secure = false;
    let tlsRejectUnauthorized = true;

    if (protocol === "implicit") {
      secure = true;
    } else if (protocol === "starttls") {
      tlsRejectUnauthorized = true;
    }

    const config: Record<string, string> = {
      email_host: email_host || "",
      email_port: String(email_port || 587),
      email_user: email_user || "",
      email_from: email_from || "",
      email_protocol: protocol,
      email_secure: String(secure),
      email_tls_reject_unauthorized: String(tlsRejectUnauthorized),
    };

    if (email_pass && email_pass !== "••••••" && email_pass !== "********") {
      config.email_pass = email_pass;
    }

    const existing = await db
      .select()
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, "email_config"))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemSettingsTable)
        .set({ value: JSON.stringify(config), updatedAt: new Date() })
        .where(eq(systemSettingsTable.key, "email_config"));
    } else {
      await db.insert(systemSettingsTable).values({
        key: "email_config",
        value: JSON.stringify(config),
      });
    }

    clearTransporterCache();

    logger.info({ msg: "Email configuration updated", protocol });
    res.json({ success: true });
  } catch (error) {
    console.error("Update email config error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/email/test", adminAuthMiddleware, async (req, res) => {
  try {
    const { to } = req.body;

    if (!to || !to.includes("@")) {
      return res.status(400).json({ message: "Valid recipient email is required" });
    }

    const transport = await getTransporter();
    const verified = await transport.verify();

    if (!verified) {
      logger.warn({ msg: "Email transport verification failed" });
      return res.status(500).json({ message: "Email configuration verification failed" });
    }

    await transport.sendMail({
      from: `"OTQue" <${req.body.email_from || "noreply@localhost"}>`,
      to,
      subject: "OTQue Email Configuration Test",
      html: `<p>This is a test email sent from OTQue's email configuration.</p><p>If you received this, your email settings are working correctly.</p>`,
    });

    logger.info({ msg: "Test email sent successfully", to });
    return res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    const message = (error as Error).message;
    logger.error({ msg: "Test email failed", to: req.body.to, error }, message);
    res.status(500).json({ message: `Failed to send test email: ${message}` });
    return;
  }
});

export default router;
