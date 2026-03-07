/**
 * Admin AI chat route — proxies to Claude API with MiraCulture project context.
 * ADMIN and DEVELOPER users can prompt Claude to get help editing/building the platform.
 */

import type { FastifyInstance } from 'fastify';

const SYSTEM_PROMPT = `You are MiraCulture's AI development assistant, embedded in the admin panel.
You help admins and developers build and improve the MiraCulture platform.

## Platform Overview
MiraCulture is a fan-powered ticket redistribution platform. "WHERE FANS POWER THE SHOW."
- Fans donate to campaigns supporting artists
- Campaign goal = 10 x ticket price
- Goal reached → 10 discounted local-fan tickets become available
- Surplus donations → buy more tickets or become artist bonus
- Cryptographically fair raffles (SHA-256 + Fisher-Yates)
- Geolocation-verified ticket purchases (100km radius)

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Fastify + Prisma + PostgreSQL
- **Payments**: Stripe (tickets, support, raffles)
- **Auth**: JWT + TOTP 2FA + WebAuthn passkeys + Social OAuth
- **Email**: Resend
- **Hosting**: Railway (auto-deploy from master)
- **Design**: Concert Poster Noir theme (bg-noir-800/950, amber-500 accents, warm-50 text)

## Key Models
User (FAN/LOCAL_FAN/ARTIST/ADMIN/DEVELOPER), Artist, Event, Campaign, SupportTicket,
PoolTicket, RafflePool, RaffleEntry, DirectTicket, Transaction, DeveloperInvite

## Design System CSS Classes
- Backgrounds: bg-noir-950 (page), bg-noir-900 (cards), bg-noir-800 (inputs/tables)
- Borders: border-noir-700
- Text: text-warm-50 (headings), text-gray-400 (body), text-gray-500 (labels)
- Accent: amber-500 (buttons/highlights), amber-400 (hover)
- Labels: text-[10px] uppercase tracking-wider
- Font: font-display (headings), font-body (text)
- Buttons: rounded-lg px-4 py-2 bg-amber-500 text-noir-950 font-medium
- Inputs: bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-amber-500/50
- Cards: bg-noir-800 border border-noir-700 rounded-xl
- Badge: px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider

## API Structure
- Routes: apps/api/src/routes/ (auth, events, support, raffle, ticket, artist, admin/)
- Services: apps/api/src/services/ (auth, email, webauthn)
- Middleware: apps/api/src/middleware/authenticate.ts (requireRole)
- Frontend pages: apps/web/src/pages/
- Shared: packages/shared/src/ (constants, schemas, types)

## Guidelines
- Write React with TypeScript, use existing api.ts helper for fetch calls
- Follow existing patterns: mobile cards + desktop tables, modal pattern, tab pattern
- Use Tailwind classes from the design system above
- Prisma for all database operations
- Zod for input validation (shared schemas)
- Keep code concise, production-quality

When asked to build features or write code, provide complete, copy-paste-ready implementations.
When asked about the platform, give specific actionable answers.
Format code blocks with the language identifier.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default async function chatRoutes(app: FastifyInstance) {
  app.post('/chat', async (req, reply) => {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: 'messages array is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.code(503).send({ error: 'AI chat not configured (missing ANTHROPIC_API_KEY)' });
    }

    // Stream the response
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
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
          stream: true,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        reply.raw.write(`data: ${JSON.stringify({ error: `Claude API error: ${response.status}` })}\n\n`);
        reply.raw.end();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'No response stream' })}\n\n`);
        reply.raw.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                reply.raw.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (err: any) {
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      reply.raw.end();
    }

    return reply;
  });
}
