import { createHash, randomBytes } from "crypto";

export function createResetToken() {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  return { token, tokenHash };
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendPasswordResetEmail(options: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Job Hunt Copilot <onboarding@resend.dev>";
  if (!apiKey) return { sent: false as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: "Reset your Job Hunt Copilot password",
      html: `
        <p>Hi ${options.name},</p>
        <p>Reset your password with this link (valid for 1 hour):</p>
        <p><a href="${options.resetUrl}">${options.resetUrl}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email failed: ${text.slice(0, 200)}`);
  }

  return { sent: true as const };
}
