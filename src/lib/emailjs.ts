// ============================================
// EmailJS Notification Service
// ============================================
// Sends admin notification emails when a new user registers.
// Setup: create a free account at https://www.emailjs.com
// Add these to your .env.local:
//   NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
//   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
//   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
//
// Template variables available: {{user_email}}, {{admin_email}}, {{app_url}}, {{timestamp}}

const ADMIN_EMAIL = "kimeudan05@gmail.com";

/**
 * Sends a notification email to the admin when a new user registers.
 * Fails silently if EmailJS is not configured.
 */
export async function sendNewUserNotification(userEmail: string): Promise<void> {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  // Skip if not configured
  if (!serviceId || !templateId || !publicKey) {
    console.info("[EmailJS] Not configured — skipping notification email.");
    return;
  }

  try {
    // Dynamically import emailjs-com to avoid SSR issues
    const emailjs = await import("@emailjs/browser");
    await emailjs.send(
      serviceId,
      templateId,
      {
        user_email: userEmail,
        admin_email: ADMIN_EMAIL,
        app_url: typeof window !== "undefined" ? `${window.location.origin}/admin/users` : "",
        timestamp: new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }),
      },
      { publicKey }
    );
    console.info("[EmailJS] Admin notification sent for:", userEmail);
  } catch (err) {
    console.error("[EmailJS] Failed to send notification:", err);
    // Never throw — this is a fire-and-forget notification
  }
}
