import { Router } from "express";
import { usersTable, insertUserSchema, passwordResetTokensTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import bcrypt from "bcryptjs";
import { adminAuthMiddleware } from "../middlewares/auth";
import { sendUserInviteEmail } from "../lib/email";
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
      role: insertData.role || "user",
      passwordChangeRequired: true,
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

    // Update user fields (excluding password)
    const updatedUser = await db.update(usersTable)
      .set({
        ...updateData,
        passwordHash: existingUser.passwordHash, // Keep existing hash
        updatedAt: new Date(),
      })
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

export default router;
