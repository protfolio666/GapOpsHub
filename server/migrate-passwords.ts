import { db } from "./db";
import { users } from "../shared/schema";
import { hashPassword } from "./auth";
import { eq, isNull } from "drizzle-orm";

/**
 * Migration script to add passwords to existing users
 */
async function migratePasswords() {
  console.log("Migrating passwords for existing users...");

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "Password123!";
  const passwordHash = await hashPassword(defaultPassword);

  // Update all users without passwords
  const usersWithoutPasswords = await db
    .select()
    .from(users)
    .where(isNull(users.passwordHash));

  console.log(`Found ${usersWithoutPasswords.length} users without passwords`);

  for (const user of usersWithoutPasswords) {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));
    
    console.log(`✓ Set password for: ${user.email}`);
  }

  console.log("\nMigration completed!");
  console.log("\nAll users now have password: Password123!");
  console.log("⚠️  IMPORTANT: Users should change their passwords!\n");
}

migratePasswords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
