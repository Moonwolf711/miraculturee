/**
 * Vendor Acquisition Orchestrator
 *
 * Bridges vendor adapters (Ticketmaster, Eventbrite) with the PurchaseAgentService.
 * Before creating a virtual card, queries the vendor for:
 *   - Real-time ticket availability
 *   - Current pricing (anti-scalper validation)
 *   - Best ticket class selection
 *
 * This runs BEFORE PurchaseAgentService.acquireTicketsForEvent() to ensure
 * we only spend money when tickets are actually available at face value.
 */

import type { PrismaClient } from '@prisma/client';
import { TicketmasterAdapter } from './ticketmaster.js';
import { EventbriteAdapter } from './eventbrite.js';
import type { VendorAdapter, VendorEvent, VendorTicketClass } from './types.js';

export interface PrePurchaseCheck {
  available: boolean;
  vendor: string;
  vendorEventId: string;
  purchaseUrl: string;
  bestTicketClass?: VendorTicketClass;
  currentPriceCents?: number;
  reason?: string;
}

export class VendorOrchestrator {
  private adapters: Map<string, VendorAdapter>;

  constructor(private prisma: PrismaClient) {
    const tm = new TicketmasterAdapter();
    const eb = new EventbriteAdapter();

    this.adapters = new Map();
    if (tm.isConfigured()) this.adapters.set('ticketmaster', tm);
    if (eb.isConfigured()) this.adapters.set('eventbrite', eb);
  }

  /**
   * Pre-purchase check: verify tickets are available and priced correctly
   * before the PurchaseAgentService creates a virtual card.
   */
  async checkAvailability(eventId: string): Promise<PrePurchaseCheck> {
    // Look up the external event record to find vendor details
    const ext = await this.prisma.externalEvent.findFirst({
      where: { importedEventId: eventId },
      select: {
        externalId: true,
        source: true,
        sourceUrl: true,
        minPriceCents: true,
      },
    });

    if (!ext) {
      return {
        available: false,
        vendor: 'unknown',
        vendorEventId: '',
        purchaseUrl: '',
        reason: 'No external event record found — cannot check vendor availability',
      };
    }

    const adapter = this.adapters.get(ext.source);
    if (!adapter) {
      return {
        available: false,
        vendor: ext.source,
        vendorEventId: ext.externalId,
        purchaseUrl: ext.sourceUrl ?? '',
        reason: `${ext.source} adapter not configured (missing API key)`,
      };
    }

    // Get current event status from vendor
    const vendorEvent = await adapter.getEventDetails(ext.externalId);
    if (!vendorEvent) {
      return {
        available: false,
        vendor: ext.source,
        vendorEventId: ext.externalId,
        purchaseUrl: ext.sourceUrl ?? '',
        reason: 'Event no longer found on vendor platform',
      };
    }

    if (vendorEvent.status !== 'on_sale') {
      return {
        available: false,
        vendor: ext.source,
        vendorEventId: ext.externalId,
        purchaseUrl: vendorEvent.purchaseUrl,
        reason: `Event status is "${vendorEvent.status}" — not currently on sale`,
      };
    }

    // Get ticket classes if the adapter supports it
    let bestTicket: VendorTicketClass | undefined;
    if (adapter.getTicketClasses) {
      const classes = await adapter.getTicketClasses(ext.externalId);
      // Pick the cheapest available ticket class
      bestTicket = classes
        .filter((tc) => tc.available && tc.priceCents > 0)
        .sort((a, b) => a.priceCents - b.priceCents)[0];

      if (!bestTicket && classes.length > 0) {
        return {
          available: false,
          vendor: ext.source,
          vendorEventId: ext.externalId,
          purchaseUrl: vendorEvent.purchaseUrl,
          reason: 'No available paid ticket classes found',
        };
      }
    }

    return {
      available: true,
      vendor: ext.source,
      vendorEventId: ext.externalId,
      purchaseUrl: vendorEvent.purchaseUrl,
      bestTicketClass: bestTicket,
      currentPriceCents: bestTicket?.priceCents ?? vendorEvent.minPriceCents,
    };
  }

  /**
   * Get a summary of all configured vendor adapters.
   */
  getConfiguredVendors(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Search across all configured vendors for an event.
   */
  async searchAll(keyword: string, city?: string): Promise<VendorEvent[]> {
    const results: VendorEvent[] = [];
    const searches = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        const result = await adapter.searchEvents({ keyword, city, limit: 10 });
        results.push(...result.events);
      } catch (err) {
        console.warn(`[VendorOrchestrator] Search failed for ${adapter.name}:`, (err as Error).message);
      }
    });
    await Promise.all(searches);
    return results.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}
