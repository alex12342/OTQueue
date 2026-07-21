import { type Request, type Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface AuthRequest extends Request {
  userId?: string;
  userRole?: "user" | "admin" | "viewer";
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but was not provided.");
}

/**
 * Token-based authentication middleware.
 * Extracts and verifies the JWT from the 'Authorization: Bearer <TOKEN>' header
 * and attaches user info to the request if valid.
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Look up the user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);

    if (user && user.isActive) {
      req.userId = String(user.id);
      req.userRole = user.role as "user" | "admin" | "viewer";
      req.userEmail = user.email;
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
  }

  next();
};

/**
 * Admin-specific middleware for protecting admin routes.
 * Requires the user to be authenticated AND have the "admin" role.
 */
export const adminAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Must be authenticated first
  if (!req.userId || !req.userRole) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.userRole !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
};

/**
 * Optional auth middleware - only enriches the request if a valid token is present.
 * Routes using this middleware should handle the "not authenticated" case gracefully.
 */
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);

    if (user && user.isActive) {
      req.userId = String(user.id);
      req.userRole = user.role as "user" | "admin" | "viewer";
      req.userEmail = user.email;
    }
  } catch (error) {
    console.error("Optional auth middleware error:", error);
  }

  next();
};
