import type { PrismaClient } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';
import { BrowserPurchaseService } from './browser-purchase.service.js';

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

type VenuePlatform = 'ticketmaster' | 'eventbrite' | 'axs' | 'dice' | 'ra' | 'unknown';

/**
 * RESELLER / SECONDARY MARKET BLOCKLIST
 *
 * MiraCulture ONLY purchases from primary vendors — the venue or promoter's
 * own ticketing partner. We NEVER buy from resellers, secondary markets,
 * or scalper platforms. This is a hard blocklist; any URL matching these
 * domains is immediately rejected.
 */
const RESELLER_DOMAINS = [
  'stubhub.com',
  'vividseats.com',
  'seatgeek.com',
  'ticketnetwork.com',
  'viagogo.com',
  'gametime.co',
  'tickpick.com',
  'razorgator.com',
  'fanxchange.com',
  'ticketcity.com',
  'cheaptickets.com',
  'gotickets.com',
  'ticketliquidator.com',
  'ticketmaster.com/resale',
  'livenation.com/resale',
  'Barry\'stickets.com',
  'premiumseating.com',
  'scorebig.com',
  'rukkus.com',
  'ticketsales.com',
  'theticketbroker.com',
];

/**
 * ALLOWED PRIMARY VENDOR DOMAINS
 *
 * These are legitimate primary-market ticketing platforms used by venues
 * and promoters to sell tickets at face value. Only these domains (plus
 * direct venue websites) are allowed for automated purchase.
 */
const PRIMARY_VENDOR_DOMAINS = [
  'eventbrite.com',
  'axs.com',
  'dice.fm',
  'ra.co',
  'residentadvisor.net',
  'seetickets.us',
  'seetickets.com',
  'ticketmaster.com',  // Primary sales only (resale paths blocked above)
  'livenation.com',    // Primary sales only
  'etix.com',
  'ticketfly.com',
  'showclix.com',
  'tixr.com',
  'shotgun.live',
  'skiddle.com',
  'billetto.com',
  'tickettailor.com',
  'universe.com',
  'edmtrain.com',      // EDMTrain links redirect to primary vendors
];

/**
 * Maximum allowed price overage percentage above face value.
 * e.g. 0.15 = 15% above face value max (accounts for service fees).
 * Anything above this is considered scalper pricing and is rejected.
 */
const MAX_PRICE_OVERAGE_PERCENT = 0.15;

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

    console.info(
      `[PurchaseAgent] Cycle complete: ${processed} processed, ${succeeded} succeeded, ` +
      `${flaggedForAdmin} flagged for admin, ${failed} failed`,
    );

    return { processed, succeeded, failed, flaggedForAdmin };
  }

  /**
   * Find events with CONFIRMED + STRIPE-VERIFIED support funds that still
   * need real tickets purchased.
   *
   * Only counts funds from support tickets where:
   *   1. confirmed = true (set by webhook handler)
   *   2. A matching Transaction exists with status = 'completed'
   *      AND a non-null stripePaymentId (proves Stripe actually charged)
   *
   * This prevents purchasing venue tickets before fan payments have
   * fully settled through Stripe.
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
      // Only count funds from support tickets that have a completed Stripe payment
      let verifiedFundsCents = 0;

      for (const st of event.supportTickets) {
        const tx = await this.prisma.transaction.findFirst({
          where: {
            posReference: st.id,
            type: 'SUPPORT_PURCHASE',
            status: 'completed',
            stripePaymentId: { not: null },
          },
          select: { stripePaymentId: true },
        });

        if (tx?.stripePaymentId) {
          verifiedFundsCents += st.totalAmountCents;
        } else {
          console.warn(
            `[PurchaseAgent] Skipping support ticket ${st.id} — no completed Stripe payment found`,
          );
        }
      }

      if (verifiedFundsCents === 0) continue;

      const alreadyAcquired = event.ticketAcquisitions
        .filter((a) => a.status !== 'FAILED')
        .reduce((s, a) => s + a.ticketCount, 0);

      const ticketsFromFunds = Math.floor(verifiedFundsCents / event.ticketPriceCents);
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

    // ── ANTI-SCALPER GATE: Validate URL before spending any money ──
    if (purchaseUrl) {
      const urlCheck = this.validatePurchaseUrl(purchaseUrl);
      if (!urlCheck.valid) {
        console.error(`[PurchaseAgent] ${urlCheck.reason}`);
        // Create a failed acquisition record so admins can see what was blocked
        await this.prisma.ticketAcquisition.create({
          data: {
            eventId: event.eventId,
            ticketCount: event.ticketsNeeded,
            totalAmountCents: event.totalCostCents,
            purchaseUrl,
            status: 'FAILED',
            errorMessage: urlCheck.reason,
          },
        });
        return { success: false, error: urlCheck.reason };
      }
    }

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

    // 3. Create virtual card with spending limit = face value + max allowed fees
    //    This is a HARD CAP enforced by Stripe — even if the bot somehow tried
    //    to pay more, the card would decline. This is our final anti-scalper safety net.
    const maxSpendCents = Math.ceil(event.totalCostCents * (1 + MAX_PRICE_OVERAGE_PERCENT));
    let cardId: string;
    let cardLast4: string;
    try {
      const card = await this.pos.createVirtualCard(this.cardholderId, maxSpendCents);
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

    if (platform === 'ticketmaster' && purchaseUrl) {
      // Ticketmaster has no public purchase API — go straight to browser automation
      console.info(`[PurchaseAgent] Ticketmaster detected — using browser automation for ${event.eventId}`);
      await this.prisma.ticketAcquisition.update({
        where: { id: acquisition.id },
        data: { status: 'PURCHASING' },
      });
    } else if (platform === 'eventbrite' && purchaseUrl) {
      // Attempt Eventbrite API purchase first
      await this.prisma.ticketAcquisition.update({
        where: { id: acquisition.id },
        data: { status: 'PURCHASING' },
      });

      const result = await this.purchaseViaEventbrite(acquisition.id, purchaseUrl, event, cardId);
      if (result.success || !result.requiresManual) return result;

      // Eventbrite API failed — try browser automation
      console.info(`[PurchaseAgent] Eventbrite API failed, trying browser automation for ${event.eventId}`);
    }

    // 5. Try browser-based automation for any platform with a purchase URL
    if (purchaseUrl) {
      try {
        const browserService = new BrowserPurchaseService(this.prisma, this.pos);
        const browserResult = await browserService.purchaseTickets({
          acquisitionId: acquisition.id,
          purchaseUrl,
          ticketCount: event.ticketsNeeded,
          cardId,
          eventTitle: event.title,
        });

        if (browserResult.success) {
          console.info(`[PurchaseAgent] Browser purchase success for ${event.eventId}: ${browserResult.confirmationRef}`);
          return { success: true, confirmationRef: browserResult.confirmationRef };
        }

        if (!browserResult.requiresManual) {
          return { success: false, error: browserResult.error };
        }

        // Browser automation failed too — fall through to manual
        console.info(`[PurchaseAgent] Browser automation failed for ${event.eventId}: ${browserResult.error}`);
      } catch (err) {
        console.warn(`[PurchaseAgent] Browser service error: ${(err as Error).message}`);
      }
    }

    // 6. All automation failed — flag for manual purchase by admin
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

    if (lower.includes('ticketmaster.com') || lower.includes('livenation.com')) return 'ticketmaster';
    if (lower.includes('eventbrite.com')) return 'eventbrite';
    if (lower.includes('axs.com')) return 'axs';
    if (lower.includes('dice.fm')) return 'dice';
    if (lower.includes('ra.co') || lower.includes('residentadvisor.net')) return 'ra';

    return 'unknown';
  }

  /**
   * ANTI-SCALPER: Check if a URL is a known reseller/secondary market.
   * Returns the reseller domain if blocked, or null if safe.
   */
  private isResellerUrl(url: string): string | null {
    const lower = url.toLowerCase();
    for (const domain of RESELLER_DOMAINS) {
      if (lower.includes(domain.toLowerCase())) {
        return domain;
      }
    }
    return null;
  }

  /**
   * ANTI-SCALPER: Validate that the purchase URL points to a known
   * primary vendor or direct venue site. Rejects all resellers.
   */
  private validatePurchaseUrl(url: string): { valid: boolean; reason?: string } {
    // 1. Block known resellers — hard reject
    const reseller = this.isResellerUrl(url);
    if (reseller) {
      return {
        valid: false,
        reason: `BLOCKED: "${reseller}" is a reseller/secondary market. MiraCulture only buys from primary vendors at face value.`,
      };
    }

    // 2. Check if it's a known primary vendor (informational — we still allow
    //    direct venue websites even if not on the primary list)
    const lower = url.toLowerCase();
    const isPrimaryVendor = PRIMARY_VENDOR_DOMAINS.some((d) => lower.includes(d));
    if (!isPrimaryVendor) {
      // Log a warning but don't block — could be a direct venue website
      console.warn(
        `[PurchaseAgent] URL is not a recognized primary vendor: ${url}. ` +
        `Proceeding with caution — verify this is a legitimate venue/promoter site.`,
      );
    }

    return { valid: true };
  }

  /**
   * ANTI-SCALPER: Validate that the ticket price at the vendor doesn't
   * exceed our expected face value by more than MAX_PRICE_OVERAGE_PERCENT.
   * This catches scalper markup even if the domain wasn't blocklisted.
   *
   * @param vendorPriceCents - The price found on the vendor's checkout page
   * @param expectedPriceCents - Our stored face value (ticketPriceCents)
   * @returns true if price is acceptable, false if it looks like scalper pricing
   */
  private validateTicketPrice(
    vendorPriceCents: number,
    expectedPriceCents: number,
  ): { valid: boolean; reason?: string } {
    if (expectedPriceCents <= 0) return { valid: true };

    const maxAllowed = Math.ceil(expectedPriceCents * (1 + MAX_PRICE_OVERAGE_PERCENT));

    if (vendorPriceCents > maxAllowed) {
      return {
        valid: false,
        reason:
          `PRICE BLOCKED: Vendor price $${(vendorPriceCents / 100).toFixed(2)} exceeds ` +
          `face value $${(expectedPriceCents / 100).toFixed(2)} by more than ` +
          `${Math.round(MAX_PRICE_OVERAGE_PERCENT * 100)}%. ` +
          `This looks like scalper/reseller pricing. Purchase rejected.`,
      };
    }

    return { valid: true };
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
      await this.flagForManualPurchase(acquisitionId, event, 'eventbrite', purchaseUrl);
      return { success: false, requiresManual: true };
    }

    try {
      // Extract Eventbrite event ID from URL
      const ebEventId = this.extractEventbriteId(purchaseUrl);
      if (!ebEventId) {
        await this.flagForManualPurchase(acquisitionId, event, 'eventbrite', purchaseUrl);
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

      // ── ANTI-SCALPER: Validate ticket price against our face value ──
      // Eventbrite returns cost in { major_value, currency } or { value (cents) }
      const ebPriceCents = ticketClass.cost?.value
        ? Number(ticketClass.cost.value)
        : ticketClass.cost?.major_value
          ? Math.round(Number(ticketClass.cost.major_value) * 100)
          : 0;

      if (ebPriceCents > 0) {
        const priceCheck = this.validateTicketPrice(ebPriceCents, event.ticketPriceCents);
        if (!priceCheck.valid) {
          const msg = priceCheck.reason!;
          console.error(`[PurchaseAgent] Eventbrite ${msg}`);
          await this.prisma.ticketAcquisition.update({
            where: { id: acquisitionId },
            data: { status: 'FAILED', errorMessage: msg },
          });
          // Freeze the card since we won't use it
          try { await this.pos.freezeCard(cardId); } catch (err) { console.warn(`[PurchaseAgent] Card freeze failed: ${(err as Error).message}`); }
          return { success: false, error: msg };
        }
        console.info(
          `[PurchaseAgent] Eventbrite price check passed: vendor $${(ebPriceCents / 100).toFixed(2)} ` +
          `vs face value $${(event.ticketPriceCents / 100).toFixed(2)}`,
        );
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
      try { await this.pos.freezeCard(cardId); } catch (err) { console.warn(`[PurchaseAgent] Card freeze failed: ${(err as Error).message}`); }

      await this.prisma.ticketAcquisition.update({
        where: { id: acquisitionId },
        data: { status: 'COMPLETED', confirmationRef },
      });

      // Create pool tickets from the acquisition
      await this.createPoolTicketsFromAcquisition(event.eventId, event.ticketsNeeded);

      console.info(`[PurchaseAgent] Eventbrite purchase success: ${confirmationRef} for event ${event.eventId}`);
      return { success: true, confirmationRef };
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[PurchaseAgent] Eventbrite purchase failed for acquisition ${acquisitionId}:`, msg);

      // Fall back to manual
      await this.flagForManualPurchase(acquisitionId, event, 'eventbrite', purchaseUrl);
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

    console.info(
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

    console.info(`[PurchaseAgent] Created ${ticketCount} pool tickets for event ${eventId}`);
  }

  /**
   * Process a single event by ID (for manual trigger).
   * Only counts funds with a verified Stripe payment (completed transaction).
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

    // Only count funds backed by a completed Stripe payment
    let verifiedFundsCents = 0;
    for (const st of event.supportTickets) {
      const tx = await this.prisma.transaction.findFirst({
        where: {
          posReference: st.id,
          type: 'SUPPORT_PURCHASE',
          status: 'completed',
          stripePaymentId: { not: null },
        },
        select: { stripePaymentId: true },
      });

      if (tx?.stripePaymentId) {
        verifiedFundsCents += st.totalAmountCents;
      }
    }

    if (verifiedFundsCents === 0) {
      return { success: false, error: 'No verified Stripe payments found for this event' };
    }

    const alreadyAcquired = event.ticketAcquisitions
      .filter((a) => a.status !== 'FAILED')
      .reduce((s, a) => s + a.ticketCount, 0);

    const ticketsFromFunds = Math.floor(verifiedFundsCents / event.ticketPriceCents);
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
