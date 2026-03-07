/**
 * Admin AI dev-chat route — Base44-style AI assistant with tool calling.
 * Streams Claude responses via SSE. The AI can query the MiraCulture database
 * to answer questions about users, events, campaigns, revenue, etc.
 */

import type { FastifyInstance } from 'fastify';

const SYSTEM_PROMPT = `You are MiraCulture's AI development assistant, embedded in the admin panel.
You help admins and developers build, debug, and improve the MiraCulture platform.

## Platform Overview
MiraCulture is a fan-powered ticket redistribution platform. "WHERE FANS POWER THE SHOW."
- Fans donate to campaigns supporting artists
- Campaign goal = 10 x ticket price → 10 discounted local-fan tickets unlock
- Surplus donations → buy more tickets or become artist bonus
- Cryptographically fair raffles (SHA-256 + Fisher-Yates)
- Geolocation-verified ticket purchases (100km radius)

## Tech Stack
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Fastify + Prisma + PostgreSQL
- Payments: Stripe (tickets, support, raffles)
- Auth: JWT + TOTP 2FA + WebAuthn passkeys + Social OAuth (Google, Facebook, Apple, Microsoft)
- Email: Resend
- Hosting: Railway (auto-deploy from master)
- Design: Concert Poster Noir (bg-noir-950, amber-500 accents)

## Key Models
User (FAN/LOCAL_FAN/ARTIST/ADMIN/DEVELOPER), Artist, Event, Campaign, SupportTicket,
PoolTicket, RafflePool, RaffleEntry, DirectTicket, Transaction, DeveloperInvite,
Passkey, SocialLogin, ConnectedAccount, DonorConnection

## Design System
- Backgrounds: bg-noir-950 (page), bg-noir-900 (cards), bg-noir-800 (inputs)
- Borders: border-noir-700
- Text: text-warm-50 (headings), text-gray-400 (body)
- Accent: amber-500 (buttons/highlights), amber-400 (hover)
- Buttons: rounded-lg px-4 py-2 bg-amber-500 text-noir-950 font-medium
- Cards: bg-noir-800 border border-noir-700 rounded-xl

## API Structure
- Routes: apps/api/src/routes/ (auth, events, support, raffle, ticket, artist, admin/)
- Services: apps/api/src/services/ (auth, email, webauthn)
- Shared: packages/shared/src/ (constants, schemas, types)
- Frontend: apps/web/src/pages/ and apps/web/src/components/

## Tools
You have access to tools that let you query the live database. Use them when asked about
platform statistics, user data, event info, campaign status, or any data question.
When providing code, give complete, copy-paste-ready implementations.
Format code blocks with the language identifier.`;

// Tool definitions for Claude API
const TOOLS = [
  {
    name: 'query_analytics',
    description: 'Get platform-wide analytics: user counts by role, event counts, campaign stats, support ticket revenue, raffle entries, recent signups.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'search_users',
    description: 'Search users by email or name. Returns up to 20 matching users with their role, city, verification status, and activity counts.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Email or name to search for' } },
      required: ['query'],
    },
  },
  {
    name: 'list_events',
    description: 'List events with optional filters. Returns event name, date, venue, city, ticket info, and campaign status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max results (default 10)' },
        upcoming: { type: 'boolean', description: 'Only future events' },
      },
    },
  },
  {
    name: 'get_campaign_details',
    description: 'Get details about campaigns including goal, current donations, ticket price, status, and linked event.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status: ACTIVE, COMPLETED, CANCELLED' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'count_records',
    description: 'Count records in any database table. Useful for quick stats.',
    input_schema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string',
          enum: ['user', 'artist', 'event', 'campaign', 'supportTicket', 'rafflePool', 'raffleEntry', 'directTicket', 'transaction', 'notification', 'developerInvite'],
          description: 'The database model to count',
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'get_revenue_stats',
    description: 'Get revenue statistics: total support ticket revenue, transaction counts, average transaction amount.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: any;
}

// Execute a tool call against the database
async function executeTool(name: string, input: any, prisma: any): Promise<any> {
  switch (name) {
    case 'query_analytics': {
      const [
        userTotal, usersByRole, eventTotal, eventsUpcoming,
        campaignTotal, activeCampaigns, supportRevenue,
        raffleEntries, recentSignups,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.groupBy({ by: ['role'], _count: true }),
        prisma.event.count(),
        prisma.event.count({ where: { date: { gte: new Date() } } }),
        prisma.campaign.count(),
        prisma.campaign.count({ where: { status: 'ACTIVE' } }),
        prisma.supportTicket.aggregate({ _sum: { priceCents: true }, _count: true }),
        prisma.raffleEntry.count(),
        prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, email: true, role: true, createdAt: true } }),
      ]);
      return {
        users: { total: userTotal, byRole: usersByRole },
        events: { total: eventTotal, upcoming: eventsUpcoming },
        campaigns: { total: campaignTotal, active: activeCampaigns },
        support: { revenueCents: supportRevenue._sum.priceCents || 0, ticketCount: supportRevenue._count },
        raffleEntries,
        recentSignups,
      };
    }
    case 'search_users': {
      const q = input.query || '';
      return prisma.user.findMany({
        where: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] },
        select: { id: true, email: true, name: true, role: true, city: true, emailVerified: true, createdAt: true, _count: { select: { supportTickets: true, raffleEntries: true } } },
        take: 20, orderBy: { createdAt: 'desc' },
      });
    }
    case 'list_events': {
      const where: any = {};
      if (input.upcoming) where.date = { gte: new Date() };
      return prisma.event.findMany({
        where, take: input.limit || 10, orderBy: { date: 'desc' },
        select: { id: true, name: true, date: true, venueName: true, city: true, state: true, ticketPrice: true, isSoldOut: true, _count: { select: { campaigns: true } } },
      });
    }
    case 'get_campaign_details': {
      const where: any = {};
      if (input.status) where.status = input.status;
      return prisma.campaign.findMany({
        where, take: input.limit || 10, orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, goalCents: true, currentCents: true, ticketPriceCents: true, createdAt: true, event: { select: { name: true, date: true } }, artist: { select: { stageName: true } } },
      });
    }
    case 'count_records': {
      const model = input.model;
      if (prisma[model]) return { model, count: await prisma[model].count() };
      return { error: `Unknown model: ${model}` };
    }
    case 'get_revenue_stats': {
      const [supportAgg, txAgg, txCount] = await Promise.all([
        prisma.supportTicket.aggregate({ _sum: { priceCents: true }, _count: true }),
        prisma.transaction.aggregate({ _sum: { amountCents: true }, _avg: { amountCents: true } }),
        prisma.transaction.count(),
      ]);
      return {
        supportTickets: { totalRevenueCents: supportAgg._sum.priceCents || 0, count: supportAgg._count },
        transactions: { totalCents: txAgg._sum.amountCents || 0, avgCents: Math.round(txAgg._avg.amountCents || 0), count: txCount },
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// Process a streaming response, forwarding text to client and collecting tool calls
async function processStream(
  response: Response,
  reply: any,
): Promise<{ contentBlocks: ContentBlock[]; stopReason: string }> {
  const reader = response.body?.getReader();
  if (!reader) return { contentBlocks: [], stopReason: 'error' };

  const decoder = new TextDecoder();
  let buffer = '';
  const contentBlocks: ContentBlock[] = [];
  let currentBlock: ContentBlock | null = null;
  let toolInputBuffer = '';
  let stopReason = 'end_turn';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);

        if (parsed.type === 'content_block_start') {
          currentBlock = parsed.content_block;
          if (currentBlock?.type === 'tool_use') {
            toolInputBuffer = '';
          }
        } else if (parsed.type === 'content_block_delta') {
          if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
            reply.raw.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
          } else if (parsed.delta?.type === 'input_json_delta') {
            toolInputBuffer += parsed.delta.partial_json || '';
          }
        } else if (parsed.type === 'content_block_stop') {
          if (currentBlock) {
            if (currentBlock.type === 'tool_use') {
              try { currentBlock.input = JSON.parse(toolInputBuffer || '{}'); } catch { currentBlock.input = {}; }
              contentBlocks.push({ ...currentBlock });
            } else if (currentBlock.type === 'text') {
              contentBlocks.push({ ...currentBlock });
            }
          }
          currentBlock = null;
          toolInputBuffer = '';
        } else if (parsed.type === 'message_delta') {
          if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason;
        }
      } catch {
        // skip unparseable
      }
    }
  }

  return { contentBlocks, stopReason };
}

export default async function chatRoutes(app: FastifyInstance) {
  app.post('/chat', async (req, reply) => {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: 'messages array is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.code(503).send({ error: 'AI chat not configured' });
    }

    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      // Build conversation with proper content format
      let currentMessages: any[] = messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      }));

      let maxRounds = 5; // Safety limit for tool-calling loops

      while (maxRounds-- > 0) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            stream: true,
            messages: currentMessages,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          app.log.error(`Claude API error ${response.status}: ${errText}`);
          reply.raw.write(`data: ${JSON.stringify({ error: `AI service error (${response.status})` })}\n\n`);
          break;
        }

        const { contentBlocks, stopReason } = await processStream(response, reply);

        // If no tool calls, we're done
        if (stopReason !== 'tool_use') break;

        // Collect tool use blocks
        const toolUseBlocks = contentBlocks.filter((b) => b.type === 'tool_use');
        if (toolUseBlocks.length === 0) break;

        // Build assistant content for the conversation
        const assistantContent: any[] = [];
        for (const block of contentBlocks) {
          if (block.type === 'text' && block.text) {
            assistantContent.push({ type: 'text', text: block.text });
          } else if (block.type === 'tool_use') {
            assistantContent.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
          }
        }

        currentMessages.push({ role: 'assistant', content: assistantContent });

        // Execute tools and collect results
        const toolResults: any[] = [];
        for (const tc of toolUseBlocks) {
          reply.raw.write(`data: ${JSON.stringify({ tool_call: { name: tc.name, status: 'running' } })}\n\n`);

          try {
            const result = await executeTool(tc.name!, tc.input, app.prisma);
            reply.raw.write(`data: ${JSON.stringify({ tool_call: { name: tc.name, status: 'done' } })}\n\n`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tc.id,
              content: JSON.stringify(result),
            });
          } catch (err: any) {
            reply.raw.write(`data: ${JSON.stringify({ tool_call: { name: tc.name, status: 'error' } })}\n\n`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tc.id,
              content: JSON.stringify({ error: err.message }),
              is_error: true,
            });
          }
        }

        currentMessages.push({ role: 'user', content: toolResults });
      }
    } catch (err: any) {
      app.log.error(err, 'Dev chat error');
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
    return reply;
  });
}
