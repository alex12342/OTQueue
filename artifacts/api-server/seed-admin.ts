import bcrypt from "bcryptjs";
import { db, getPool, usersTable } from "@workspace/db";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log("DATABASE_URL not set, skipping admin seed.");
  process.exit(0);
}

async function seed() {
  try {
    const [existingUser] = await db.select().from(usersTable).limit(1);

    if (existingUser) {
      console.log("Users already exist, skipping admin seed.");
      return;
    }

    const passwordHash = await bcrypt.hash(
      process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123!",
      10,
    );

    const [admin] = await db.insert(usersTable).values({
      email: process.env.DEFAULT_ADMIN_EMAIL || "admin@otqueue.local",
      passwordHash,
      name: process.env.DEFAULT_ADMIN_NAME || "Admin",
      role: "admin",
      passwordChangeRequired: true,
    }).returning();

    console.log("Default admin user created:", admin.email);
    console.log("Please change this password after first login.");
  } catch (err) {
    console.error("Failed to seed admin user:", (err as Error).message);
  } finally {
    await getPool().end();
  }

  process.exit(0);
}

seed();
