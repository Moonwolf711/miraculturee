import type { FastifyInstance } from 'fastify';

const CONTACT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  initial_request: {
    subject: 'API Partnership Request — MiraCulture Fan-Powered Ticketing',
    body: `Hi {platform} Developer Relations Team,

My name is [YOUR NAME] and I'm the founder of MiraCulture (https://mira-culture.com), a fan-powered ticketing platform that helps artists make live music more accessible.

We'd love to integrate with {platform}'s API to:
- Pull real-time event data and pricing for shows
- Enable seamless ticket discovery for fans
- Ensure accurate venue and pricing information

Our platform focuses on community-driven campaigns where fans collectively support artists, and accurate ticketing data from {platform} would greatly enhance our users' experience.

Could you point me to the right process for obtaining API credentials? We're happy to comply with any terms of service, rate limits, and data usage policies.

Thank you for your time!

Best regards,
[YOUR NAME]
MiraCulture — Where Fans Power the Show
https://mira-culture.com`,
  },
  follow_up: {
    subject: 'Follow-up: API Partnership Request — MiraCulture',
    body: `Hi {platform} Team,

I'm following up on my previous request regarding API access for MiraCulture (https://mira-culture.com).

We're a growing platform connecting artists with fans through community-powered ticketing, and integrating with {platform} would allow us to provide the best possible experience for our users.

Is there any additional information you need from us to proceed with the API key request?

Thank you!

Best regards,
[YOUR NAME]
MiraCulture`,
  },
};

export default async function integrationRoutes(app: FastifyInstance) {
  /** GET /admin/integrations — list all ticketing platforms */
  app.get('/', async () => {
    const platforms = await app.prisma.ticketingPlatform.findMany({
      include: { _count: { select: { contactLogs: true } } },
      orderBy: { displayName: 'asc' },
    });
    return { platforms };
  });

  /** GET /admin/integrations/:id — get platform details with contact history */
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const platform = await app.prisma.ticketingPlatform.findUnique({
      where: { id },
      include: {
        contactLogs: { orderBy: { sentAt: 'desc' }, take: 20 },
      },
    });
    if (!platform) return reply.code(404).send({ error: 'Platform not found' });
    return platform;
  });

  /** PUT /admin/integrations/:id — update platform status/details */
  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, apiKey, apiSecret, contactEmail, devPortalUrl, notes } = req.body as Record<string, string | undefined>;

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (apiSecret !== undefined) data.apiSecret = apiSecret;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (devPortalUrl !== undefined) data.devPortalUrl = devPortalUrl;
    if (notes !== undefined) data.notes = notes;

    if (status === 'CONTACTED' && !data.contactedAt) data.contactedAt = new Date();
    if (status === 'ACTIVE' || status === 'API_KEY_RECEIVED') data.approvedAt = new Date();

    const platform = await app.prisma.ticketingPlatform.update({ where: { id }, data });
    return platform;
  });

  /** POST /admin/integrations/:id/contact — log a contact message and generate email */
  app.post('/:id/contact', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { messageType, customSubject, customBody } = req.body as {
      messageType: string;
      customSubject?: string;
      customBody?: string;
    };

    const platform = await app.prisma.ticketingPlatform.findUnique({ where: { id } });
    if (!platform) return reply.code(404).send({ error: 'Platform not found' });

    const template = CONTACT_TEMPLATES[messageType];
    const subject = customSubject || (template?.subject.replace(/\{platform\}/g, platform.displayName) ?? 'API Request');
    const body = customBody || (template?.body.replace(/\{platform\}/g, platform.displayName) ?? '');

    const log = await app.prisma.platformContactLog.create({
      data: {
        platformId: id,
        messageType,
        subject,
        body,
        sentById: req.user?.id,
      },
    });

    // Update platform status to CONTACTED if it was NOT_STARTED
    if (platform.status === 'NOT_STARTED') {
      await app.prisma.ticketingPlatform.update({
        where: { id },
        data: { status: 'CONTACTED', contactedAt: new Date() },
      });
    }

    // If email service is available and platform has a contact email, send it
    if (app.emailService && platform.contactEmail) {
      try {
        await app.emailService.sendAdminEmail(platform.contactEmail, { subject, message: body });
        return reply.code(201).send({ log, emailSent: true });
      } catch {
        return reply.code(201).send({ log, emailSent: false, emailError: 'Email delivery failed' });
      }
    }

    return reply.code(201).send({
      log,
      emailSent: false,
      copyableEmail: {
        to: platform.contactEmail || 'Unknown — find on their developer portal',
        subject,
        body,
      },
    });
  });

  /** GET /admin/integrations/templates — get available contact templates */
  app.get('/templates/list', async () => {
    return {
      templates: Object.entries(CONTACT_TEMPLATES).map(([key, tmpl]) => ({
        key,
        subject: tmpl.subject,
        preview: tmpl.body.substring(0, 200) + '...',
      })),
    };
  });

  /** POST /admin/integrations — add a new platform */
  app.post('/', async (req, reply) => {
    const { name, displayName, devPortalUrl, contactEmail } = req.body as Record<string, string>;
    if (!name || !displayName) return reply.code(400).send({ error: 'name and displayName required' });

    const platform = await app.prisma.ticketingPlatform.create({
      data: { name: name.toLowerCase(), displayName, devPortalUrl, contactEmail },
    });
    return reply.code(201).send(platform);
  });

  /** DELETE /admin/integrations/:id — remove a platform */
  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await app.prisma.ticketingPlatform.delete({ where: { id } });
    return { success: true };
  });
}
