import { Router } from "express";
import { usersTable, insertUserSchema } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";

const router = Router();

// Login endpoint with session cookie
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user by email
    const existingUser = await usersTable.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (!existingUser) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, existingUser.passwordHash);

    if (!isValidPassword || !existingUser.isActive) {
      return res.status(401).json({ message: "Invalid credentials or account inactive" });
    }

    // Create session cookie
    const sessionId = require("uuid").v4();
    
    // Store session in database (for admin access validation)
    await usersTable.update({ lastLoginAt: new Date() })
      .where(eq(users.id, existingUser.id));

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only in HTTPS
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Login successful",
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Register endpoint
router.post("/register", async (req, res) => {
  try {
    const insertData = insertUserSchema.parse(req.body);
    const { email, password, name } = insertData;

    // Check if user already exists
    const existingUser = await usersTable.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const newUser = await usersTable.insert(insertData as any).values({
      passwordHash,
      role: "user",
    }).returning();

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
        role: newUser[0].role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Create admin user
router.post("/admin", async (req, res) => {
  try {
    const insertData = insertUserSchema.parse(req.body);
    const { email, password, name } = insertData;

    // Check if admin already exists
    const existingAdmin = await usersTable.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (existingAdmin) {
      return res.status(409).json({ message: "Admin user already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert admin user
    const newAdmin = await usersTable.insert(insertData as any).values({
      passwordHash,
      role: "admin",
    }).returning();

    res.status(201).json({
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
    res.status(500).json({ message: "Internal server error" });
  }
});

// Logout endpoint
router.post("/logout", async (req, res) => {
  try {
    res.clearCookie("sessionId");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Verify session endpoint (for admin routes validation)
router.get("/verify-session", async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // In a real implementation, you'd verify the session against stored sessions
    // For now, we'll use a simple approach where session validity is implicit
    res.json({ 
      authenticated: true,
      email: req.body.email || null, // Would store email in session table
      role: "admin" if (req.body.role === "admin") else "user", // Simple check
    });
  } catch (error) {
    console.error("Verify session error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
