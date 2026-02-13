import type { PrismaClient } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';

/**
 * Automated Ticket Purchasing Agent
 *
 * Runs as a background worker to automatically acquire real venue tickets
 * using Stripe Issuing virtual cards. Supports:
 *   - Eventbrite API purchases (most EDM events)
 *   - Generic URL detection and admin fallback
 *
 * Flow:
 *   1. Scan for events with funded support tickets but no acquisition
 *   2. Create a Stripe Issuing virtual card per acquisition
 *   3. Attempt automated purchase via venue API
 *   4. If automation fails, flag for admin with card details + purchase URL
 *   5. On success, mark acquisition complete + freeze card
 */

interface PurchaseResult {
  success: boolean;
  confirmationRef?: string;
  error?: string;
  requiresManual?: boolean;
}

type VenuePlatform = 'eventbrite' | 'axs' | 'dice' | 'ra' | 'unknown';

export class PurchaseAgentService {
  private cardholderId: string;

  constructor(
    private prisma: PrismaClient,
    private pos: POSClient,
  ) {
    this.cardholderId = process.env.STRIPE_ISSUING_CARDHOLDER_ID || '';
  }

  /**
   * Main agent loop: find events needing tickets, buy them.
   * Called by BullMQ worker on schedule or manually.
   */
  async runAcquisitionCycle(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    flaggedForAdmin: number;
  }> {
    if (!this.cardholderId) {
      console.warn('[PurchaseAgent] STRIPE_ISSUING_CARDHOLDER_ID not set — skipping cycle');
      return { processed: 0, succeeded: 0, failed: 0, flaggedForAdmin: 0 };
    }

    const pendingEvents = await this.findEventsNeedingAcquisition();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let flaggedForAdmin = 0;

    for (const event of pendingEvents) {
      processed++;

      try {
        const result = await this.acquireTicketsForEvent(event);

        if (result.success) {
          succeeded++;
        } else if (result.requiresManual) {
          flaggedForAdmin++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`[PurchaseAgent] Error processing event ${event.eventId}:`, (err as Error).message);
        failed++;
      }
    }

    console.log(
      `[PurchaseAgent] Cycle complete: ${processed} processed, ${succeeded} succeeded, ` +
      `${flaggedForAdmin} flagged for admin, ${failed} failed`,
    );

    return { processed, succeeded, failed, flaggedForAdmin };
  }

  /**
   * Find events with confirmed support funds that still need real tickets purchased.
   */
  private async findEventsNeedingAcquisition() {
    const events = await this.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        date: { gte: new Date() },
        supportTickets: { some: { confirmed: true } },
      },
      include: {
        supportTickets: { where: { confirmed: true } },
        ticketAcquisitions: true,
        _count: {
          select: {
            directTickets: { where: { status: { in: ['CONFIRMED', 'REDEEMED'] } } },
          },
        },
      },
    });

    const results: Array<{
      eventId: string;
      title: string;
      venueName: string;
      ticketPriceCents: number;
      ticketsNeeded: number;
      totalCostCents: number;
    }> = [];

    for (const event of events) {
      const totalFunded = event.supportTickets.reduce((s, t) => s + t.totalAmountCents, 0);
      const alreadyAcquired = event.ticketAcquisitions
        .filter((a) => a.status !== 'FAILED')
        .reduce((s, a) => s + a.ticketCount, 0);

      const ticketsFromFunds = Math.floor(totalFunded / event.ticketPriceCents);
      const remaining = ticketsFromFunds - alreadyAcquired;

      if (remaining > 0) {
        results.push({
          eventId: event.id,
          title: event.title,
          venueName: event.venueName,
          ticketPriceCents: event.ticketPriceCents,
          ticketsNeeded: remaining,
          totalCostCents: remaining * event.ticketPriceCents,
        });
      }
    }

    return results;
  }

  /**
   * Acquire tickets for a single event:
   *   1. Resolve the venue purchase URL from EDMTrain data
   *   2. Create a virtual card with exact spending limit
   *   3. Attempt automated purchase or flag for admin
   */
  private async acquireTicketsForEvent(event: {
    eventId: string;
    title: string;
    venueName: string;
    ticketPriceCents: number;
    ticketsNeeded: number;
    totalCostCents: number;
  }): Promise<PurchaseResult> {
    // 1. Find the purchase URL from external event data
    const purchaseUrl = await this.resolvePurchaseUrl(event.eventId, event.title, event.venueName);

    // 2. Create acquisition record
    const acquisition = await this.prisma.ticketAcquisition.create({
      data: {
        eventId: event.eventId,
        ticketCount: event.ticketsNeeded,
        totalAmountCents: event.totalCostCents,
        purchaseUrl,
        status: 'PENDING',
      },
    });

    // 3. Create virtual card with spending limit
    let cardId: string;
    let cardLast4: string;
    try {
      const card = await this.pos.createVirtualCard(this.cardholderId, event.totalCostCents);
      cardId = card.id;
      cardLast4 = card.last4;

      await this.prisma.ticketAcquisition.update({
        where: { id: acquisition.id },
        data: { stripeCardId: cardId, cardLast4, status: 'CARD_CREATED' },
      });
    } catch (err) {
      const msg = `Failed to create virtual card: ${(err as Error).message}`;
      await this.prisma.ticketAcquisition.update({
        where: { id: acquisition.id },
        data: { status: 'FAILED', errorMessage: msg },
      });
      return { success: false, error: msg };
    }

    // 4. Detect platform and attempt automated purchase
    const platform = this.detectPlatform(purchaseUrl);

    if (platform === 'eventbrite' && purchaseUrl) {
      // Attempt Eventbrite API purchase
      await this.prisma.ticketAcquisition.update({
        where: { id: acquisition.id },
        data: { status: 'PURCHASING' },
      });

      const result = await this.purchaseViaEventbrite(acquisition.id, purchaseUrl, event, cardId);
      return result;
    }

    // 5. Can't automate — flag for manual purchase by admin
    await this.flagForManualPurchase(acquisition.id, event, platform, purchaseUrl);
    return { success: false, requiresManual: true };
  }

  /**
   * Look up the purchase URL from EDMTrain external event data.
   */
  private async resolvePurchaseUrl(
    eventId: string,
    title: string,
    venueName: string,
  ): Promise<string | undefined> {
    // Check ExternalEvent table for source URL
    const ext = await this.prisma.externalEvent.findFirst({
      where: {
        OR: [
          { importedEventId: eventId },
          { title, venueName },
        ],
      },
      select: { sourceUrl: true, rawData: true },
    });

    if (ext?.sourceUrl) return ext.sourceUrl;

    // Try to extract link from rawData (EDMTrain stores full event object)
    if (ext?.rawData && typeof ext.rawData === 'object') {
      const raw = ext.rawData as any;
      if (raw.link) return raw.link;
      if (raw.ticketLink) return raw.ticketLink;
    }

    return undefined;
  }

  /**
   * Detect which ticketing platform a URL belongs to.
   */
  private detectPlatform(url?: string): VenuePlatform {
    if (!url) return 'unknown';
    const lower = url.toLowerCase();

    if (lower.includes('eventbrite.com')) return 'eventbrite';
    if (lower.includes('axs.com')) return 'axs';
    if (lower.includes('dice.fm')) return 'dice';
    if (lower.includes('ra.co') || lower.includes('residentadvisor.net')) return 'ra';

    return 'unknown';
  }

  /**
   * Purchase tickets via the Eventbrite API.
   *
   * Eventbrite flow:
   *   1. Extract event ID from URL
   *   2. GET /events/{id}/ticket_classes/ to find ticket class
   *   3. POST /events/{id}/orders/ to create an order
   *   4. POST /orders/{id}/attendees/ with ticket info
   *   5. POST /payments/ to charge the virtual card
   *
   * Requires EVENTBRITE_API_TOKEN env var (OAuth private token).
   */
  private async purchaseViaEventbrite(
    acquisitionId: string,
    purchaseUrl: string,
    event: { ticketsNeeded: number; ticketPriceCents: number; eventId: string },
    cardId: string,
  ): Promise<PurchaseResult> {
    const ebToken = process.env.EVENTBRITE_API_TOKEN;
    if (!ebToken) {
      // No Eventbrite API token — fall back to manual
      await this.flagForManualPurchase(acquisitionId, event as any, 'eventbrite', purchaseUrl);
      return { success: false, requiresManual: true };
    }

    try {
      // Extract Eventbrite event ID from URL
      const ebEventId = this.extractEventbriteId(purchaseUrl);
      if (!ebEventId) {
        await this.flagForManualPurchase(acquisitionId, event as any, 'eventbrite', purchaseUrl);
        return { success: false, requiresManual: true };
      }

      const baseUrl = 'https://www.eventbriteapi.com/v3';
      const headers = {
        Authorization: `Bearer ${ebToken}`,
        'Content-Type': 'application/json',
      };

      // 1. Get ticket classes (available ticket types)
      const ticketRes = await fetch(`${baseUrl}/events/${ebEventId}/ticket_classes/`, { headers });
      if (!ticketRes.ok) throw new Error(`Eventbrite ticket_classes: ${ticketRes.status}`);
      const ticketData = await ticketRes.json() as any;

      const ticketClass = ticketData.ticket_classes?.find(
        (tc: any) => tc.on_sale_status === 'AVAILABLE' && !tc.free,
      );

      if (!ticketClass) {
        const msg = 'No available paid ticket classes found on Eventbrite';
        await this.prisma.ticketAcquisition.update({
          where: { id: acquisitionId },
          data: { status: 'FAILED', errorMessage: msg },
        });
        return { success: false, error: msg };
      }

      // 2. Create order via Eventbrite API
      const orderRes = await fetch(`${baseUrl}/events/${ebEventId}/orders/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          attendees: Array.from({ length: event.ticketsNeeded }, () => ({
            ticket_class_id: ticketClass.id,
            quantity: 1,
          })),
        }),
      });

      if (!orderRes.ok) {
        const errorBody = await orderRes.text();
        throw new Error(`Eventbrite order creation failed: ${orderRes.status} — ${errorBody}`);
      }

      const orderData = await orderRes.json() as any;
      const orderId = orderData.id;

      // 3. Get card details for payment
      const cardDetails = await this.pos.getCardDetails(cardId);

      // 4. Complete payment
      const payRes = await fetch(`${baseUrl}/orders/${orderId}/payments/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          payment_method: 'credit_card',
          credit_card: {
            number: cardDetails.number,
            exp_month: String(cardDetails.expMonth).padStart(2, '0'),
            exp_year: String(cardDetails.expYear),
            cvv: cardDetails.cvc,
          },
        }),
      });

      if (!payRes.ok) {
        const errorBody = await payRes.text();
        throw new Error(`Eventbrite payment failed: ${payRes.status} — ${errorBody}`);
      }

      // Success — freeze card and mark complete
      const confirmationRef = `EB-${orderId}`;
      try { await this.pos.freezeCard(cardId); } catch { /* ok */ }

      await this.prisma.ticketAcquisition.update({
        where: { id: acquisitionId },
        data: { status: 'COMPLETED', confirmationRef },
      });

      // Create pool tickets from the acquisition
      await this.createPoolTicketsFromAcquisition(event.eventId, event.ticketsNeeded);

      console.log(`[PurchaseAgent] Eventbrite purchase success: ${confirmationRef} for event ${event.eventId}`);
      return { success: true, confirmationRef };
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[PurchaseAgent] Eventbrite purchase failed for acquisition ${acquisitionId}:`, msg);

      // Fall back to manual
      await this.flagForManualPurchase(acquisitionId, event as any, 'eventbrite', purchaseUrl);
      return { success: false, requiresManual: true, error: msg };
    }
  }

  /**
   * Extract Eventbrite event ID from URL.
   * Formats: eventbrite.com/e/event-name-123456789
   *          eventbrite.com/e/123456789
   */
  private extractEventbriteId(url: string): string | null {
    const match = url.match(/eventbrite\.com\/e\/(?:[^-]+-)*?(\d{9,})/);
    if (match) return match[1];

    // Try simpler pattern
    const simpleMatch = url.match(/eventbrite\.com\/e\/(\d+)/);
    return simpleMatch ? simpleMatch[1] : null;
  }

  /**
   * Flag an acquisition for manual purchase by admin.
   * Creates a notification with purchase instructions.
   */
  private async flagForManualPurchase(
    acquisitionId: string,
    event: { eventId: string; title?: string; ticketsNeeded?: number },
    platform: VenuePlatform,
    purchaseUrl?: string,
  ) {
    await this.prisma.ticketAcquisition.update({
      where: { id: acquisitionId },
      data: {
        status: 'CARD_CREATED',
        errorMessage: `Automated purchase not available for ${platform}. Manual purchase required.`,
      },
    });

    // Notify all admins
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    const eventDetail = await this.prisma.event.findUnique({
      where: { id: event.eventId },
      select: { title: true, venueName: true, date: true },
    });

    for (const admin of admins) {
      await this.prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'Manual Ticket Purchase Required',
          body: `Event "${eventDetail?.title ?? 'Unknown'}" at ${eventDetail?.venueName ?? 'Unknown'} ` +
            `needs ${event.ticketsNeeded ?? '?'} tickets purchased manually. ` +
            `Platform: ${platform}. ` +
            `Use GET /admin/issuing/acquisitions/${acquisitionId}/card for card details.` +
            (purchaseUrl ? ` Purchase URL: ${purchaseUrl}` : ''),
          metadata: {
            type: 'ticket_acquisition',
            acquisitionId,
            eventId: event.eventId,
            platform,
            purchaseUrl: purchaseUrl ?? null,
          },
        },
      });
    }

    console.log(
      `[PurchaseAgent] Flagged acquisition ${acquisitionId} for manual purchase ` +
      `(${platform}, event: ${event.eventId})`,
    );
  }

  /**
   * After successful acquisition, create pool tickets so they can be raffled.
   */
  private async createPoolTicketsFromAcquisition(eventId: string, ticketCount: number) {
    // Find a support ticket to link pool tickets to
    const supportTicket = await this.prisma.supportTicket.findFirst({
      where: { eventId, confirmed: true },
      select: { id: true },
    });

    if (!supportTicket) return;

    await this.prisma.poolTicket.createMany({
      data: Array.from({ length: ticketCount }, () => ({
        eventId,
        supportTicketId: supportTicket.id,
        status: 'AVAILABLE' as const,
      })),
    });

    console.log(`[PurchaseAgent] Created ${ticketCount} pool tickets for event ${eventId}`);
  }

  /**
   * Process a single event by ID (for manual trigger).
   */
  async acquireSingleEvent(eventId: string): Promise<PurchaseResult> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        supportTickets: { where: { confirmed: true } },
        ticketAcquisitions: true,
      },
    });

    if (!event) return { success: false, error: 'Event not found' };

    const totalFunded = event.supportTickets.reduce((s, t) => s + t.totalAmountCents, 0);
    const alreadyAcquired = event.ticketAcquisitions
      .filter((a) => a.status !== 'FAILED')
      .reduce((s, a) => s + a.ticketCount, 0);

    const ticketsFromFunds = Math.floor(totalFunded / event.ticketPriceCents);
    const ticketsNeeded = Math.max(0, ticketsFromFunds - alreadyAcquired);

    if (ticketsNeeded === 0) {
      return { success: true, confirmationRef: 'NO_TICKETS_NEEDED' };
    }

    return this.acquireTicketsForEvent({
      eventId: event.id,
      title: event.title,
      venueName: event.venueName,
      ticketPriceCents: event.ticketPriceCents,
      ticketsNeeded,
      totalCostCents: ticketsNeeded * event.ticketPriceCents,
    });
  }
}
