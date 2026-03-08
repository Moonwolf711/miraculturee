/**
 * Admin AI dev-chat route — Base44-style AI assistant with tool calling.
 * Streams Claude responses via SSE. The AI can query the MiraCulture database
 * AND read/write files in the GitHub repo to implement features end-to-end.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PrismaClient } from '@prisma/client';

const REPO_OWNER = 'Moonwolf711';
const REPO_NAME = 'miraculturee';
const REPO_BRANCH = 'master';

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
You have TWO categories of tools:

### Database Tools
Query the live database for platform statistics, user data, event info, campaign status, revenue.

### Development Tools (GitHub API)
You can READ and WRITE files directly in the GitHub repository to implement features:
- read_file: Read any file from the codebase
- write_file: Create or update files (commits directly to master)
- list_directory: Browse the project structure
- search_code: Find code patterns across the codebase
- get_prisma_schema: Read the full database schema

When implementing features:
1. First read existing files to understand context
2. Plan your changes
3. Write files with clear commit messages
4. Explain what you changed and why

### Admin Power Tools
Full admin access to the live platform:
- run_prisma_query: Run ANY Prisma operation (findMany, create, update, delete, aggregate, etc.) on any model
- manage_user: Update roles, ban/unban, verify emails, delete users
- call_api_endpoint: Call any API endpoint internally (test routes, trigger actions)
- run_raw_sql: Run raw SQL for complex queries or bulk operations

You have FULL admin access. When asked to create endpoints, modify the database, manage users,
clean up data, or perform any admin task — just do it. You can both modify the codebase (via GitHub)
AND interact with the live database/API directly.

Always give complete, working implementations. Follow existing patterns in the codebase.
Format code blocks with the language identifier.`;

// GitHub API helper
async function githubAPI(path: string, options: RequestInit = {}): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'MiraCulture-DevChat',
      ...options.headers,
    },
  });
}

// Tool definitions for Claude API
const TOOLS = [
  // === Database Tools ===
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
  // === Development Tools (GitHub API) ===
  {
    name: 'read_file',
    description: 'Read a file from the MiraCulture codebase (GitHub repo). Returns the file contents. Use this to understand existing code before making changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to repo root, e.g. "apps/api/src/routes/auth.ts" or "apps/web/src/pages/EventDetailPage.tsx"' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or update a file in the MiraCulture codebase. Commits directly to the master branch. Use this to implement features, fix bugs, or add new files.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to repo root, e.g. "apps/web/src/components/NewComponent.tsx"' },
        content: { type: 'string', description: 'The full file content to write' },
        message: { type: 'string', description: 'Git commit message describing the change' },
      },
      required: ['path', 'content', 'message'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a path of the MiraCulture codebase. Use to explore the project structure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path relative to repo root, e.g. "apps/web/src/pages" or "apps/api/src/routes". Use empty string or "/" for root.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code patterns across the MiraCulture codebase using GitHub code search. Finds function definitions, imports, class names, variables, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Code search query, e.g. "requireRole" or "stripe.paymentIntents" or "className=\\"bg-amber"' },
        extension: { type: 'string', description: 'Optional file extension filter, e.g. "ts", "tsx", "prisma"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_prisma_schema',
    description: 'Read the full Prisma database schema. Shows all models, enums, relations, and fields. Essential for understanding the data layer before making changes.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  // === Admin Power Tools ===
  {
    name: 'run_prisma_query',
    description: 'Run any Prisma query against the live database. Supports all Prisma operations: findMany, findFirst, create, update, upsert, delete, deleteMany, aggregate, groupBy, count. Use this for any database operation not covered by other tools.',
    input_schema: {
      type: 'object' as const,
      properties: {
        model: { type: 'string', description: 'Prisma model name (camelCase): user, artist, event, campaign, supportTicket, rafflePool, raffleEntry, directTicket, transaction, notification, externalEvent, eventSyncLog, developerInvite, passkey, socialLogin, connectedAccount, donorConnection, suspiciousActivity, connectSubscription, ticketAcquisition, artistSocialAccount' },
        operation: { type: 'string', enum: ['findMany', 'findFirst', 'findUnique', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'], description: 'Prisma operation to run' },
        args: { type: 'object', description: 'Prisma operation arguments (where, data, select, include, orderBy, take, skip, etc). Dates should be ISO strings.' },
      },
      required: ['model', 'operation'],
    },
  },
  {
    name: 'manage_user',
    description: 'Manage user accounts: update role, ban/unban, verify email, reset password, or delete user. Use for admin operations on specific users.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: { type: 'string', enum: ['update_role', 'ban', 'unban', 'verify_email', 'delete', 'get_details'], description: 'Action to perform' },
        email: { type: 'string', description: 'User email to act on' },
        role: { type: 'string', enum: ['FAN', 'LOCAL_FAN', 'ARTIST', 'ADMIN', 'DEVELOPER'], description: 'New role (for update_role action)' },
      },
      required: ['action', 'email'],
    },
  },
  {
    name: 'call_api_endpoint',
    description: 'Call any MiraCulture API endpoint internally. Useful for testing endpoints, triggering actions, or previewing responses. Runs against the live API.',
    input_schema: {
      type: 'object' as const,
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method' },
        path: { type: 'string', description: 'API path, e.g. "/events" or "/admin/dashboard/analytics"' },
        body: { type: 'object', description: 'Request body for POST/PUT/PATCH' },
      },
      required: ['method', 'path'],
    },
  },
  {
    name: 'run_raw_sql',
    description: 'Run a raw SQL query against the PostgreSQL database. Use for complex queries, migrations, or operations not easily done via Prisma. SELECT queries return rows. INSERT/UPDATE/DELETE return affected count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'SQL query to execute. Use $1, $2 etc for parameters.' },
        params: { type: 'array', description: 'Query parameters (optional, for parameterized queries)' },
      },
      required: ['query'],
    },
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
  input?: Record<string, unknown>;
}

// Execute a tool call against the database or GitHub API
// PrismaClient used with dynamic model access (prisma[model][operation])
// which TypeScript cannot statically verify — indexed access typed loosely.
async function executeTool(name: string, input: Record<string, unknown>, prisma: PrismaClient): Promise<unknown> {
  switch (name) {
    // === Database Tools ===
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
      const where: Record<string, unknown> = {};
      if (input.upcoming) where.date = { gte: new Date() };
      return prisma.event.findMany({
        where, take: input.limit || 10, orderBy: { date: 'desc' },
        select: { id: true, name: true, date: true, venueName: true, city: true, state: true, ticketPrice: true, isSoldOut: true, _count: { select: { campaigns: true } } },
      });
    }
    case 'get_campaign_details': {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      return prisma.campaign.findMany({
        where, take: input.limit || 10, orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, goalCents: true, currentCents: true, ticketPriceCents: true, createdAt: true, event: { select: { name: true, date: true } }, artist: { select: { stageName: true } } },
      });
    }
    case 'count_records': {
      const model = input.model as string;
      const prismaAny = prisma as unknown as Record<string, { count: () => Promise<number> }>;
      if (prismaAny[model]) return { model, count: await prismaAny[model].count() };
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

    // === Development Tools (GitHub API) ===
    case 'read_file': {
      const filePath = input.path.replace(/^\//, '');
      const res = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${REPO_BRANCH}`);
      if (!res.ok) {
        const err = await res.json();
        return { error: `Failed to read ${filePath}: ${err.message || res.status}` };
      }
      const data = await res.json();
      if (data.type !== 'file') return { error: `${filePath} is a ${data.type}, not a file` };
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { path: filePath, size: data.size, content };
    }

    case 'write_file': {
      const filePath = input.path.replace(/^\//, '');
      const content = input.content;
      const message = input.message || `Update ${filePath}`;

      // Check if file exists to get its SHA (required for updates)
      let sha: string | undefined;
      const checkRes = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${REPO_BRANCH}`);
      if (checkRes.ok) {
        const existing = await checkRes.json();
        sha = existing.sha;
      }

      const body: Record<string, string> = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch: REPO_BRANCH,
      };
      if (sha) body.sha = sha;

      const res = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        return { error: `Failed to write ${filePath}: ${err.message || res.status}` };
      }

      const result = await res.json();
      return {
        success: true,
        path: filePath,
        sha: result.content.sha,
        commit: result.commit.sha,
        message,
        action: sha ? 'updated' : 'created',
      };
    }

    case 'list_directory': {
      const dirPath = (input.path || '').replace(/^\//, '') || '';
      const url = dirPath
        ? `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${dirPath}?ref=${REPO_BRANCH}`
        : `/repos/${REPO_OWNER}/${REPO_NAME}/contents?ref=${REPO_BRANCH}`;
      const res = await githubAPI(url);
      if (!res.ok) {
        const err = await res.json();
        return { error: `Failed to list ${dirPath || '/'}: ${err.message || res.status}` };
      }
      const items = await res.json();
      if (!Array.isArray(items)) return { error: `${dirPath} is not a directory` };
      return {
        path: dirPath || '/',
        items: items.map((item: { name: string; type: string; size: number; path: string }) => ({
          name: item.name,
          type: item.type, // 'file' or 'dir'
          size: item.size,
          path: item.path,
        })),
      };
    }

    case 'search_code': {
      const q = input.query;
      let searchQuery = `${q} repo:${REPO_OWNER}/${REPO_NAME}`;
      if (input.extension) searchQuery += ` extension:${input.extension}`;

      const res = await githubAPI(`/search/code?q=${encodeURIComponent(searchQuery)}&per_page=15`);
      if (!res.ok) {
        const err = await res.json();
        return { error: `Search failed: ${err.message || res.status}` };
      }
      const data = await res.json();
      return {
        total_count: data.total_count,
        results: (data.items || []).map((item: { path: string; name: string; html_url: string; text_matches?: { fragment: string }[] }) => ({
          path: item.path,
          name: item.name,
          url: item.html_url,
          matches: item.text_matches?.map((m: { fragment: string }) => m.fragment) || [],
        })),
      };
    }

    case 'get_prisma_schema': {
      const res = await githubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/apps/api/prisma/schema.prisma?ref=${REPO_BRANCH}`);
      if (!res.ok) {
        const err = await res.json();
        return { error: `Failed to read schema: ${err.message || res.status}` };
      }
      const data = await res.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { path: 'apps/api/prisma/schema.prisma', content };
    }

    // === Admin Power Tools ===
    case 'run_prisma_query': {
      const { model, operation, args } = input;
      // Dynamic model/operation access — runtime-validated, needs indexed access
      const prismaAny = prisma as unknown as Record<string, Record<string, (args?: unknown) => Promise<unknown>>>;
      if (!prismaAny[model as string]) return { error: `Unknown model: ${model}` };
      if (typeof prismaAny[model as string][operation as string] !== 'function') return { error: `Unknown operation: ${model}.${operation}` };

      // Parse date strings in args
      const processedArgs = args ? JSON.parse(JSON.stringify(args), (_key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value);
        return value;
      }) : undefined;

      const result = await prismaAny[model as string][operation as string](processedArgs);
      // Truncate large results
      const json = JSON.stringify(result);
      if (json.length > 20000) {
        const count = Array.isArray(result) ? result.length : 1;
        return { truncated: true, count, preview: JSON.parse(json.slice(0, 20000) + '..."]}') };
      }
      return result;
    }

    case 'manage_user': {
      const action = input.action as string;
      const email = input.email as string;
      const role = input.role as string | undefined;
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true, emailVerified: true, isBanned: true, createdAt: true, _count: { select: { supportTickets: true, raffleEntries: true, transactions: true, directTickets: true } } } });
      if (!user) return { error: `User not found: ${email}` };

      switch (action) {
        case 'get_details':
          return user;
        case 'update_role':
          if (!role) return { error: 'role is required for update_role' };
          return prisma.user.update({ where: { email }, data: { role }, select: { email: true, name: true, role: true } });
        case 'ban':
          return prisma.user.update({ where: { email }, data: { isBanned: true, bannedAt: new Date() }, select: { email: true, name: true, isBanned: true } });
        case 'unban':
          return prisma.user.update({ where: { email }, data: { isBanned: false, bannedAt: null }, select: { email: true, name: true, isBanned: true } });
        case 'verify_email':
          return prisma.user.update({ where: { email }, data: { emailVerified: true }, select: { email: true, name: true, emailVerified: true } });
        case 'delete': {
          // Delete events first (cascade doesn't always cover all paths)
          await prisma.event.deleteMany({ where: { artist: { userId: user.id } } });
          return prisma.user.delete({ where: { email }, select: { email: true, name: true } });
        }
        default:
          return { error: `Unknown action: ${action}` };
      }
    }

    case 'call_api_endpoint': {
      const { method, path: apiPath, body } = input;
      const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://0.0.0.0:${process.env.PORT || 3000}`;
      const url = `${baseUrl}${apiPath.startsWith('/') ? apiPath : '/' + apiPath}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body && ['POST', 'PUT', 'PATCH'].includes(method) ? { body: JSON.stringify(body) } : {}),
      });

      const contentType = res.headers.get('content-type') || '';
      const responseBody = contentType.includes('json') ? await res.json() : await res.text();
      return { status: res.status, body: responseBody };
    }

    case 'run_raw_sql': {
      const { query, params } = input;
      // Safety: block dangerous operations without WHERE clause
      const upper = query.trim().toUpperCase();
      if ((upper.startsWith('DROP') || upper.startsWith('TRUNCATE') || upper.startsWith('ALTER')) && !upper.includes('--FORCE')) {
        return { error: 'DROP/TRUNCATE/ALTER blocked for safety. Add --FORCE comment to override.' };
      }

      if (upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('EXPLAIN')) {
        const result = await prisma.$queryRawUnsafe(query, ...(params || []));
        const json = JSON.stringify(result, (_k, v) => typeof v === 'bigint' ? Number(v) : v);
        if (json.length > 20000) return { truncated: true, rowCount: (result as unknown[]).length, preview: json.slice(0, 20000) };
        return JSON.parse(json);
      } else {
        const affected = await prisma.$executeRawUnsafe(query, ...(params || []));
        return { affected, query: query.slice(0, 100) };
      }
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// Process a streaming response, forwarding text to client and collecting tool calls
async function processStream(
  response: Response,
  reply: FastifyReply,
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
  app.post('/dev-assist', async (req, reply) => {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: 'messages array is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return reply.code(503).send({ error: 'AI chat not configured' });
    }

    // SSE headers — must include CORS since reply.raw bypasses Fastify middleware
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://miracultureeweb-production.up.railway.app',
      'https://www.mira-culture.com',
      'https://mira-culture.com',
      ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
    ];
    const corsHeaders: Record<string, string> = {};
    if (origin && allowedOrigins.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
      corsHeaders['Vary'] = 'Origin';
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    });

    try {
      // Build conversation with proper content format
      let currentMessages: { role: string; content: unknown }[] = messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      }));

      let maxRounds = 10; // Higher limit for multi-step dev tasks

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
            max_tokens: 8192,
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
        const assistantContent: Record<string, unknown>[] = [];
        for (const block of contentBlocks) {
          if (block.type === 'text' && block.text) {
            assistantContent.push({ type: 'text', text: block.text });
          } else if (block.type === 'tool_use') {
            assistantContent.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
          }
        }

        currentMessages.push({ role: 'assistant', content: assistantContent });

        // Execute tools and collect results
        const toolResults: { type: string; tool_use_id: string | undefined; content: string; is_error?: boolean }[] = [];
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
          } catch (err: unknown) {
            reply.raw.write(`data: ${JSON.stringify({ tool_call: { name: tc.name, status: 'error' } })}\n\n`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tc.id,
              content: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
              is_error: true,
            });
          }
        }

        currentMessages.push({ role: 'user', content: toolResults });
      }
    } catch (err: unknown) {
      app.log.error(err, 'Dev chat error');
      reply.raw.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : String(err) })}\n\n`);
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
    return reply;
  });
}
