import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface AvailabilityEmailParams {
  to: string;
  playerName: string;
  teamName: string;
  opponent: string;
  matchDate: Date;
  venue: string;
  deadline: Date;
  message?: string | null;
  appUrl: string;
}

export async function sendAvailabilityRequestEmail(params: AvailabilityEmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured - availability email not sent');
    return false;
  }

  const { to, playerName, teamName, opponent, matchDate, venue, deadline, message, appUrl } = params;
  const matchDateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const matchTimeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const deadlineStr = deadline.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">🏏 Availability Request</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">${teamName}</p>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 18px; color: #333; margin-bottom: 20px;">Hi ${playerName},</p>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          Your team manager is checking your availability for the upcoming match:
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-size: 16px;"><strong>Opponent:</strong> ${opponent}</p>
          <p style="margin: 0 0 8px; font-size: 16px;"><strong>Date:</strong> ${matchDateStr} at ${matchTimeStr}</p>
          <p style="margin: 0 0 8px; font-size: 16px;"><strong>Venue:</strong> ${venue}</p>
          <p style="margin: 0; font-size: 16px; color: #ef4444;"><strong>Respond by:</strong> ${deadlineStr}</p>
        </div>
        ${message ? `<div style="background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #1565c0; font-style: italic;">"${message}"</p>
        </div>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/availability" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-size: 16px; font-weight: bold; display: inline-block;">
            Respond Now
          </a>
        </div>
        <p style="font-size: 14px; color: #777; text-align: center;">
          Please respond before ${deadlineStr} so the manager can plan the squad.
        </p>
      </div>
    </div>
  `;

  const textContent = `
    CrickIQ - Availability Request for ${teamName}

    Hi ${playerName},

    Your team manager is checking your availability for the upcoming match:
    Opponent: ${opponent}
    Date: ${matchDateStr} at ${matchTimeStr}
    Venue: ${venue}
    Respond by: ${deadlineStr}

    ${message ? `Manager's message: "${message}"` : ''}

    Please log in to respond: ${appUrl}/availability
  `;

  try {
    const fromEmail = process.env.FROM_EMAIL || 'test@example.com';
    await sgMail.send({
      to,
      from: { email: fromEmail, name: 'CrickIQ Team Management' },
      subject: `Availability Check: ${teamName} vs ${opponent} — Please Respond`,
      text: textContent,
      html: htmlContent,
    });
    console.log(`Availability request email sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send availability email:', error?.response?.body || error);
    return false;
  }
}

interface InviteEmailParams {
  to: string;
  inviterName: string;
  teamName: string;
  position?: string;
  message?: string;
  inviteUrl: string;
}

export async function sendPlayerInviteEmail(params: InviteEmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured - email not sent');
    return false;
  }

  const { to, inviterName, teamName, position, message, inviteUrl } = params;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">🏏 CrickIQ Team Invitation</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 18px; color: #333; margin-bottom: 20px;">
          Hi there! 👋
        </p>
        
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on CrickIQ, our comprehensive cricket team management platform.
        </p>
        
        ${position ? `<p style="font-size: 16px; color: #555; line-height: 1.6;">
          <strong>Position:</strong> ${position}
        </p>` : ''}
        
        ${message ? `<div style="background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0;">
          <p style="margin: 0; color: #1565c0; font-style: italic;">"${message}"</p>
        </div>` : ''}
        
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          CrickIQ helps teams manage players, schedule matches, track performance, and streamline team operations. Join us to be part of an organized and data-driven cricket experience!
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-size: 16px; font-weight: bold; display: inline-block;">
            Join ${teamName} Now
          </a>
        </div>
        
        <p style="font-size: 14px; color: #777; text-align: center; margin-top: 30px;">
          This invitation will expire in 7 days. If you have any questions, please contact ${inviterName}.
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; text-align: center;">
          You received this invitation because ${inviterName} added your email to ${teamName} on CrickIQ.<br>
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  const textContent = `
    CrickIQ Team Invitation
    
    Hi there!
    
    ${inviterName} has invited you to join ${teamName} on CrickIQ, our comprehensive cricket team management platform.
    
    ${position ? `Position: ${position}` : ''}
    ${message ? `Message: "${message}"` : ''}
    
    CrickIQ helps teams manage players, schedule matches, track performance, and streamline team operations. Join us to be part of an organized and data-driven cricket experience!
    
    Click here to join: ${inviteUrl}
    
    This invitation will expire in 7 days. If you have any questions, please contact ${inviterName}.
    
    You received this invitation because ${inviterName} added your email to ${teamName} on CrickIQ.
    If you didn't expect this invitation, you can safely ignore this email.
  `;

  try {
    // Use a verified sender email for SendGrid
    const fromEmail = process.env.FROM_EMAIL || 'test@example.com';
    
    await sgMail.send({
      to,
      from: {
        email: fromEmail,
        name: 'CrickIQ Team Management'
      },
      subject: `Join ${teamName} on CrickIQ - Team Invitation`,
      text: textContent,
      html: htmlContent,
    });
    
    console.log(`Invite email sent successfully to ${to} for team ${teamName}`);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error details:', error);
    
    // If SendGrid fails, log the invitation details for manual follow-up
    console.log(`Email invitation failed for ${to}. Invitation URL: ${inviteUrl}`);
    
    // Return false to indicate email sending failed
    return false;
  }
}