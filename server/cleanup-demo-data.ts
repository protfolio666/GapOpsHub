import { db } from "./db";
import { 
  users, gaps, comments, sops, formTemplates, formFields,
  gapAssignments, tatExtensions, similarGaps, auditLogs
} from "@shared/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

/**
 * Clean all demo data from database
 * Keeps only ONE admin user for testing
 */
async function cleanupDemoData() {
  console.log("🧹 Starting cleanup of demo data...\n");

  try {
    // Delete all data in correct order (respecting foreign keys)
    console.log("Deleting audit logs...");
    await db.delete(auditLogs);
    
    console.log("Deleting similar gaps...");
    await db.delete(similarGaps);
    
    console.log("Deleting TAT extensions...");
    await db.delete(tatExtensions);
    
    console.log("Deleting gap assignments...");
    await db.delete(gapAssignments);
    
    console.log("Deleting comments...");
    await db.delete(comments);
    
    console.log("Deleting gaps...");
    await db.delete(gaps);
    
    console.log("Deleting form fields...");
    await db.delete(formFields);
    
    console.log("Deleting form templates...");
    await db.delete(formTemplates);
    
    console.log("Deleting SOPs...");
    await db.delete(sops);
    
    console.log("Deleting all users...");
    await db.delete(users);
    
    // Create ONE fresh admin user
    console.log("\n✨ Creating fresh admin user...");
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
    const passwordHash = await hashPassword(adminPassword);
    
    const [admin] = await db.insert(users).values({
      email: "admin@gapops.com",
      name: "System Administrator",
      role: "Admin",
      department: "IT",
      passwordHash,
    }).returning();
    
    // Reset auto-increment sequences
    console.log("\n🔄 Resetting ID sequences...");
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users`);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('gaps', 'id'), 1)`);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('comments', 'id'), 1)`);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('sops', 'id'), 1)`);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('form_templates', 'id'), 1)`);
    
    console.log("\n✅ Cleanup completed successfully!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎯 Database is now clean and ready for testing");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📝 Login with:");
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log("\n⚠️  You'll need to:");
    console.log("   1. Create new users (Admin → Users & Roles)");
    console.log("   2. QA/Ops can submit gaps");
    console.log("   3. Test the full workflow!");
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    throw error;
  }
}

// Run cleanup
cleanupDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
