import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SupportConfirmationData {
  userName: string;
  eventTitle: string;
  artistName: string;
  ticketCount: number;
  totalAmount: string;
}

export interface RaffleEntryConfirmationData {
  userName: string;
  eventTitle: string;
  tierPrice: string;
  drawDate: string;
}

export interface RaffleWinnerData {
  userName: string;
  eventTitle: string;
  venueName: string;
  eventDate: string;
  ticketCount: number;
}

export interface RaffleLoserData {
  userName: string;
  eventTitle: string;
}

export interface PasswordResetData {
  userName: string;
  resetLink: string;
}

export interface EmailVerificationData {
  userName: string;
  verifyLink: string;
}

export interface AdminEmailData {
  subject: string;
  message: string;
}

export interface DeveloperInviteData {
  inviteLink: string;
  inviterName: string;
  permission: string;
}

export interface TicketConfirmationData {
  userName: string;
  eventTitle: string;
  artistName: string;
  venueName: string;
  eventDate: string;
  totalAmount: string;
}

export interface AgentRegistrationNotifyData {
  agentName: string;
  agentEmail: string;
  agentCity: string;
  agentState: string;
  promoterType: string | null;
}

export interface AgentApprovalData {
  agentName: string;
  approved: boolean;
  note: string | null;
}

export interface WelcomeImportData {
  userName: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Shared template helpers
// ---------------------------------------------------------------------------

const FROM_ADDRESS = process.env.EMAIL_FROM || 'MiraCulture <noreply@mira-culture.com>';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MiraCulture</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Outfit',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#0f0f0f;border-radius:12px;overflow:hidden;border:1px solid #1a1a1a;">
          <!-- Logo Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #1a1a1a;">
              <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                <span style="color:#f59e0b;">M</span><span style="color:#ffffff;">iraCulture</span>
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #1a1a1a;text-align:center;">
              <p style="margin:0;font-size:13px;color:#737373;line-height:1.6;">
                MiraCulture &mdash; Fan-Powered Ticket Redistribution
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#525252;">
                You received this email because you have an account at MiraCulture.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
  <tr>
    <td style="background-color:#f59e0b;border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:14px 32px;color:#0a0a0a;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.2px;">${text}</a>
    </td>
  </tr>
</table>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#ffffff;line-height:1.3;">${text}</h2>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#d4d4d4;line-height:1.6;">${text}</p>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:8px 0;font-size:14px;color:#a3a3a3;width:140px;vertical-align:top;">${label}</td>
  <td style="padding:8px 0;font-size:14px;color:#ffffff;font-weight:500;">${value}</td>
</tr>`;
}

function detailsTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;background-color:#141414;border-radius:8px;padding:16px;">
  ${rows}
</table>`;
}

// ---------------------------------------------------------------------------
// Email Service
// ---------------------------------------------------------------------------

export class EmailService {
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  /**
   * Confirms a support ticket purchase to the fan.
   */
  async sendSupportConfirmation(
    to: string,
    data: SupportConfirmationData,
  ): Promise<void> {
    const subject = `You're supporting ${data.artistName}! \uD83C\uDFB5`;

    const html = layout(`
      ${heading(`Thank you for supporting ${data.artistName}!`)}
      ${paragraph(`Hey ${data.userName}, your support purchase has been confirmed. The tickets you purchased will enter the raffle pool, giving local fans a chance to attend the show at a fair price.`)}
      ${paragraph('Here are the details of your purchase:')}
      ${detailsTable(`
        ${detailRow('Event', data.eventTitle)}
        ${detailRow('Artist', data.artistName)}
        ${detailRow('Tickets', String(data.ticketCount))}
        ${detailRow('Total Paid', data.totalAmount)}
      `)}
      ${paragraph('Your contribution directly supports the artist and helps redistribute tickets to fans who truly want to be there. That is the MiraCulture way.')}
      ${ctaButton('View Your Purchase', 'https://mira-culture.com/dashboard')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send support confirmation:', error);
    }
  }

  /**
   * Confirms a raffle entry to the fan.
   */
  async sendRaffleEntryConfirmation(
    to: string,
    data: RaffleEntryConfirmationData,
  ): Promise<void> {
    const subject = `You're in the raffle for ${data.eventTitle}! \uD83C\uDFAB`;

    const html = layout(`
      ${heading('You are in the raffle!')}
      ${paragraph(`Hey ${data.userName}, your raffle entry has been confirmed. Sit tight and keep your fingers crossed — the draw is coming soon.`)}
      ${detailsTable(`
        ${detailRow('Event', data.eventTitle)}
        ${detailRow('Tier Price', data.tierPrice)}
        ${detailRow('Draw Date', data.drawDate)}
      `)}
      ${paragraph('When the draw happens, we will notify you immediately with the results. Good luck!')}
      ${ctaButton('View Raffle Details', 'https://mira-culture.com/dashboard')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send raffle entry confirmation:', error);
    }
  }

  /**
   * Notifies a raffle winner.
   */
  async sendRaffleWinnerNotification(
    to: string,
    data: RaffleWinnerData,
  ): Promise<void> {
    const subject = `\uD83C\uDF89 You won tickets to ${data.eventTitle}!`;

    const html = layout(`
      ${heading('Congratulations, you won!')}
      ${paragraph(`${data.userName}, incredible news — you have been selected as a winner in the raffle draw! Your tickets are confirmed and waiting for you.`)}
      ${detailsTable(`
        ${detailRow('Event', data.eventTitle)}
        ${detailRow('Venue', data.venueName)}
        ${detailRow('Date', data.eventDate)}
        ${detailRow('Tickets Won', String(data.ticketCount))}
      `)}
      ${paragraph('Head to your dashboard to view your ticket details and get ready for an amazing show.')}
      ${ctaButton('View Your Tickets', 'https://mira-culture.com/dashboard/tickets')}
      ${paragraph('See you there!')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send raffle winner notification:', error);
    }
  }

  /**
   * Consolation email for raffle non-winners.
   */
  async sendRaffleLoserNotification(
    to: string,
    data: RaffleLoserData,
  ): Promise<void> {
    const subject = `Raffle results for ${data.eventTitle}`;

    const html = layout(`
      ${heading('Raffle Results Are In')}
      ${paragraph(`Hey ${data.userName}, the raffle draw for <strong style="color:#ffffff;">${data.eventTitle}</strong> has been completed. Unfortunately, you were not selected as a winner this time.`)}
      ${paragraph('We know it is disappointing, but there are always more events and more chances to win. The MiraCulture community grows every day, and so do the opportunities.')}
      ${ctaButton('Browse More Events', 'https://mira-culture.com/events')}
      ${paragraph('Keep entering raffles — your next win could be just around the corner.')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send raffle loser notification:', error);
    }
  }

  /**
   * Confirms a direct ticket purchase to the fan.
   */
  async sendTicketConfirmation(
    to: string,
    data: TicketConfirmationData,
  ): Promise<void> {
    const subject = `Your ticket for ${data.eventTitle} is confirmed!`;

    const html = layout(`
      ${heading('Ticket Confirmed!')}
      ${paragraph(`Hey ${data.userName}, your ticket purchase has been confirmed. You are going to the show!`)}
      ${detailsTable(`
        ${detailRow('Event', data.eventTitle)}
        ${detailRow('Artist', data.artistName)}
        ${detailRow('Venue', data.venueName)}
        ${detailRow('Date', data.eventDate)}
        ${detailRow('Total Paid', data.totalAmount)}
      `)}
      ${paragraph('Head to your dashboard to view your ticket details. See you at the show!')}
      ${ctaButton('View Your Ticket', 'https://mira-culture.com/dashboard/tickets')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send ticket confirmation:', error);
    }
  }

  /**
   * Sends a password reset email with a CTA link.
   */
  async sendPasswordReset(
    to: string,
    data: PasswordResetData,
  ): Promise<void> {
    const subject = 'Reset Your Password';

    const html = layout(`
      ${heading('Reset Your Password')}
      ${paragraph(`Hey ${data.userName}, we received a request to reset your password. Click the button below to choose a new one.`)}
      ${ctaButton('Reset Password', data.resetLink)}
      ${paragraph('This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send password reset:', error);
    }
  }

  /**
   * Sends an email verification link after registration.
   */
  async sendEmailVerification(
    to: string,
    data: EmailVerificationData,
  ): Promise<void> {
    const subject = 'Verify Your Email';

    const html = layout(`
      ${heading('Verify Your Email')}
      ${paragraph(`Welcome to MiraCulture, ${data.userName}! Please verify your email address to get full access to your account.`)}
      ${ctaButton('Verify Email', data.verifyLink)}
      ${paragraph('This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send email verification:', error);
    }
  }

  /**
   * Sends a developer invite email.
   */
  async sendDeveloperInvite(
    to: string,
    data: DeveloperInviteData,
  ): Promise<void> {
    const subject = 'You have been invited to join MiraCulture as a Developer';

    const html = layout(`
      ${heading('Developer Invitation')}
      ${paragraph(`You have been invited by <strong style="color:#ffffff;">${data.inviterName}</strong> to join the MiraCulture platform as a developer.`)}
      ${detailsTable(`
        ${detailRow('Permission', data.permission)}
        ${detailRow('Invited By', data.inviterName)}
      `)}
      ${paragraph('Click the button below to accept the invitation and get access to the admin panel.')}
      ${ctaButton('Accept Invitation', data.inviteLink)}
      ${paragraph('This invitation expires in 7 days. If you did not expect this, you can safely ignore this email.')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send developer invite:', error);
    }
  }

  /**
   * Sends a custom email from admin to an artist.
   */
  async sendAdminEmail(
    to: string,
    data: AdminEmailData,
  ): Promise<void> {
    const html = layout(`
      ${heading(data.subject)}
      ${paragraph(data.message.replace(/\n/g, '<br />'))}
      ${paragraph('This message was sent by the MiraCulture admin team. If you have questions, reply to this email or visit your dashboard.')}
      ${ctaButton('Go to Dashboard', 'https://mira-culture.com/dashboard')}
    `);

    try {
      await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: data.subject,
        html,
      });
    } catch (error) {
      console.error('[EmailService] Failed to send admin email:', error);
      throw error;
    }
  }

  /**
   * Notifies all admins when a new agent registers and needs approval.
   */
  async sendAgentRegistrationNotify(
    adminEmails: string[],
    data: AgentRegistrationNotifyData,
  ): Promise<void> {
    if (adminEmails.length === 0) return;

    const subject = `New Agent Registration: ${data.agentName}`;

    const html = layout(`
      ${heading('New Agent Awaiting Approval')}
      ${paragraph('A new promoter agent has registered on MiraCulture and is awaiting your approval.')}
      ${detailsTable(`
        ${detailRow('Name', data.agentName)}
        ${detailRow('Email', data.agentEmail)}
        ${detailRow('Location', `${data.agentCity}, ${data.agentState}`)}
        ${detailRow('Type', data.promoterType || 'Not specified')}
      `)}
      ${paragraph('Log in to the admin panel to review and approve or reject this agent.')}
      ${ctaButton('Review Agent', 'https://mira-culture.com/admin')}
    `);

    for (const email of adminEmails) {
      try {
        await this.resend.emails.send({ from: FROM_ADDRESS, to: email, subject, html });
      } catch (error) {
        console.error(`[EmailService] Failed to notify admin ${email} about agent registration:`, error);
      }
    }
  }

  /**
   * Notifies an agent when their profile is approved or rejected.
   */
  async sendAgentApprovalResult(
    to: string,
    data: AgentApprovalData,
  ): Promise<void> {
    const subject = data.approved
      ? 'Your Agent Profile Has Been Approved!'
      : 'Agent Profile Review Update';

    const html = data.approved
      ? layout(`
          ${heading('Welcome to the Marketplace!')}
          ${paragraph(`Congratulations ${data.agentName}! Your promoter agent profile has been reviewed and approved. You are now visible in the MiraCulture agent marketplace.`)}
          ${data.note ? paragraph(`<em style="color:#a3a3a3;">Admin note: ${data.note}</em>`) : ''}
          ${paragraph('Artists can now find you and hire you for their campaigns. Make sure your profile is complete to attract more opportunities.')}
          ${ctaButton('View Your Dashboard', 'https://mira-culture.com/agents/dashboard')}
        `)
      : layout(`
          ${heading('Profile Review Update')}
          ${paragraph(`Hey ${data.agentName}, we have reviewed your promoter agent profile. Unfortunately, it was not approved at this time.`)}
          ${data.note ? paragraph(`<strong style="color:#ffffff;">Reason:</strong> ${data.note}`) : ''}
          ${paragraph('You can update your profile and resubmit for review. Make sure all fields are filled out and your information is accurate.')}
          ${ctaButton('Update Your Profile', 'https://mira-culture.com/agents/dashboard')}
        `);

    try {
      await this.resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    } catch (error) {
      console.error('[EmailService] Failed to send agent approval result:', error);
    }
  }

  async sendOutreachInvite(to: string, recipientName: string, _source: string): Promise<void> {
    const subject = `${recipientName}, the music scene needs you`;

    const html = layout(`
      <div style="text-align:center;margin-bottom:24px;">
        <img src="https://mira-culture.com/logo-gold.png" alt="MiraCulture" width="400" height="auto" style="display:inline-block;max-width:100%;" />
      </div>
      ${heading("You're Part of the Scene. Now Help Shape It.")}
      ${paragraph(`Hey ${recipientName} — if you care about live music and the culture around it, we built something for you.`)}

      <div style="background-color:#1a1a1a;border-radius:8px;padding:24px;margin:20px 0;border-left:3px solid #f59e0b;">
        <p style="margin:0 0 8px;font-size:15px;color:#f59e0b;font-weight:600;">What is MiraCulture?</p>
        <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.7;">
          A fan-powered ticketing platform where <strong style="color:#fff;">fans fund affordable concert tickets</strong> and win them through <strong style="color:#fff;">cryptographically fair $5 raffles</strong>. No scalpers. No bots. No $300 service fees. Just real fans getting into real shows.
        </p>
      </div>

      ${heading('How It Works')}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
        <tr>
          <td style="padding:12px 16px;background:#1a1a1a;border-radius:8px 8px 0 0;border-bottom:1px solid #222;">
            <span style="color:#f59e0b;font-weight:700;font-size:18px;">1.</span>
            <span style="color:#e5e5e5;font-size:14px;margin-left:8px;"><strong>Artists launch campaigns</strong> for their upcoming shows</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#1a1a1a;border-bottom:1px solid #222;">
            <span style="color:#f59e0b;font-weight:700;font-size:18px;">2.</span>
            <span style="color:#e5e5e5;font-size:14px;margin-left:8px;"><strong>Fans donate</strong> to unlock affordable tickets ($5&ndash;$10)</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#1a1a1a;border-bottom:1px solid #222;">
            <span style="color:#f59e0b;font-weight:700;font-size:18px;">3.</span>
            <span style="color:#e5e5e5;font-size:14px;margin-left:8px;"><strong>Local fans win tickets</strong> via provably fair cryptographic raffle</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#1a1a1a;border-radius:0 0 8px 8px;">
            <span style="color:#f59e0b;font-weight:700;font-size:18px;">4.</span>
            <span style="color:#e5e5e5;font-size:14px;margin-left:8px;"><strong>100% of support</strong> goes directly to the artist. Always.</span>
          </td>
        </tr>
      </table>

      <div style="background-color:#1a1a1a;border-radius:8px;padding:24px;margin:20px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding:8px;text-align:center;">
              <p style="margin:0;color:#f59e0b;font-size:22px;font-weight:700;">For Fans</p>
              <p style="margin:8px 0 0;color:#a3a3a3;font-size:13px;line-height:1.6;">
                $5 raffle entries<br/>
                Face-value tickets<br/>
                Zero scalper markup<br/>
                Support artists directly
              </p>
            </td>
            <td width="50%" style="padding:8px;text-align:center;border-left:1px solid #333;">
              <p style="margin:0;color:#f59e0b;font-size:22px;font-weight:700;">For Artists</p>
              <p style="margin:8px 0 0;color:#a3a3a3;font-size:13px;line-height:1.6;">
                Keep 100% of support<br/>
                Build real fan relationships<br/>
                Bonus from surplus donations<br/>
                Free campaign tools
              </p>
            </td>
          </tr>
        </table>
      </div>

      ${paragraph('Signing up takes 30 seconds. Browse events, enter raffles, support your favorite artists — and if you <em>are</em> an artist, create your profile and start running campaigns for free.')}

      ${ctaButton('Join MiraCulture — It\'s Free', 'https://mira-culture.com/register')}

      <p style="margin:24px 0 0;font-size:12px;color:#525252;text-align:center;line-height:1.6;">
        Questions? Reply to this email or hit us at <a href="mailto:support@mira-culture.com" style="color:#f59e0b;">support@mira-culture.com</a>
      </p>
    `);

    try {
      await this.resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    } catch (error) {
      console.error('[EmailService] Failed to send outreach invite:', error);
      throw error;
    }
  }

  async sendWelcomeImport(to: string, data: WelcomeImportData): Promise<void> {
    const subject = `You're in! Your MiraCulture account is ready`;
    const html = layout(`
      ${heading('Welcome to MiraCulture!')}
      ${paragraph(`Hey ${data.userName}! Because you signed up on <strong>${data.source}</strong>, we've created a MiraCulture account for you automatically.`)}
      ${paragraph('MiraCulture is a fan-powered ticketing platform where you can support artists, enter $5 ticket raffles, and never deal with scalpers again. Every raffle is cryptographically fair.')}
      ${paragraph('To get started, just set your password and you\'re in:')}
      ${ctaButton('Set Your Password', 'https://mira-culture.com/forgot-password')}
      ${paragraph('<em style="color:#737373;">Use the "Forgot Password" flow with your email to create your password. Your account is already set up and waiting.</em>')}
    `);

    try {
      await this.resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    } catch (error) {
      console.error('[EmailService] Failed to send welcome import:', error);
    }
  }
}
