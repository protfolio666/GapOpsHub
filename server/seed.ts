import { storage } from "./storage";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Check if data already exists
    const existingUsers = await storage.getAllUsers();
    if (existingUsers.length > 0) {
      console.log("ℹ️  Database already seeded, skipping...");
      return;
    }

    // Create users
    const users = await Promise.all([
      storage.createUser({
        email: "admin@gapops.com",
        name: "Admin User",
        role: "Admin",
        department: "IT",
      }),
      storage.createUser({
        email: "manager@gapops.com",
        name: "Jane Manager",
        role: "Management",
        department: "Operations",
      }),
      storage.createUser({
        email: "qa@gapops.com",
        name: "Sarah Chen",
        role: "QA/Ops",
        department: "Quality Assurance",
      }),
      storage.createUser({
        email: "poc@gapops.com",
        name: "Mike Torres",
        role: "POC",
        department: "Customer Success",
      }),
      storage.createUser({
        email: "poc2@gapops.com",
        name: "Lisa Park",
        role: "POC",
        department: "Operations",
      }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create SOPs
    const sops = await Promise.all([
      storage.createSop({
        title: "Standard Refund Processing Procedure",
        description: "Complete guide for processing customer refunds",
        content: "1. Verify customer identity\n2. Check refund eligibility\n3. Process refund through admin portal\n4. Send confirmation email\n5. Update customer record",
        category: "Customer Service",
        department: "Customer Success",
        version: "2.1",
        createdById: users[0].id,
        active: true,
      }),
      storage.createSop({
        title: "Escalation Protocol for Critical Issues",
        description: "How to escalate and handle critical customer issues",
        content: "1. Assess severity level\n2. Notify team lead immediately\n3. Document issue details\n4. Follow up every 2 hours\n5. Close loop with customer",
        category: "Support",
        department: "Customer Success",
        version: "1.5",
        createdById: users[0].id,
        active: true,
      }),
    ]);

    console.log(`✅ Created ${sops.length} SOPs`);

    // Create gaps
    const gaps = await Promise.all([
      storage.createGap({
        title: "Refund process missing customer notification",
        description: "When processing refunds through the admin portal, customers are not receiving email confirmations about the refund status. This has led to an increase in support tickets (approximately 15% of all refund requests) with customers asking whether their refund was processed.",
        department: "Customer Success",
        priority: "High",
        severity: "Critical",
        reporterId: users[2].id,
        assignedToId: users[3].id,
        status: "Overdue",
        aiProcessed: true,
        attachments: [],
        tatDeadline: new Date(Date.now() - 1000 * 60 * 60 * 24),
      }),
      storage.createGap({
        title: "Inventory sync delay between warehouse and system",
        description: "Stock levels are not updating in real-time causing overselling issues. The sync happens every 15 minutes but should be real-time for high-demand products.",
        department: "Operations",
        priority: "High",
        severity: "Major",
        reporterId: users[2].id,
        assignedToId: users[3].id,
        status: "InProgress",
        aiProcessed: true,
        attachments: [],
        tatDeadline: new Date(Date.now() + 1000 * 60 * 60 * 48),
      }),
      storage.createGap({
        title: "Customer feedback form submission errors",
        description: "Form validation is preventing legitimate submissions when customers include special characters in their feedback.",
        department: "Product",
        priority: "Medium",
        severity: "Minor",
        reporterId: users[2].id,
        assignedToId: users[3].id,
        status: "Assigned",
        aiProcessed: true,
        attachments: [],
        tatDeadline: new Date(Date.now() + 1000 * 60 * 60 * 72),
      }),
      storage.createGap({
        title: "Onboarding checklist incomplete for enterprise customers",
        description: "Enterprise customers are able to skip critical security training steps during the onboarding process.",
        department: "Sales",
        priority: "High",
        severity: "Major",
        reporterId: users[2].id,
        status: "NeedsReview",
        aiProcessed: true,
        attachments: [],
        assignedToId: null,
        tatDeadline: null,
      }),
      storage.createGap({
        title: "Data export functionality timeout for large datasets",
        description: "When users try to export more than 10,000 records, the export times out after 30 seconds.",
        department: "Engineering",
        priority: "Medium",
        severity: "Minor",
        reporterId: users[2].id,
        status: "Resolved",
        aiProcessed: true,
        attachments: [],
        assignedToId: users[4].id,
        resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        tatDeadline: new Date(Date.now() - 1000 * 60 * 60 * 48),
      }),
    ]);

    console.log(`✅ Created ${gaps.length} gaps`);

    // Create comments for first gap
    await storage.createComment({
      gapId: gaps[0].id,
      authorId: users[2].id,
      content: "I've identified this gap during the Q4 refund audit. Affecting approximately 15% of all refund requests.",
      attachments: [],
    });

    await storage.createComment({
      gapId: gaps[0].id,
      authorId: users[3].id,
      content: "Investigating now. Found the root cause - email notification service wasn't triggered in the refund workflow. Will implement fix by EOD.",
      attachments: ["refund_flow_diagram.pdf"],
    });

    console.log(`✅ Created comments`);

    // Create similar gap relationships
    await storage.createSimilarGap({
      gapId: gaps[0].id,
      similarGapId: gaps[1].id,
      similarityScore: 72,
    });

    console.log(`✅ Created similar gap relationships`);

    console.log("✨ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

seed().catch(console.error);
