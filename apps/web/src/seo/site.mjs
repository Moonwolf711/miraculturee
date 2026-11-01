// Single source of SEO facts for the web app. Imported by the React pages
// (through components/SEO.tsx) and by server.cjs, which renders the same
// tags into the HTML it sends, so crawlers that do not run JavaScript see
// what the app shows. Plain ESM (.mjs) so Node can import it without a build.

export const SITE_URL = 'https://www.mira-culture.com';
export const SITE_NAME = 'MiraCulture';
export const TITLE_SUFFIX = ` | ${SITE_NAME}`;
export const DEFAULT_TITLE = 'MiraCulture — Fan-Powered Concert Tickets | $5 Raffle Entry';
export const DEFAULT_DESCRIPTION =
  'Fans worldwide buy tickets at face value to support artists. Local fans win those tickets through fair, cryptographic raffles for just $5. No scalpers. No bots.';
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Public pages: what <title>, description, H1 and sitemap say about each one. */
export const STATIC_ROUTES = {
  '/': {
    title: null,
    description: DEFAULT_DESCRIPTION,
    h1: 'WHERE FANS POWER THE SHOW',
    sitemap: { changefreq: 'daily', priority: '1.0' },
  },
  '/events': {
    title: 'Upcoming Shows and Face-Value Tickets',
    description:
      'Browse upcoming live music events on MiraCulture. Buy face-value tickets to support artists or enter $5 raffles as a local fan.',
    h1: 'UPCOMING SHOWS',
    breadcrumb: 'Events',
    sitemap: { changefreq: 'daily', priority: '0.9' },
  },
  '/local-artists': {
    title: 'Local Artist Marketplace',
    description:
      'Discover talented local artists for your next event on MiraCulture. Browse EPKs, listen to releases, and send booking requests directly.',
    h1: 'LOCAL ARTIST MARKETPLACE',
    breadcrumb: 'Local Artists',
    sitemap: { changefreq: 'weekly', priority: '0.7' },
  },
  '/agents': {
    title: 'Promoter Agent Marketplace',
    description:
      'Find a verified local promoter to run your campaign. MiraCulture agents know the local scene, have venue connections, and earn 50% of campaign proceeds.',
    h1: 'PROMOTER AGENT MARKETPLACE',
    breadcrumb: 'Promoter Agents',
    sitemap: { changefreq: 'weekly', priority: '0.6' },
  },
  '/privacy': {
    title: 'Privacy Policy and Your Data',
    description:
      'MiraCulture privacy policy — how we collect, use, and protect your personal information.',
    h1: 'PRIVACY POLICY',
    breadcrumb: 'Privacy Policy',
    sitemap: { changefreq: 'yearly', priority: '0.3' },
  },
  '/terms': {
    title: 'Terms of Service and Raffle Rules',
    description:
      'MiraCulture terms of service — rules, raffle terms, refund policy, and platform usage guidelines.',
    h1: 'TERMS OF SERVICE',
    breadcrumb: 'Terms of Service',
    sitemap: { changefreq: 'yearly', priority: '0.3' },
  },
  // noindex pages (their own SEO component already says so)
  '/login': {
    title: 'Sign In',
    description:
      'Sign in to MiraCulture to support artists, enter fair ticket raffles, and manage your account.',
    h1: 'SIGN IN',
    noindex: true,
  },
  '/register': {
    title: 'Sign Up',
    description:
      'Join MiraCulture as a fan, local fan, or artist. Support live music with fair, face-value tickets and cryptographic raffles.',
    h1: 'JOIN THE MOVEMENT',
    noindex: true,
  },
};

export const NOT_FOUND = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
  h1: 'PAGE NOT FOUND',
  noindex: true,
};

/** Every path the React router serves (App.tsx). Anything else is a real 404. */
export const APP_ROUTES = [
  '/', '/login', '/register', '/artist/register', '/artist/verify', '/events', '/events/:id',
  '/invite/:token', '/dev-invite/:token', '/dashboard', '/forgot-password', '/reset-password',
  '/verify-email', '/auth/callback', '/artist/dashboard', '/artist/earnings',
  '/artist/campaigns/new', '/connect/dashboard', '/connect/storefront/:accountId', '/admin',
  '/agents', '/agents/register', '/agents/dashboard', '/manager/accept/:token',
  '/manager/dashboard', '/local-artists', '/local-artists/register', '/local-artists/dashboard',
  '/artists/:id', '/admin/outreach', '/account', '/privacy', '/terms',
];

/** Signed-in areas and one-time links: kept out of the crawl (robots.txt). */
export const ROBOTS_DISALLOW = [
  '/api/', '/dashboard', '/admin', '/account', '/artist/dashboard', '/artist/earnings',
  '/artist/campaigns/', '/connect/dashboard', '/agents/dashboard', '/manager/',
  '/local-artists/dashboard', '/auth/', '/invite/', '/dev-invite/', '/reset-password',
  '/verify-email',
];

/** Public pages backed by API data; every other APP_ROUTE is noindex. */
export const INDEXABLE_DYNAMIC = ['/events/:id', '/artists/:id'];

export function formatTitle(title) {
  return title ? `${title}${TITLE_SUFFIX}` : DEFAULT_TITLE;
}

function clamp(text, max) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

// Event dates are calendar days stored at 20:00 UTC (the importers add that
// time), so they are formatted in UTC to show the listed day.
function eventDay(event, style) {
  const d = new Date(event.date || '');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { ...style, timeZone: 'UTC' });
}

const TITLE_ROOM = TITLE_MAX - TITLE_SUFFIX.length;
const TITLE_NAME_MIN = 20;

/**
 * Title (without suffix) for an event page, kept within TITLE_MAX once suffixed.
 * Tours and weekly nights repeat one name, so the city and day keep each title unique.
 */
export function eventTitle(event) {
  const title = String(event.title || '').trim();
  const artist = String(event.artistName || '').trim();
  const name = clamp(artist && !title.toLowerCase().includes(artist.toLowerCase()) ? `${title} - ${artist}` : title, Infinity);
  const city = String(event.venueCity || '').trim();
  const day = eventDay(event, { month: 'short', day: 'numeric' });
  const tails = [`${city ? ` in ${city}` : ''}${day ? ` on ${day}` : ''}`, day ? ` on ${day}` : ''];
  for (const tail of tails) if (name.length + tail.length <= TITLE_ROOM) return `${name}${tail}`;
  for (const tail of tails) if (TITLE_ROOM - tail.length >= TITLE_NAME_MIN) return `${clamp(name, TITLE_ROOM - tail.length)}${tail}`;
  return clamp(name, TITLE_ROOM);
}

export function eventDescription(event) {
  if (event.description) return clamp(event.description, DESCRIPTION_MAX);
  // The day keeps weekly nights at one venue from sharing a description.
  const day = eventDay(event, { month: 'long', day: 'numeric', year: 'numeric' });
  const facts = `${event.title}: ${event.artistName} live at ${event.venueName}, ${event.venueCity}${day ? ` on ${day}` : ''}.`;
  const text = `${facts} Get face-value tickets on MiraCulture.`;
  return clamp(text.length <= DESCRIPTION_MAX ? text : facts, DESCRIPTION_MAX);
}

/** Event-type tabs of /events (?type=), in the order EventsPage shows them. SHOW is the default. */
export const EVENT_TYPES = [
  {
    type: 'SHOW',
    label: 'Shows',
    short: 'Upcoming Shows',
    title: STATIC_ROUTES['/events'].title,
    h1: STATIC_ROUTES['/events'].h1,
    description: STATIC_ROUTES['/events'].description,
  },
  {
    type: 'FESTIVAL',
    label: 'Festivals',
    short: 'Upcoming Festivals',
    title: 'Upcoming Festivals',
    h1: 'UPCOMING FESTIVALS',
    description:
      'Browse upcoming EDM festivals on MiraCulture. Buy face-value tickets to support artists or enter $5 raffles as a local fan.',
  },
  {
    type: 'SPORTS',
    label: 'Sports',
    short: 'Upcoming Sports Events',
    title: 'Upcoming Sports Events',
    h1: 'SPORTS EVENTS',
    description: 'Browse upcoming sports events on MiraCulture. Face-value tickets, no scalpers, no bots.',
  },
  {
    type: 'COMEDY',
    label: 'Comedy',
    short: 'Upcoming Comedy Shows',
    title: 'Upcoming Comedy Shows',
    h1: 'COMEDY SHOWS',
    description: 'Browse upcoming comedy shows on MiraCulture. Face-value tickets, no scalpers, no bots.',
  },
];
/** The sort EventsPage requests by default (activeSorts ['popular', 'date']). */
export const EVENTS_DEFAULT_SORT = 'popular,date';

/** Path of one /events tab and page, in its canonical form (default tab and page 1 omitted). */
export function eventsListPath(type, page) {
  const q = new URLSearchParams();
  if (type && type !== EVENT_TYPES[0].type) q.set('type', type);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return `/events${s ? `?${s}` : ''}`;
}

/** Title, description, H1 and canonical path for one /events tab and page. */
export function eventsListMeta(type, page) {
  const tab = EVENT_TYPES.find((t) => t.type === type) || EVENT_TYPES[0];
  const n = page > 1 ? page : 1;
  return {
    type: tab.type,
    page: n,
    path: eventsListPath(tab.type, n),
    title: n > 1 ? `${tab.short} — Page ${n}` : tab.title,
    description: n > 1 ? clamp(`Page ${n}. ${tab.description}`, DESCRIPTION_MAX) : tab.description,
    h1: tab.h1,
  };
}

export function artistTitle(artist) {
  return clamp(`${artist.stageName} — Artist Profile`, TITLE_MAX - TITLE_SUFFIX.length);
}

export function artistDescription(artist) {
  return clamp(
    artist.bio || `Check out ${artist.stageName} on MiraCulture. Support live music, enter ticket raffles.`,
    DESCRIPTION_MAX,
  );
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/apple-touch-icon.png`,
    description: DEFAULT_DESCRIPTION,
  };
}

export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Home > page breadcrumb for a static route, or null for the home page. */
export function routeBreadcrumb(path) {
  const route = STATIC_ROUTES[path];
  if (!route || !route.breadcrumb) return null;
  return breadcrumbSchema([
    { name: 'Home', url: `${SITE_URL}/` },
    { name: route.breadcrumb, url: `${SITE_URL}${path}` },
  ]);
}
