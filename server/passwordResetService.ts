import { MailService } from '@sendgrid/mail';
import crypto from 'crypto';

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface PasswordResetEmailParams {
  to: string;
  resetToken: string;
  userName: string;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured - password reset email not sent');
    return false;
  }

  try {
    const baseUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
    const resetUrl = `${baseUrl}/reset-password?token=${params.resetToken}`;

    const emailContent = {
      to: params.to,
      from: 'noreply@cricketteam.com', // You'll need to verify this sender in SendGrid
      subject: 'Reset Your CrickIQ Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏏 CrickIQ</h1>
              <h2>Password Reset Request</h2>
            </div>
            <div class="content">
              <p>Hello ${params.userName},</p>
              
              <p>We received a request to reset your password for your CrickIQ account. If you didn't make this request, you can safely ignore this email.</p>
              
              <p>To reset your password, click the button below:</p>
              
              <a href="${resetUrl}" class="button">Reset Password</a>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #e9e9e9; padding: 10px; border-radius: 4px;">${resetUrl}</p>
              
              <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
              
              <p>If you continue to have trouble, please contact our support team.</p>
              
              <p>Best regards,<br>The CrickIQ Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${params.userName},
        
        We received a request to reset your password for your CrickIQ account.
        
        To reset your password, visit this link: ${resetUrl}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't make this request, you can safely ignore this email.
        
        Best regards,
        The CrickIQ Team
      `
    };

    await mailService.send(emailContent);
    return true;
  } catch (error) {
    console.error('Password reset email error:', error);
    return false;
  }
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}