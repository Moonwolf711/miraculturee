/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import type { PrismaClient } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';

/**
 * Browser-based ticket purchasing using Puppeteer.
 *
 * Automates purchasing real venue tickets by:
 *   1. Navigating to the venue's ticket purchase URL (EDMTrain sourceUrl)
 *   2. Detecting the ticketing platform
 *   3. Selecting tickets and filling checkout with Stripe Issuing virtual card
 *   4. Capturing the confirmation reference
 *
 * Supported platforms: Eventbrite, AXS, DICE, RA, generic
 * Fallback: flags for manual admin purchase with card details + URL
 */

export interface BrowserPurchaseResult {
  success: boolean;
  confirmationRef?: string;
  error?: string;
  screenshots?: string[];
  requiresManual?: boolean;
  platform?: string;
}

interface CardInfo {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

type Platform = 'eventbrite' | 'axs' | 'dice' | 'ra' | 'seetickets' | 'generic';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reseller domains — hard block. Never purchase from these.
 */
const RESELLER_BLOCKLIST = [
  'stubhub.com', 'vividseats.com', 'seatgeek.com', 'ticketnetwork.com',
  'viagogo.com', 'gametime.co', 'tickpick.com', 'razorgator.com',
  'fanxchange.com', 'ticketcity.com', 'cheaptickets.com', 'gotickets.com',
  'ticketliquidator.com', 'premiumseating.com', 'rukkus.com',
  'ticketsales.com', 'theticketbroker.com',
];

function isResellerUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return RESELLER_BLOCKLIST.some((d) => lower.includes(d));
}

export class BrowserPurchaseService {
  constructor(
    private prisma: PrismaClient,
    private pos: POSClient,
  ) {}

  /**
   * Run an automated browser purchase for an acquisition.
   */
  async purchaseTickets(params: {
    acquisitionId: string;
    purchaseUrl: string;
    ticketCount: number;
    cardId: string;
    eventTitle: string;
  }): Promise<BrowserPurchaseResult> {
    let puppeteer: typeof import('puppeteer');
    try {
      puppeteer = await import('puppeteer');
    } catch {
      return {
        success: false,
        error: 'Puppeteer not installed. Run: pnpm add puppeteer',
        requiresManual: true,
      };
    }

    // ── ANTI-SCALPER: Block reseller URLs before even launching browser ──
    if (isResellerUrl(params.purchaseUrl)) {
      return {
        success: false,
        error: `BLOCKED: URL is a reseller/secondary market. MiraCulture only buys at face value from primary vendors.`,
        requiresManual: false,
      };
    }

    const platform = this.detectPlatform(params.purchaseUrl);
    const card = await this.pos.getCardDetails(params.cardId);

    await this.prisma.ticketAcquisition.update({
      where: { id: params.acquisitionId },
      data: { status: 'PURCHASING' },
    });

    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const screenshots: string[] = [];

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      // Navigate to purchase URL
      await page.goto(params.purchaseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Screenshot landing page
      const ssPath = `/tmp/acquisitions-${params.acquisitionId}-landing.png`;
      await page.screenshot({ path: ssPath, fullPage: true }).catch(() => {});
      screenshots.push(ssPath);

      let result: BrowserPurchaseResult;

      switch (platform) {
        case 'eventbrite':
          result = await this.purchaseEventbrite(page, params, card);
          break;
        case 'axs':
          result = await this.purchaseAXS(page, params, card);
          break;
        case 'dice':
          result = await this.purchaseDICE(page, params, card);
          break;
        default:
          result = await this.purchaseGeneric(page, params, card);
          break;
      }

      result.platform = platform;
      result.screenshots = screenshots;

      // Final screenshot
      await page.screenshot({
        path: `/tmp/acquisitions-${params.acquisitionId}-final.png`,
        fullPage: true,
      }).catch(() => {});

      // Update acquisition
      if (result.success && result.confirmationRef) {
        try { await this.pos.freezeCard(params.cardId); } catch { /* ok */ }
        await this.prisma.ticketAcquisition.update({
          where: { id: params.acquisitionId },
          data: { status: 'COMPLETED', confirmationRef: result.confirmationRef },
        });
        await this.createPoolTickets(params.acquisitionId);
      } else if (result.requiresManual) {
        await this.prisma.ticketAcquisition.update({
          where: { id: params.acquisitionId },
          data: {
            status: 'CARD_CREATED',
            errorMessage: `Browser automation failed (${platform}): ${result.error}. Manual purchase required.`,
          },
        });
      } else {
        await this.prisma.ticketAcquisition.update({
          where: { id: params.acquisitionId },
          data: { status: 'FAILED', errorMessage: result.error },
        });
      }

      return result;
    } catch (err) {
      const msg = (err as Error).message;

      await this.prisma.ticketAcquisition.update({
        where: { id: params.acquisitionId },
        data: {
          status: 'CARD_CREATED',
          errorMessage: `Browser error: ${msg}. Flagged for manual purchase.`,
        },
      });

      return { success: false, error: msg, requiresManual: true, platform };
    } finally {
      await browser.close();
    }
  }

  /* ─────────── Platform-Specific Handlers ─────────── */

  private async purchaseEventbrite(
    page: any,
    params: { ticketCount: number; eventTitle: string },
    card: CardInfo,
  ): Promise<BrowserPurchaseResult> {
    try {
      await delay(2000);

      // Select ticket quantity
      const qtySelected = await page.evaluate((count: number) => {
        // Try select dropdown
        const sel = document.querySelector<HTMLSelectElement>(
          'select[name*="quantity"], .ticket-row select, [data-testid="ticket-quantity-selector"] select',
        );
        if (sel) {
          sel.value = String(count);
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        // Try increment button
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-testid="increase-quantity"], button[aria-label*="increase"], .quantity-increase',
        );
        if (btn) {
          for (let i = 0; i < count; i++) btn.click();
          return true;
        }
        return false;
      }, params.ticketCount);

      if (qtySelected) await delay(1000);

      // Click checkout/register
      const clicked = await this.clickByText(page, [
        'Register', 'Checkout', 'Get Tickets', 'Buy Tickets',
      ]);
      if (!clicked) {
        return { success: false, error: 'Could not find checkout button on Eventbrite', requiresManual: true };
      }
      await delay(3000);

      // Fill payment
      const filled = await this.fillStripeIframe(page, card) || await this.fillCardInputs(page, card);
      if (!filled) {
        return { success: false, error: 'Could not fill Eventbrite payment form', requiresManual: true };
      }

      // Submit order
      const submitted = await this.clickByText(page, [
        'Place Order', 'Pay Now', 'Complete Registration', 'Complete Order',
      ]);
      if (!submitted) {
        return { success: false, error: 'Could not find submit button', requiresManual: true };
      }

      await delay(10000);
      const ref = await this.extractConfirmation(page);
      if (ref) return { success: true, confirmationRef: ref };

      const error = await this.getErrorText(page);
      return { success: false, error: error || 'Could not confirm Eventbrite order', requiresManual: true };
    } catch (err) {
      return { success: false, error: (err as Error).message, requiresManual: true };
    }
  }

  private async purchaseAXS(
    page: any,
    params: { ticketCount: number; eventTitle: string },
    card: CardInfo,
  ): Promise<BrowserPurchaseResult> {
    try {
      await delay(2000);

      await this.clickByText(page, ['Buy Tickets', 'Get Tickets', 'Find Tickets']);
      await delay(3000);

      // Quantity
      await page.evaluate((count: number) => {
        const sel = document.querySelector<HTMLSelectElement>(
          'select[name*="qty"], select[id*="quantity"], .quantity-selector select',
        );
        if (sel) {
          sel.value = String(count);
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, params.ticketCount);
      await delay(1000);

      await this.clickByText(page, ['Continue', 'Proceed', 'Add to Cart', 'Next']);
      await delay(3000);

      const filled = await this.fillCardInputs(page, card) || await this.fillStripeIframe(page, card);
      if (!filled) {
        return { success: false, error: 'Could not fill AXS payment form', requiresManual: true };
      }

      await this.clickByText(page, ['Complete Purchase', 'Place Order', 'Pay', 'Submit']);
      await delay(10000);

      const ref = await this.extractConfirmation(page);
      return ref
        ? { success: true, confirmationRef: ref }
        : { success: false, error: 'Could not confirm AXS order', requiresManual: true };
    } catch (err) {
      return { success: false, error: (err as Error).message, requiresManual: true };
    }
  }

  private async purchaseDICE(
    page: any,
    params: { ticketCount: number; eventTitle: string },
    card: CardInfo,
  ): Promise<BrowserPurchaseResult> {
    try {
      await delay(2000);

      await this.clickByText(page, ['Get Tickets', 'Book Now', 'Buy']);
      await delay(3000);

      // DICE uses +/- for quantity
      for (let i = 0; i < params.ticketCount; i++) {
        await page.evaluate(() => {
          const btn = document.querySelector<HTMLButtonElement>(
            'button[aria-label*="increase"], button[aria-label*="add"]',
          );
          btn?.click();
        });
        await delay(500);
      }

      await this.clickByText(page, ['Checkout', 'Continue', 'Next']);
      await delay(3000);

      const filled = await this.fillStripeIframe(page, card) || await this.fillCardInputs(page, card);
      if (!filled) {
        return { success: false, error: 'Could not fill DICE payment form', requiresManual: true };
      }

      await this.clickByText(page, ['Pay', 'Complete', 'Confirm', 'Place Order']);
      await delay(10000);

      const ref = await this.extractConfirmation(page);
      return ref
        ? { success: true, confirmationRef: ref }
        : { success: false, error: 'Could not confirm DICE order', requiresManual: true };
    } catch (err) {
      return { success: false, error: (err as Error).message, requiresManual: true };
    }
  }

  private async purchaseGeneric(
    page: any,
    params: { ticketCount: number; eventTitle: string },
    card: CardInfo,
  ): Promise<BrowserPurchaseResult> {
    try {
      await delay(2000);

      // Try to find a "Buy Tickets" link that goes to an external ticket site
      const externalUrl = await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (let i = 0; i < links.length; i++) {
          const a = links[i] as HTMLAnchorElement;
          const text = (a.textContent || '').toLowerCase();
          if (
            (text.includes('buy tickets') || text.includes('get tickets') || text.includes('purchase')) &&
            a.href && a.href.startsWith('http')
          ) {
            return a.href;
          }
        }
        return null;
      });

      if (externalUrl) {
        // ── ANTI-SCALPER: Check the external URL before navigating ──
        if (isResellerUrl(externalUrl)) {
          return {
            success: false,
            error: `BLOCKED: External link points to reseller "${externalUrl}". MiraCulture only buys at face value from primary vendors.`,
            requiresManual: false,
          };
        }

        await page.goto(externalUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2000);

        // Also check final URL after redirects
        const finalUrl = page.url();
        if (isResellerUrl(finalUrl)) {
          return {
            success: false,
            error: `BLOCKED: Redirected to reseller "${finalUrl}". MiraCulture only buys at face value.`,
            requiresManual: false,
          };
        }

        // Re-detect platform
        const newPlatform = this.detectPlatform(finalUrl);
        if (newPlatform !== 'generic') {
          switch (newPlatform) {
            case 'eventbrite': return this.purchaseEventbrite(page, params, card);
            case 'axs': return this.purchaseAXS(page, params, card);
            case 'dice': return this.purchaseDICE(page, params, card);
          }
        }
      } else {
        await this.clickByText(page, ['Buy Tickets', 'Get Tickets', 'Purchase', 'Buy Now']);
        await delay(3000);
      }

      const filled = await this.fillCardInputs(page, card) || await this.fillStripeIframe(page, card);
      if (!filled) {
        return {
          success: false,
          error: 'Unknown platform — could not find payment form.',
          requiresManual: true,
        };
      }

      await this.clickByText(page, ['Pay', 'Complete', 'Place Order', 'Submit']);
      await delay(10000);

      const ref = await this.extractConfirmation(page);
      return ref
        ? { success: true, confirmationRef: ref }
        : { success: false, error: 'Could not confirm order on unknown platform', requiresManual: true };
    } catch (err) {
      return { success: false, error: (err as Error).message, requiresManual: true };
    }
  }

  /* ─────────── Shared Helpers ─────────── */

  /**
   * Click the first button/link whose visible text matches one of the candidates.
   */
  private async clickByText(page: any, textCandidates: string[]): Promise<boolean> {
    return page.evaluate((candidates: string[]) => {
      const clickables = document.querySelectorAll('button, a, [role="button"]');
      for (const text of candidates) {
        const lower = text.toLowerCase();
        for (let i = 0; i < clickables.length; i++) {
          const el = clickables[i] as HTMLElement;
          const t = (el.textContent || '').trim().toLowerCase();
          if (t === lower || t.includes(lower)) {
            el.click();
            return true;
          }
        }
      }
      return false;
    }, textCandidates);
  }

  /**
   * Fill Stripe Elements inside an iframe.
   * Stripe injects `__privateStripeFrame*` iframes for card fields.
   */
  private async fillStripeIframe(page: any, card: CardInfo): Promise<boolean> {
    try {
      // Find Stripe iframe(s)
      const frames = page.frames();
      const stripeFrames = frames.filter((f: any) => {
        const name = f.name() || '';
        const url = f.url() || '';
        return name.includes('__privateStripeFrame') || url.includes('js.stripe.com');
      });

      if (stripeFrames.length === 0) return false;

      for (const frame of stripeFrames) {
        // Card number
        const cardInput = await frame.$('input[name="cardnumber"], input[autocomplete="cc-number"], input[placeholder*="Card number"]');
        if (cardInput) {
          await cardInput.click({ clickCount: 3 });
          await cardInput.type(card.number, { delay: 50 });
          await delay(300);

          // Expiry
          const expInput = await frame.$('input[name="exp-date"], input[autocomplete="cc-exp"], input[placeholder*="MM"]');
          if (expInput) {
            await expInput.click({ clickCount: 3 });
            await expInput.type(
              `${String(card.expMonth).padStart(2, '0')}${String(card.expYear).slice(-2)}`,
              { delay: 50 },
            );
          }

          // CVC
          const cvcInput = await frame.$('input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC"]');
          if (cvcInput) {
            await cvcInput.click({ clickCount: 3 });
            await cvcInput.type(card.cvc, { delay: 50 });
          }

          return true;
        }

        // Unified number field (PaymentElement)
        const numInput = await frame.$('input[name="number"]');
        if (numInput) {
          await numInput.click({ clickCount: 3 });
          await numInput.type(card.number, { delay: 50 });
          await delay(200);

          const expiry = await frame.$('input[name="expiry"]');
          if (expiry) {
            await expiry.click({ clickCount: 3 });
            await expiry.type(
              `${String(card.expMonth).padStart(2, '0')}${String(card.expYear).slice(-2)}`,
              { delay: 50 },
            );
          }

          const cvc = await frame.$('input[name="cvc"]');
          if (cvc) {
            await cvc.click({ clickCount: 3 });
            await cvc.type(card.cvc, { delay: 50 });
          }

          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Fill standard (non-Stripe-iframe) card input fields.
   */
  private async fillCardInputs(page: any, card: CardInfo): Promise<boolean> {
    try {
      const filled = await page.evaluate(
        (c: { number: string; expMonth: number; expYear: number; cvc: string }) => {
          // Card number
          const cardSels = [
            'input[name*="card_number"]', 'input[name*="cardNumber"]', 'input[name*="cc-number"]',
            'input[autocomplete="cc-number"]', 'input[placeholder*="Card number"]',
            'input[id*="card-number"]', 'input[id*="cardNumber"]',
          ];
          let cardEl: HTMLInputElement | null = null;
          for (const s of cardSels) {
            cardEl = document.querySelector<HTMLInputElement>(s);
            if (cardEl) break;
          }
          if (!cardEl) return false;

          // Helper to set input value and dispatch events
          const setVal = (el: HTMLInputElement, val: string) => {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 'value',
            )?.set;
            nativeInputValueSetter?.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };

          setVal(cardEl, c.number);

          // Expiry month
          const monthSels = [
            'input[name*="exp_month"]', 'input[name*="expMonth"]',
            'select[name*="exp_month"]', 'select[name*="expMonth"]',
          ];
          for (const s of monthSels) {
            const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(s);
            if (el) {
              if (el.tagName === 'SELECT') {
                (el as HTMLSelectElement).value = String(c.expMonth);
                el.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                setVal(el as HTMLInputElement, String(c.expMonth).padStart(2, '0'));
              }
              break;
            }
          }

          // Expiry year
          const yearSels = [
            'input[name*="exp_year"]', 'input[name*="expYear"]',
            'select[name*="exp_year"]', 'select[name*="expYear"]',
          ];
          for (const s of yearSels) {
            const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(s);
            if (el) {
              if (el.tagName === 'SELECT') {
                (el as HTMLSelectElement).value = String(c.expYear);
                el.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                setVal(el as HTMLInputElement, String(c.expYear).slice(-2));
              }
              break;
            }
          }

          // Combined expiry (MM/YY)
          const combinedSels = [
            'input[name*="expiry"]', 'input[autocomplete="cc-exp"]', 'input[placeholder*="MM/YY"]',
          ];
          for (const s of combinedSels) {
            const el = document.querySelector<HTMLInputElement>(s);
            if (el) {
              setVal(el, `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)}`);
              break;
            }
          }

          // CVC
          const cvcSels = [
            'input[name*="cvc"]', 'input[name*="cvv"]', 'input[name*="security_code"]',
            'input[autocomplete="cc-csc"]', 'input[placeholder*="CVC"]', 'input[placeholder*="CVV"]',
          ];
          for (const s of cvcSels) {
            const el = document.querySelector<HTMLInputElement>(s);
            if (el) {
              setVal(el, c.cvc);
              break;
            }
          }

          return true;
        },
        { number: card.number, expMonth: card.expMonth, expYear: card.expYear, cvc: card.cvc },
      );

      return filled;
    } catch {
      return false;
    }
  }

  /**
   * Extract a confirmation/order reference from the page.
   */
  private async extractConfirmation(page: any): Promise<string | null> {
    try {
      const ref = await page.evaluate(() => {
        const selectors = [
          '[data-testid="order-number"]', '[data-testid="confirmation-number"]',
          '.order-number', '.confirmation-number', '.order-reference',
          '[data-testid="order-confirmation"]', '.order-confirmation__order-number',
          '.confirmation-code', '.order-id', '.success-message',
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent) {
            const match = el.textContent.match(/(?:order|confirmation|reference|#)\s*[:# ]*\s*([A-Z0-9-]+)/i);
            if (match) return match[1];
            return `WEB-${el.textContent.trim().slice(0, 50).replace(/\s+/g, '-')}`;
          }
        }

        // Check headings for confirmation
        const headings = document.querySelectorAll('h1, h2, h3');
        for (const h of headings) {
          const text = h.textContent?.toLowerCase() || '';
          if (text.includes('confirm') || text.includes('thank') || text.includes('success')) {
            return `WEB-CONFIRMED-${Date.now()}`;
          }
        }

        return null;
      });

      if (ref) return ref;

      // Check URL for order ID
      const url = page.url();
      const urlMatch = url.match(/(?:order|confirmation|receipt)[/=]([A-Za-z0-9-]+)/);
      if (urlMatch) return urlMatch[1];

      // Check page title
      const title = await page.title();
      if (title.toLowerCase().includes('confirm') || title.toLowerCase().includes('thank')) {
        return `WEB-CONFIRMED-${Date.now()}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get any visible error text from the page.
   */
  private async getErrorText(page: any): Promise<string | null> {
    return page.evaluate(() => {
      const errorSels = ['.error-message', '[data-testid="error"]', '.payment-error', '.alert-danger', '[role="alert"]'];
      for (const sel of errorSels) {
        const el = document.querySelector(sel);
        if (el?.textContent) return el.textContent.trim();
      }
      return null;
    }).catch(() => null);
  }

  /**
   * Create pool tickets after successful acquisition.
   */
  private async createPoolTickets(acquisitionId: string) {
    const acquisition = await this.prisma.ticketAcquisition.findUnique({
      where: { id: acquisitionId },
    });
    if (!acquisition) return;

    const supportTicket = await this.prisma.supportTicket.findFirst({
      where: { eventId: acquisition.eventId, confirmed: true },
      select: { id: true },
    });
    if (!supportTicket) return;

    await this.prisma.poolTicket.createMany({
      data: Array.from({ length: acquisition.ticketCount }, () => ({
        eventId: acquisition.eventId,
        supportTicketId: supportTicket.id,
        status: 'AVAILABLE' as const,
      })),
    });
  }

  private detectPlatform(url: string): Platform {
    const lower = url.toLowerCase();
    if (lower.includes('eventbrite.com')) return 'eventbrite';
    if (lower.includes('axs.com')) return 'axs';
    if (lower.includes('dice.fm')) return 'dice';
    if (lower.includes('ra.co') || lower.includes('residentadvisor')) return 'ra';
    if (lower.includes('seetickets.us') || lower.includes('seetickets.com')) return 'seetickets';
    return 'generic';
  }
}
