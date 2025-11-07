import { storage } from "./storage";
import { hashPassword } from "./auth";

/**
 * Seed script to create initial users with passwords
 * Run this once to set up the system with default users
 */
async function seedUsers() {
  console.log("Starting user seed...");

  // Default password for all seeded users (change in production!)
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "Password123!";

  const users = [
    {
      email: "admin@gapops.com",
      name: "System Admin",
      role: "Admin",
      password: defaultPassword,
    },
    {
      email: "manager@gapops.com",
      name: "Quality Manager",
      role: "Management",
      password: defaultPassword,
    },
    {
      email: "qa@gapops.com",
      name: "QA Analyst",
      role: "QA/Ops",
      password: defaultPassword,
    },
    {
      email: "poc@gapops.com",
      name: "Process Owner",
      role: "POC",
      password: defaultPassword,
    },
  ];

  for (const userData of users) {
    try {
      const existing = await storage.getUserByEmail(userData.email);
      
      if (existing) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      const passwordHash = await hashPassword(userData.password);
      
      await storage.createUser({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        department: null,
        passwordHash,
      });

      console.log(`✓ Created user: ${userData.email} (${userData.role})`);
    } catch (error) {
      console.error(`✗ Failed to create user ${userData.email}:`, error);
    }
  }

  console.log("\nSeed completed!");
  console.log("\nDefault login credentials:");
  console.log("Admin:      admin@gapops.com / Password123!");
  console.log("Management: manager@gapops.com / Password123!");
  console.log("QA/Ops:     qa@gapops.com / Password123!");
  console.log("POC:        poc@gapops.com / Password123!");
  console.log("\n⚠️  IMPORTANT: Change these passwords in production!\n");
}

// Run the seed function
seedUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
