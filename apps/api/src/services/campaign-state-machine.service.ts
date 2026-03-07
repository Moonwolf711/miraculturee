import type { PrismaClient, Campaign } from '@prisma/client';
import type { Server } from 'socket.io';
import { CAMPAIGN_TRANSITIONS } from '@miraculturee/shared';
import type { CampaignStatus } from '@miraculturee/shared';
import { scheduleRaffleDraw } from '../jobs/workers.js';
import { CreditsService } from './credits.service.js';

/**
 * Campaign State Machine Service
 *
 * Handles automated lifecycle transitions:
 *   DRAFT → ACTIVE (manual)
 *   ACTIVE → GOAL_REACHED (auto: funded >= goal)
 *   GOAL_REACHED → TICKETS_OPEN (immediate)
 *   ACTIVE → RAFFLE_MODE (auto: time expired before goal)
 *   TICKETS_OPEN → OVERFLOW (auto: donations continue past goal)
 *   OVERFLOW → SURPLUS_RESOLVED (auto: day before show)
 *   RAFFLE_MODE → ENDED (auto: after raffle draw)
 *   SURPLUS_RESOLVED → ENDED (auto: after show)
 */
export class CampaignStateMachineService {
  constructor(
    private prisma: PrismaClient,
    private io?: Server,
  ) {}

  /** Validate that a transition is allowed. */
  private canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
    return (CAMPAIGN_TRANSITIONS[from] ?? []).includes(to);
  }

  /** Transition a campaign to a new status with validation and logging. */
  async transition(campaignId: string, to: CampaignStatus): Promise<Campaign | null> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { event: true, artist: { include: { user: true } } },
    });
    if (!campaign) return null;

    const from = campaign.status as CampaignStatus;
    if (from === to) return campaign;
    if (!this.canTransition(from, to)) {
      console.warn(`[CampaignSM] Invalid transition ${from} → ${to} for campaign ${campaignId}`);
      return null;
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: to },
      include: { event: true, artist: { include: { user: true } } },
    });

    console.info(`[CampaignSM] Campaign ${campaignId}: ${from} → ${to}`);

    // Side effects per transition
    await this.onTransition(updated, from, to);

    // Broadcast via WebSocket
    this.broadcast(updated, from, to);

    return updated;
  }

  /** Execute side effects for a specific transition. */
  private async onTransition(campaign: any, from: CampaignStatus, to: CampaignStatus): Promise<void> {
    const artistUserId = campaign.artist?.userId;

    switch (to) {
      case 'GOAL_REACHED': {
        // Mark goalReached flag if not already set
        if (!campaign.goalReached) {
          await this.prisma.campaign.update({
            where: { id: campaign.id },
            data: { goalReached: true, goalReachedAt: new Date() },
          });
        }
        // Increment artist's successful campaigns
        await this.prisma.artist.update({
          where: { id: campaign.artistId },
          data: { successfulCampaigns: { increment: 1 } },
        });
        // Notify artist
        if (artistUserId) {
          await this.prisma.notification.create({
            data: {
              userId: artistUserId,
              title: 'Campaign Goal Reached!',
              body: `Your campaign "${campaign.headline}" has reached its funding goal! Local tickets are now available.`,
              metadata: { campaignId: campaign.id, eventId: campaign.eventId, type: 'campaign_goal_reached' },
            },
          });
        }
        // Auto-transition to TICKETS_OPEN immediately
        await this.transition(campaign.id, 'TICKETS_OPEN');
        break;
      }

      case 'TICKETS_OPEN': {
        // Notify artist that local tickets are live
        if (artistUserId) {
          await this.prisma.notification.create({
            data: {
              userId: artistUserId,
              title: 'Local Tickets Now Available',
              body: `${campaign.maxLocalTickets} discounted tickets at $${(campaign.discountCents / 100).toFixed(2)} are now available for local fans.`,
              metadata: { campaignId: campaign.id, eventId: campaign.eventId, type: 'tickets_open' },
            },
          });
        }
        break;
      }

      case 'OVERFLOW': {
        // Notify artist that surplus donations are accumulating
        if (artistUserId) {
          const surplusCents = campaign.fundedCents - campaign.goalCents;
          await this.prisma.notification.create({
            data: {
              userId: artistUserId,
              title: 'Surplus Donations Growing',
              body: `Your campaign has exceeded its goal! $${(surplusCents / 100).toFixed(2)} in surplus donations so far.`,
              metadata: { campaignId: campaign.id, eventId: campaign.eventId, type: 'overflow' },
            },
          });
        }
        break;
      }

      case 'RAFFLE_MODE': {
        // Time expired before goal — convert donations to credits for donors
        const creditsService = new CreditsService(this.prisma);
        const creditResult = await creditsService.convertCampaignDonationsToCredits(campaign.id);
        console.info(
          `[CampaignSM] Converted ${creditResult.converted} donations ($${(creditResult.totalCents / 100).toFixed(2)}) to credits for campaign ${campaign.id}`,
        );

        // Schedule raffle draw for day of show
        const rafflePools = await this.prisma.rafflePool.findMany({
          where: { eventId: campaign.eventId, status: 'OPEN' },
        });
        for (const pool of rafflePools) {
          const drawTime = pool.scheduledDrawTime ?? campaign.event.date;
          await scheduleRaffleDraw(pool.id, drawTime);
        }
        // Notify artist
        if (artistUserId) {
          await this.prisma.notification.create({
            data: {
              userId: artistUserId,
              title: 'Campaign Entered Raffle Mode',
              body: `Your campaign "${campaign.headline}" didn't reach its full goal in time. Donors have received platform credits. Raffle tickets will be drawn on the day of the show.`,
              metadata: { campaignId: campaign.id, eventId: campaign.eventId, type: 'raffle_mode' },
            },
          });
        }
        break;
      }

      case 'SURPLUS_RESOLVED': {
        // Day before show — surplus calculation done by pre-event worker
        if (artistUserId) {
          const bonusDisplay = campaign.bonusCents > 0
            ? ` You earned a $${(campaign.bonusCents / 100).toFixed(2)} artist bonus!`
            : '';
          await this.prisma.notification.create({
            data: {
              userId: artistUserId,
              title: 'Surplus Resolved',
              body: `Campaign surplus for "${campaign.headline}" has been processed.${bonusDisplay}`,
              metadata: { campaignId: campaign.id, eventId: campaign.eventId, type: 'surplus_resolved' },
            },
          });
        }
        break;
      }

      case 'ENDED': {
        if (artistUserId) {
          await this.prisma.notification.create({
            data: {
              userId: artistUserId,
              title: 'Campaign Complete',
              body: `Your campaign "${campaign.headline}" has ended. Check your earnings dashboard for details.`,
              metadata: { campaignId: campaign.id, eventId: campaign.eventId, type: 'campaign_ended' },
            },
          });
        }
        break;
      }
    }
  }

  /** Broadcast campaign state change via WebSocket. */
  private broadcast(campaign: any, from: CampaignStatus, to: CampaignStatus): void {
    if (!this.io) return;

    const payload = {
      campaignId: campaign.id,
      eventId: campaign.eventId,
      from,
      to,
      fundedCents: campaign.fundedCents,
      goalCents: campaign.goalCents,
      goalReached: campaign.goalReached,
      bonusCents: campaign.bonusCents,
    };

    this.io.to(`event:${campaign.eventId}`).emit('campaign:state', payload);
    this.io.to('events:list').emit('campaign:state', payload);
  }

  /**
   * Run lifecycle checks on all active campaigns.
   * Called by the campaign-lifecycle BullMQ worker every 5 minutes.
   */
  async runLifecycleTick(): Promise<{ checked: number; transitioned: number }> {
    const now = new Date();
    let transitioned = 0;

    // Find all campaigns that aren't ENDED or DRAFT
    const activeCampaigns = await this.prisma.campaign.findMany({
      where: { status: { notIn: ['ENDED', 'DRAFT'] } },
      include: { event: true },
    });

    for (const campaign of activeCampaigns) {
      const status = campaign.status as CampaignStatus;
      const eventDate = new Date(campaign.event.date);
      const dayBeforeShow = new Date(eventDate);
      dayBeforeShow.setHours(dayBeforeShow.getHours() - 24);
      const endAt = campaign.endAt ? new Date(campaign.endAt) : dayBeforeShow;

      try {
        // ACTIVE campaigns: check if goal reached or time expired
        if (status === 'ACTIVE') {
          if (campaign.fundedCents >= campaign.goalCents && campaign.goalCents > 0) {
            await this.transition(campaign.id, 'GOAL_REACHED');
            transitioned++;
          } else if (now >= endAt) {
            // Time expired before goal — enter raffle mode
            await this.transition(campaign.id, 'RAFFLE_MODE');
            transitioned++;
          }
        }

        // TICKETS_OPEN: check if donations have exceeded goal (overflow)
        if (status === 'TICKETS_OPEN') {
          if (campaign.fundedCents > campaign.goalCents) {
            await this.transition(campaign.id, 'OVERFLOW');
            transitioned++;
          } else if (now >= dayBeforeShow) {
            // Day before show, no overflow — go straight to surplus resolved
            await this.transition(campaign.id, 'SURPLUS_RESOLVED');
            transitioned++;
          }
        }

        // OVERFLOW: check if day before show → resolve surplus
        if (status === 'OVERFLOW') {
          if (now >= dayBeforeShow) {
            await this.transition(campaign.id, 'SURPLUS_RESOLVED');
            transitioned++;
          }
        }

        // RAFFLE_MODE: check if show has passed → end
        if (status === 'RAFFLE_MODE') {
          if (now >= eventDate) {
            await this.transition(campaign.id, 'ENDED');
            transitioned++;
          }
        }

        // SURPLUS_RESOLVED: check if show has passed → end
        if (status === 'SURPLUS_RESOLVED') {
          if (now >= eventDate) {
            await this.transition(campaign.id, 'ENDED');
            transitioned++;
          }
        }

        // GOAL_REACHED shouldn't linger — auto-transitions to TICKETS_OPEN in onTransition
        // But if it somehow gets stuck:
        if (status === 'GOAL_REACHED') {
          await this.transition(campaign.id, 'TICKETS_OPEN');
          transitioned++;
        }
      } catch (err) {
        console.error(`[CampaignSM] Error processing campaign ${campaign.id}:`, err);
      }
    }

    return { checked: activeCampaigns.length, transitioned };
  }

  /**
   * Handle a funding update (called from SupportService after payment confirmation).
   * Checks if the campaign should transition based on new funding level.
   */
  async onFundingUpdate(campaignId: string, newFundedCents: number): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    const status = campaign.status as CampaignStatus;

    // ACTIVE → GOAL_REACHED when funding meets goal
    if (status === 'ACTIVE' && newFundedCents >= campaign.goalCents && campaign.goalCents > 0) {
      await this.transition(campaignId, 'GOAL_REACHED');
    }

    // TICKETS_OPEN → OVERFLOW when donations exceed goal
    if (status === 'TICKETS_OPEN' && newFundedCents > campaign.goalCents) {
      await this.transition(campaignId, 'OVERFLOW');
    }
  }
}
