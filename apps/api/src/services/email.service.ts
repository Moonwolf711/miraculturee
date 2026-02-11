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

export interface TicketConfirmationData {
  userName: string;
  eventTitle: string;
  artistName: string;
  venueName: string;
  eventDate: string;
  totalAmount: string;
}

// ---------------------------------------------------------------------------
// Shared template helpers
// ---------------------------------------------------------------------------

const FROM_ADDRESS = 'onboarding@resend.dev';

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
      ${ctaButton('View Your Purchase', 'https://miraculture.com/dashboard')}
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
      ${ctaButton('View Raffle Details', 'https://miraculture.com/dashboard')}
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
      ${ctaButton('View Your Tickets', 'https://miraculture.com/dashboard/tickets')}
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
      ${ctaButton('Browse More Events', 'https://miraculture.com/events')}
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
      ${ctaButton('View Your Ticket', 'https://miraculture.com/dashboard/tickets')}
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
}
