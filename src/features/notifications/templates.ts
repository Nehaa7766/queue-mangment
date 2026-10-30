import type { MembershipRole } from "@/generated/prisma/enums";
import type { OutboxPayloads } from "./events";

export type RenderedEmail = { subject: string; html: string; text: string };

const ROLE_NAMES: Record<MembershipRole, string> = {
  RECEPTIONIST: "receptionist",
  DOCTOR: "doctor",
  CLINIC_ADMIN: "clinic admin",
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// "about 7 days", "about 1 hour", "about 20 minutes" — relative to when the
// email is rendered, which may be after a retry.
export function describeTimeLeft(expiresAt: string, now: Date): string {
  const minutes = Math.max(
    1,
    Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60_000),
  );
  if (minutes < 60) {
    return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `about ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(hours / 24);
  return `about ${days} days`;
}

// Inline styles only: many mail clients drop <style> blocks. The button uses
// charcoal text on terracotta, never white (docs/GUI_RULES.md).
function layout(options: {
  heading: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
  footer: string[];
}): string {
  const paragraphs = options.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#2E2522">${escapeHtml(text)}</p>`,
    )
    .join("");
  const footer = options.footer
    .map(
      (text) =>
        `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#6E625C">${escapeHtml(text)}</p>`,
    )
    .join("");
  const url = escapeHtml(options.actionUrl);

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.heading)}</title></head>
<body style="margin:0;padding:24px 16px;background:#F2EDEA;font-family:Inter,Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E8DFDB;border-radius:12px;padding:24px">
<p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#86614F">QueueCare</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#2E2522">${escapeHtml(options.heading)}</h1>
${paragraphs}
<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#86614F;color:#FFFFFF;font-weight:600;font-size:16px;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(options.actionLabel)}</a></p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#6E625C">If the button doesn't work, copy this link into your browser:<br><a href="${url}" style="color:#86614F;word-break:break-all">${url}</a></p>
${footer}
</div>
</body>
</html>`;
}

function textBody(lines: string[]): string {
  return lines.join("\n");
}

export function renderStaffInvitationEmail(
  payload: OutboxPayloads["staff.invited"],
  now: Date,
): RenderedEmail {
  const role = ROLE_NAMES[payload.role];
  const timeLeft = describeTimeLeft(payload.expiresAt, now);
  const subject = `You're invited to ${payload.clinicName} on QueueCare`;
  const intro = `Hello ${payload.name}, you've been invited to join ${payload.clinicName} on QueueCare as a ${role}.`;
  const action = "Accept the invitation to set your password and sign in.";
  const footer = [
    `This invitation expires in ${timeLeft}.`,
    "If you weren't expecting it, you can ignore this email.",
  ];

  return {
    subject,
    html: layout({
      heading: `Join ${payload.clinicName}`,
      paragraphs: [intro, action],
      actionLabel: "Accept invitation",
      actionUrl: payload.acceptUrl,
      footer,
    }),
    text: textBody([
      intro,
      "",
      action,
      payload.acceptUrl,
      "",
      ...footer,
      "",
      "QueueCare",
    ]),
  };
}

export function renderPasswordResetEmail(
  payload: OutboxPayloads["auth.password-reset-requested"],
  now: Date,
): RenderedEmail {
  const timeLeft = describeTimeLeft(payload.expiresAt, now);
  const subject = "Reset your QueueCare password";
  const intro = `Hello ${payload.name}, we received a request to reset the password for your QueueCare account.`;
  const action = "Choose a new password using the link below.";
  const footer = [
    `The link expires in ${timeLeft} and works once.`,
    "If you didn't ask for this, you can ignore this email. Your password stays the same.",
  ];

  return {
    subject,
    html: layout({
      heading: "Reset your password",
      paragraphs: [intro, action],
      actionLabel: "Choose a new password",
      actionUrl: payload.resetUrl,
      footer,
    }),
    text: textBody([
      intro,
      "",
      action,
      payload.resetUrl,
      "",
      ...footer,
      "",
      "QueueCare",
    ]),
  };
}
