// Shared types for Dashboard sub-components

export interface DashboardStats {
  totalRaffleEntries: number;
  raffleWins: number;
  ticketsOwned: number;
  totalSupportedCents: number;
  supportPurchases: number;
}

export interface UpcomingTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  type: 'direct' | 'raffle';
  status: string;
}

export interface DashboardData {
  stats: DashboardStats;
  upcomingTickets: UpcomingTicket[];
}

export interface ImpactData {
  score: number;
  tier: string;
  tierLabel: string;
  nextTier: { name: string; label: string; min: number } | null;
  breakdown: {
    showsSupported: number;
    uniqueArtists: number;
    raffleEntries: number;
    raffleWins: number;
    ticketsPurchased: number;
    totalSupportedCents: number;
    accountAgeDays: number;
  };
}

export interface SupportedCampaign {
  supportId: string;
  amountCents: number;
  supportedAt: string;
  event: {
    id: string;
    title: string;
    date: string;
    venueName: string;
    venueCity: string;
  };
  campaign: {
    id: string;
    headline: string;
    status: string;
    goalCents: number;
    fundedCents: number;
    goalReached: boolean;
    bonusCents: number;
  } | null;
}

export interface ActivityFeedItem {
  id: string;
  type: 'support' | 'raffle_entry' | 'raffle_win' | 'ticket_purchase';
  message: string;
  eventId: string;
  eventTitle: string;
  artistName: string;
  amountCents: number | null;
  createdAt: string;
}

export interface ArtistRelationship {
  artistId: string;
  stageName: string;
  genre: string | null;
  supportCount: number;
  ticketCount: number;
  totalSupportedCents: number;
  totalTicketCents: number;
  totalInteractions: number;
  uniqueEvents: number;
  fanLevel: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  fanLevelLabel: string;
  firstSupport: string;
  lastSupport: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Transaction {
  id: string;
  type: string;
  amountCents: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CampaignItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  headline: string;
  message: string;
  status: string;
  goalCents: number;
  fundedCents: number;
  goalReached: boolean;
  bonusCents: number;
  createdAt: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Recommendation {
  artistName: string | null;
  genre: string | null;
  venueCity: string | null;
  relevanceScore: number;
}

export interface TopGenre {
  genre: string;
  count: number;
  weight: number;
}

export interface SimilarFan {
  id: string;
  name: string | null;
  city: string | null;
}

export const TABS = ['overview', 'for-you', 'my-shows', 'notifications', 'transactions', 'account', 'security'] as const;
export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  'for-you': 'For You',
  'my-shows': 'My Shows',
  notifications: 'Notifications',
  transactions: 'Transactions',
  account: 'Account',
  security: 'Security',
};

export const TX_TYPE_LABELS: Record<string, string> = {
  SUPPORT_PURCHASE: 'Support Purchase',
  RAFFLE_ENTRY: 'Raffle Entry',
  TICKET_PURCHASE: 'Ticket Purchase',
  ARTIST_PAYOUT: 'Artist Payout',
  REFUND: 'Refund',
};

export const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  LEGEND: { color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-400/40', glow: 'shadow-amber-500/30' },
  HEADLINER: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  VIP: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
  FRONT_ROW: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  OPENING_ACT: { color: 'text-gray-400', bg: 'bg-noir-800', border: 'border-noir-700', glow: '' },
};

// --- Helpers ---

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getCountdown(iso: string): { days: number; hours: number; mins: number; past: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, past: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return { days, hours, mins, past: false };
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
