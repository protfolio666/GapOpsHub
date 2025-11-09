const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";
const FROM_EMAIL = "contactus@solvextra.com"; // Verified sender in SendGrid

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn("[Email] SENDGRID_API_KEY not configured, skipping email to:", options.to);
    return false;
  }

  console.log(`[Email] Preparing to send email to: ${options.to}, subject: "${options.subject}"`);

  try {
    const payload = {
      personalizations: [{
        to: [{ email: options.to }]
      }],
      from: { email: FROM_EMAIL },
      subject: options.subject,
      content: [
        ...(options.text ? [{ type: "text/plain", value: options.text }] : []),
        ...(options.html ? [{ type: "text/html", value: options.html }] : []),
      ]
    };

    console.log(`[Email] Calling SendGrid API...`);
    
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Email] SendGrid API error (${response.status}):`, error);
      return false;
    }

    console.log(`[Email] ✓ Email sent successfully to: ${options.to}`);
    return true;
  } catch (error) {
    console.error("[Email] Email sending failed with exception:", error);
    return false;
  }
}

/**
 * Send gap assignment notification
 */
export async function sendGapAssignmentEmail(
  assigneeName: string,
  assigneeEmail: string,
  gapId: string,
  gapTitle: string,
  priority: string,
  tatDeadline?: Date
): Promise<boolean> {
  const deadlineText = tatDeadline 
    ? `Deadline: ${tatDeadline.toLocaleDateString()}`
    : "No deadline set";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Gap Assigned to You</h2>
      <p>Hello ${assigneeName},</p>
      <p>A new process gap has been assigned to you:</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Gap ID:</strong> ${gapId}</p>
        <p><strong>Title:</strong> ${gapTitle}</p>
        <p><strong>Priority:</strong> <span style="color: ${priority === 'High' ? '#dc2626' : priority === 'Medium' ? '#f59e0b' : '#16a34a'};">${priority}</span></p>
        <p><strong>${deadlineText}</strong></p>
      </div>
      
      <p>Please log in to GapOps to review and start working on this gap.</p>
      
      <a href="https://gapops.replit.app" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
        View Gap Details
      </a>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
        This is an automated notification from GapOps. Please do not reply to this email.
      </p>
    </div>
  `;

  return sendEmail({
    to: assigneeEmail,
    subject: `[GapOps] New Gap Assigned: ${gapTitle}`,
    html,
  });
}

/**
 * Send gap resolution notification
 */
export async function sendGapResolutionEmail(
  reporterName: string,
  reporterEmail: string,
  gapId: string,
  gapTitle: string,
  gapNumericId: number,
  reporterRole: string = "QA/Ops"
): Promise<boolean> {
  const baseUrl = process.env.BASE_URL || "https://gapops.replit.app";
  
  const rolePrefix = reporterRole === "Admin" ? "admin" :
                     reporterRole === "Management" ? "management" :
                     reporterRole === "POC" ? "poc" : "qa";
  
  const viewUrl = `${baseUrl}/${rolePrefix}/gaps/${gapNumericId}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Gap Resolved</h2>
      <p>Hello ${reporterName},</p>
      <p>Good news! A process gap you reported has been resolved:</p>
      
      <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
        <p><strong>Gap ID:</strong> ${gapId}</p>
        <p><strong>Title:</strong> ${gapTitle}</p>
        <p><strong>Status:</strong> <span style="color: #16a34a;">✓ Resolved</span></p>
      </div>
      
      <p>Please log in to GapOps to review the resolution details and provide feedback if needed.</p>
      
      <a href="${viewUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
        View Resolution
      </a>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
        This is an automated notification from GapOps.
      </p>
    </div>
  `;

  return sendEmail({
    to: reporterEmail,
    subject: `[GapOps] Gap Resolved: ${gapTitle}`,
    html,
  });
}

/**
 * Send TAT breach warning
 */
export async function sendTATBreachWarning(
  assigneeName: string,
  assigneeEmail: string,
  gapId: string,
  gapTitle: string,
  tatDeadline: Date,
  hoursRemaining: number
): Promise<boolean> {
  const urgencyColor = hoursRemaining <= 24 ? "#dc2626" : "#f59e0b";
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${urgencyColor};">⚠️ TAT Deadline Approaching</h2>
      <p>Hello ${assigneeName},</p>
      <p>This is a reminder that a gap assigned to you is approaching its deadline:</p>
      
      <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
        <p><strong>Gap ID:</strong> ${gapId}</p>
        <p><strong>Title:</strong> ${gapTitle}</p>
        <p><strong>Deadline:</strong> ${tatDeadline.toLocaleString()}</p>
        <p><strong>Time Remaining:</strong> <span style="color: ${urgencyColor};">${hoursRemaining} hours</span></p>
      </div>
      
      <p>Please prioritize this gap or request a TAT extension if needed.</p>
      
      <a href="https://gapops.replit.app" style="display: inline-block; background-color: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
        View Gap & Update Status
      </a>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
        This is an automated notification from GapOps.
      </p>
    </div>
  `;

  return sendEmail({
    to: assigneeEmail,
    subject: `[GapOps] URGENT: TAT Deadline in ${hoursRemaining}h - ${gapTitle}`,
    html,
  });
}

/**
 * Send duplicate marking notification to reporter
 */
export async function sendGapMarkedAsDuplicateEmail(
  reporterName: string,
  reporterEmail: string,
  gapId: string,
  gapTitle: string,
  originalGapId: string,
  originalGapTitle: string,
  closedByName: string,
  closedByEmail: string
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Gap Marked as Duplicate</h2>
      <p>Hello ${reporterName},</p>
      <p>Your reported gap has been reviewed and marked as a duplicate of an existing gap:</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Your Gap ID:</strong> ${gapId}</p>
        <p><strong>Your Gap Title:</strong> ${gapTitle}</p>
        <p><strong>Reason:</strong> Duplicate submission</p>
        <p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #d1d5db;">
          <strong>Original Gap ID:</strong> ${originalGapId}
        </p>
        <p><strong>Original Gap Title:</strong> ${originalGapTitle}</p>
        <p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #d1d5db;">
          <strong>Closed By:</strong> ${closedByName}
        </p>
        <p><strong>Email for Clarification:</strong> <a href="mailto:${closedByEmail}" style="color: #2563eb;">${closedByEmail}</a></p>
      </div>
      
      <p>Your gap has been closed and linked to the original gap. You can track progress on the original gap for updates.</p>
      <p>If you believe this determination is incorrect, please reach out to ${closedByName} at ${closedByEmail} for clarification.</p>
      
      <a href="https://gapops.replit.app" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
        View Original Gap
      </a>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
        This is an automated notification from GapOps.
      </p>
    </div>
  `;

  return sendEmail({
    to: reporterEmail,
    subject: `[GapOps] Gap Marked as Duplicate: ${gapTitle}`,
    html,
  });
}

/**
 * Send TAT extension request notification to management
 */
export async function sendTATExtensionRequestEmail(
  managerName: string,
  managerEmail: string,
  gapId: string,
  gapTitle: string,
  requestedBy: string,
  reason: string,
  newDeadline: Date
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">TAT Extension Request</h2>
      <p>Hello ${managerName},</p>
      <p>A TAT extension has been requested for the following gap:</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Gap ID:</strong> ${gapId}</p>
        <p><strong>Title:</strong> ${gapTitle}</p>
        <p><strong>Requested By:</strong> ${requestedBy}</p>
        <p><strong>New Deadline:</strong> ${newDeadline.toLocaleDateString()}</p>
        <p><strong>Reason:</strong></p>
        <p style="background-color: white; padding: 10px; border-radius: 4px;">${reason}</p>
      </div>
      
      <p>Please review and approve/reject this extension request.</p>
      
      <a href="https://gapops.replit.app" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
        Review Extension Request
      </a>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
        This is an automated notification from GapOps.
      </p>
    </div>
  `;

  return sendEmail({
    to: managerEmail,
    subject: `[GapOps] TAT Extension Request: ${gapTitle}`,
    html,
  });
}
