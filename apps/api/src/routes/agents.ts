import type { FastifyInstance } from 'fastify';
import {
  CreateAgentProfileSchema,
  UpdateAgentProfileSchema,
  AgentSearchSchema,
  AssignAgentSchema,
  RateAgentSchema,
  UuidParamSchema,
} from '@miraculturee/shared';
import { AgentSubscriptionService } from '../services/agent-subscription.service.js';

export async function agentRoutes(app: FastifyInstance) {
  // ─── Public: Browse agent marketplace ───

  /** GET /agents — search/browse verified agents by state */
  app.get('/', async (req) => {
    const { state, city, page, limit } = AgentSearchSchema.parse(req.query);
    const where: Record<string, unknown> = { verificationStatus: 'APPROVED' };
    if (state) where.state = state.toUpperCase();
    if (city) where.city = { contains: city, mode: 'insensitive' };

    const [agents, total] = await Promise.all([
      app.prisma.promoterAgent.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          headline: true,
          bio: true,
          state: true,
          city: true,
          profileImageUrl: true,
          bannerImageUrl: true,
          yearsExperience: true,
          promoterType: true,
          genres: true,
          skills: true,
          venueExperience: true,
          promotionHistory: true,
          socialLinks: true,
          totalCampaigns: true,
          rating: true,
          ratingCount: true,
          verificationStatus: true,
          profileStrength: true,
          createdAt: true,
        },
        orderBy: [{ totalCampaigns: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.promoterAgent.count({ where }),
    ]);

    return { agents, total, page, limit };
  });

  /** GET /agents/states — list states that have approved agents */
  app.get('/states', async () => {
    const states = await app.prisma.promoterAgent.groupBy({
      by: ['state'],
      where: { verificationStatus: 'APPROVED' },
      _count: { id: true },
      orderBy: { state: 'asc' },
    });
    return states.map((s) => ({ state: s.state, agentCount: s._count.id }));
  });

  /** GET /agents/:id — get a single agent profile */
  app.get('/:id', async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const agent = await app.prisma.promoterAgent.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        headline: true,
        bio: true,
        state: true,
        city: true,
        age: true,
        profileImageUrl: true,
        bannerImageUrl: true,
        yearsExperience: true,
        promoterType: true,
        genres: true,
        skills: true,
        venueExperience: true,
        promotionHistory: true,
        socialLinks: true,
        totalCampaigns: true,
        totalEarnedCents: false, // private
        rating: true,
        ratingCount: true,
        verificationStatus: true,
        profileStrength: true,
        createdAt: true,
        campaigns: {
          where: { status: 'COMPLETED' },
          select: {
            artistRating: true,
            artistReview: true,
            campaign: {
              select: { headline: true, event: { select: { title: true, venueCity: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return agent;
  });

  // ─── Authenticated: Agent profile management ───

  /** Calculate profile completion percentage */
  function calcProfileStrength(data: Record<string, unknown>): number {
    const fields: [string, number][] = [
      ['displayName', 10], ['profileImageUrl', 15], ['bio', 10], ['headline', 5],
      ['state', 5], ['city', 5], ['age', 5], ['yearsExperience', 5],
      ['promoterType', 5], ['venueExperience', 10], ['promotionHistory', 10],
      ['socialLinks', 10], ['genres', 5], ['bannerImageUrl', 5],
    ];
    let score = 0;
    for (const [field, weight] of fields) {
      const val = data[field];
      if (val && (typeof val !== 'object' || (Array.isArray(val) ? val.length > 0 : Object.values(val as Record<string, unknown>).some(Boolean)))) {
        score += weight;
      }
    }
    return Math.min(score, 100);
  }

  /** POST /agents/profile — create agent profile (requires AGENT role) */
  app.post('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateAgentProfileSchema.parse(req.body);

    // Check user doesn't already have a profile
    const existing = await app.prisma.promoterAgent.findUnique({ where: { userId: req.user.id } });
    if (existing) return reply.code(409).send({ error: 'You already have an agent profile' });

    // Update user role to AGENT if they're currently a FAN
    const user = await app.prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    if (user && (user.role === 'FAN' || user.role === 'LOCAL_FAN')) {
      await app.prisma.user.update({ where: { id: req.user.id }, data: { role: 'AGENT' } });
    }

    const profileStrength = calcProfileStrength(body as Record<string, unknown>);

    const agent = await app.prisma.promoterAgent.create({
      data: {
        userId: req.user.id,
        displayName: body.displayName,
        headline: body.headline,
        bio: body.bio,
        state: body.state.toUpperCase(),
        city: body.city,
        age: body.age,
        profileImageUrl: body.profileImageUrl,
        bannerImageUrl: body.bannerImageUrl,
        yearsExperience: body.yearsExperience,
        promoterType: body.promoterType,
        genres: body.genres ?? [],
        skills: body.skills ?? [],
        venueExperience: body.venueExperience,
        promotionHistory: body.promotionHistory,
        socialLinks: body.socialLinks ?? undefined,
        profileStrength,
      },
    });

    // Notify admins about new agent registration (fire and forget)
    void (async () => {
      if (!app.emailService) return;
      const admins = await app.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true },
      });
      const agentUser = await app.prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
      void app.emailService.sendAgentRegistrationNotify(
        admins.map((a) => a.email),
        {
          agentName: body.displayName,
          agentEmail: agentUser?.email || req.user.email,
          agentCity: body.city,
          agentState: body.state.toUpperCase(),
          promoterType: body.promoterType || null,
        },
      );
    })();

    return reply.code(201).send(agent);
  });

  /** GET /agents/profile/me — get own agent profile */
  app.get('/profile/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const agent = await app.prisma.promoterAgent.findUnique({
      where: { userId: req.user.id },
      include: {
        campaigns: {
          include: {
            campaign: {
              select: {
                id: true,
                headline: true,
                status: true,
                fundedCents: true,
                goalCents: true,
                event: { select: { title: true, date: true, venueCity: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!agent) return reply.code(404).send({ error: 'No agent profile found' });
    return agent;
  });

  /** PUT /agents/profile — update own agent profile */
  app.put('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = UpdateAgentProfileSchema.parse(req.body);
    const agent = await app.prisma.promoterAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) return reply.code(404).send({ error: 'No agent profile found' });

    const merged = { ...agent, ...body };
    const profileStrength = calcProfileStrength(merged as Record<string, unknown>);

    const updated = await app.prisma.promoterAgent.update({
      where: { id: agent.id },
      data: {
        ...body,
        state: body.state?.toUpperCase(),
        socialLinks: body.socialLinks ?? undefined,
        genres: body.genres ?? undefined,
        skills: body.skills ?? undefined,
        profileStrength,
      },
    });
    return updated;
  });

  // ─── Artist: Assign agent to campaign ───

  /** POST /agents/assign — artist assigns an agent to their campaign */
  app.post('/assign', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { agentId, campaignId } = AssignAgentSchema.parse(req.body);

    // Verify artist owns the campaign
    const campaign = await app.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { artist: true },
    });
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });
    if (campaign.artist.userId !== req.user.id) {
      return reply.code(403).send({ error: 'You do not own this campaign' });
    }

    // Verify agent exists and is approved
    const agent = await app.prisma.promoterAgent.findUnique({ where: { id: agentId } });
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    if (agent.verificationStatus !== 'APPROVED') {
      return reply.code(400).send({ error: 'Agent is not yet verified' });
    }

    // Check no agent already assigned
    const existing = await app.prisma.agentCampaign.findUnique({ where: { campaignId } });
    if (existing) return reply.code(409).send({ error: 'Campaign already has an agent assigned' });

    const agentCampaign = await app.prisma.agentCampaign.create({
      data: {
        agentId,
        campaignId,
        revenueSharePct: agent.revenueSharePct,
      },
    });

    return reply.code(201).send(agentCampaign);
  });

  /** DELETE /agents/assign/:id — artist removes agent from campaign */
  app.delete('/assign/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const agentCampaign = await app.prisma.agentCampaign.findUnique({
      where: { id },
      include: { campaign: { include: { artist: true } } },
    });
    if (!agentCampaign) return reply.code(404).send({ error: 'Assignment not found' });
    if (agentCampaign.campaign.artist.userId !== req.user.id) {
      return reply.code(403).send({ error: 'You do not own this campaign' });
    }
    if (agentCampaign.status === 'COMPLETED') {
      return reply.code(400).send({ error: 'Cannot remove agent from a completed campaign' });
    }

    await app.prisma.agentCampaign.delete({ where: { id } });
    return reply.send({ message: 'Agent removed from campaign' });
  });

  /** POST /agents/rate/:id — artist rates an agent after campaign */
  app.post('/rate/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const { rating, review } = RateAgentSchema.parse(req.body);

    const agentCampaign = await app.prisma.agentCampaign.findUnique({
      where: { id },
      include: { campaign: { include: { artist: true } }, agent: true },
    });
    if (!agentCampaign) return reply.code(404).send({ error: 'Assignment not found' });
    if (agentCampaign.campaign.artist.userId !== req.user.id) {
      return reply.code(403).send({ error: 'You do not own this campaign' });
    }

    // Update rating on the assignment
    await app.prisma.agentCampaign.update({
      where: { id },
      data: { artistRating: rating, artistReview: review },
    });

    // Recalculate agent's average rating
    const allRatings = await app.prisma.agentCampaign.findMany({
      where: { agentId: agentCampaign.agentId, artistRating: { not: null } },
      select: { artistRating: true },
    });
    const avg = allRatings.reduce((sum: number, r: { artistRating: number | null }) => sum + (r.artistRating ?? 0), 0) / allRatings.length;
    await app.prisma.promoterAgent.update({
      where: { id: agentCampaign.agentId },
      data: { rating: Math.round(avg * 10) / 10, ratingCount: allRatings.length },
    });

    return reply.send({ message: 'Rating submitted', averageRating: avg });
  });

  // ─── Admin: Agent verification ───

  /** POST /agents/verify/:id — admin approves/rejects an agent */
  app.post('/verify/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    // Check admin role
    const user = await app.prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    if (user?.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin only' });

    const { id } = UuidParamSchema.parse(req.params);
    const { status, note } = req.body as { status: 'APPROVED' | 'REJECTED'; note?: string };

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return reply.code(400).send({ error: 'Status must be APPROVED or REJECTED' });
    }

    const agent = await app.prisma.promoterAgent.update({
      where: { id },
      data: {
        verificationStatus: status,
        verificationNote: note,
        verifiedAt: status === 'APPROVED' ? new Date() : null,
      },
      include: { user: { select: { email: true } } },
    });

    // Notify agent of approval/rejection (fire and forget)
    if (app.emailService) {
      void app.emailService.sendAgentApprovalResult(agent.user.email, {
        agentName: agent.displayName,
        approved: status === 'APPROVED',
        note: note || null,
      });
    }

    const { user: _u, ...agentData } = agent;
    return agentData;
  });

  /** GET /agents/pending — admin lists agents awaiting verification */
  app.get('/pending', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await app.prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    if (user?.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin only' });

    const pending = await app.prisma.promoterAgent.findMany({
      where: { verificationStatus: 'PENDING' },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return pending;
  });

  // ─── Agent Subscription ($19.99/mo) ───

  const subService = new AgentSubscriptionService(app.prisma);

  /** POST /agents/subscribe — create Stripe checkout session for agent subscription */
  app.post('/subscribe', { preHandler: [app.authenticate] }, async (req, reply) => {
    const agent = await app.prisma.promoterAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) return reply.code(404).send({ error: 'No agent profile found. Create one first.' });

    const origin = (req.headers.origin || req.headers.referer || 'https://mira-culture.com').replace(/\/$/, '');
    try {
      const { sessionId, url } = await subService.createCheckoutSession(
        agent.id,
        req.user.id,
        `${origin}/agents/dashboard?subscribed=true`,
        `${origin}/agents/dashboard?subscribed=false`,
      );
      return { sessionId, url };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Subscription failed' });
    }
  });

  /** GET /agents/subscription — get agent subscription status + raffle credits */
  app.get('/subscription', { preHandler: [app.authenticate] }, async (req, reply) => {
    const agent = await app.prisma.promoterAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) return reply.code(404).send({ error: 'No agent profile found' });

    try {
      const status = await subService.getSubscriptionStatus(agent.id);
      return status;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed to get status' });
    }
  });

  /** POST /agents/portal — create Stripe billing portal session to manage subscription */
  app.post('/portal', { preHandler: [app.authenticate] }, async (req, reply) => {
    const agent = await app.prisma.promoterAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) return reply.code(404).send({ error: 'No agent profile found' });

    const origin = (req.headers.origin || req.headers.referer || 'https://mira-culture.com').replace(/\/$/, '');
    try {
      const url = await subService.createPortalSession(agent.id, `${origin}/agents/dashboard`);
      return { url };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Portal failed' });
    }
  });

  /** POST /agents/spend-credits — spend raffle credits toward a raffle entry */
  app.post('/spend-credits', { preHandler: [app.authenticate] }, async (req, reply) => {
    const agent = await app.prisma.promoterAgent.findUnique({ where: { userId: req.user.id } });
    if (!agent) return reply.code(404).send({ error: 'No agent profile found' });

    const { poolId, amountCents } = req.body as { poolId: string; amountCents: number };
    if (!poolId || !amountCents || amountCents <= 0) {
      return reply.code(400).send({ error: 'poolId and positive amountCents required' });
    }

    try {
      const result = await subService.spendRaffleCredits(agent.id, amountCents, { poolId });
      return {
        deductedCents: result.deductedCents,
        deductedDollars: (result.deductedCents / 100).toFixed(2),
        remainingCents: result.remainingCents,
        remainingDollars: (result.remainingCents / 100).toFixed(2),
      };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Credit spend failed' });
    }
  });
}
