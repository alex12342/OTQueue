import nodemailer, { Transporter } from "nodemailer";
import { logger } from "./logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_PORT || "587", 10);
  const user = process.env.EMAIL_USER || "";
  const pass = process.env.EMAIL_PASS || "";
  const from = process.env.EMAIL_FROM || `noreply@localhost`;
  const secure = process.env.EMAIL_SECURE === "true";

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  });

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM || `noreply@localhost`;

  const mailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ""),
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    logger.info({ msg: "Email sent", messageId: info.messageId, to: options.to });
  } catch (error) {
    logger.error({ msg: "Failed to send email", error, to: options.to }, (error as Error).message);
    throw new Error("Failed to send email");
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const appUrl = process.env.APP_URL || "http://localhost";
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #1a1a2e; color: #ffffff; padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 32px; }
        .content p { color: #333333; line-height: 1.6; margin: 0 0 16px; }
        .button { display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
        .button:hover { background: #4338ca; }
        .footer { background: #f9fafb; padding: 24px 32px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .link-text { color: #4f46e5; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>OTQue - Password Reset</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p class="link-text">${resetLink}</p>
          <p>This link will expire in 1 hour. If you did not request a password reset, you can ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated email from OTQue. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "OTQue - Password Reset Request",
    html,
  });
}

export async function sendUserInviteEmail(email: string, name: string, inviteToken: string): Promise<void> {
  const appUrl = process.env.APP_URL || "http://localhost";
  const inviteLink = `${appUrl}/set-password?token=${inviteToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #1a1a2e; color: #ffffff; padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 32px; }
        .content p { color: #333333; line-height: 1.6; margin: 0 0 16px; }
        .button { display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
        .button:hover { background: #4338ca; }
        .footer { background: #f9fafb; padding: 24px 32px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .link-text { color: #4f46e5; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>OTQue - Account Invitation</h1>
        </div>
        <div class="content">
          <p>Hello${name ? " " + name : ""},</p>
          <p>An administrator has created an account for you on OTQue. Set up your password to get started:</p>
          <div style="text-align: center;">
            <a href="${inviteLink}" class="button">Set Up Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p class="link-text">${inviteLink}</p>
          <p>This link will expire in 24 hours. If you were not expecting this invitation, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated email from OTQue. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "OTQue - You've been invited to join",
    html,
  });
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #059669; color: #ffffff; padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 32px; }
        .content p { color: #333333; line-height: 1.6; margin: 0 0 16px; }
        .footer { background: #f9fafb; padding: 24px 32px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Changed</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Your OTQue password has been successfully changed. If you did not make this change, please contact your administrator immediately.</p>
        </div>
        <div class="footer">
          <p>This is an automated email from OTQue. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "OTQue - Password Changed Successfully",
    html,
  });
}
