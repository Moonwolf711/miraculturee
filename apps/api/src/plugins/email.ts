import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { EmailService } from '../services/email.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    emailService: EmailService | null;
  }
}

export const emailPlugin = fp(async (app: FastifyInstance) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    app.log.warn(
      '[Email] RESEND_API_KEY not set — email notifications are disabled. ' +
        'Set the environment variable to enable email delivery.',
    );
    app.decorate('emailService', null);
    return;
  }

  const emailService = new EmailService(apiKey);
  app.decorate('emailService', emailService);

  app.log.info('[Email] Email service initialized');
});
