export interface RouteMeta {
  title: string | null;
  description: string;
  h1: string;
  breadcrumb?: string;
  noindex?: boolean;
  sitemap?: { changefreq: string; priority: string };
}

export interface EventLike {
  title: string;
  artistName: string;
  venueName: string;
  venueCity: string;
  /** ISO date; the calendar day (UTC) goes into the title and description. */
  date?: string | null;
  description?: string | null;
}

export interface ArtistLike {
  stageName: string;
  bio?: string | null;
}

export type JsonLd = Record<string, unknown>;

export const SITE_URL: string;
export const SITE_NAME: string;
export const TITLE_SUFFIX: string;
export const DEFAULT_TITLE: string;
export const DEFAULT_DESCRIPTION: string;
export const DEFAULT_IMAGE: string;
export const TITLE_MAX: number;
export const DESCRIPTION_MAX: number;
export const STATIC_ROUTES: Record<string, RouteMeta>;
export const NOT_FOUND: RouteMeta;
export const APP_ROUTES: string[];
export const ROBOTS_DISALLOW: string[];
export const INDEXABLE_DYNAMIC: string[];
export interface EventTypeTab {
  type: string;
  label: string;
  short: string;
  title: string | null;
  h1: string;
  description: string;
}
export interface EventsListMeta {
  type: string;
  page: number;
  path: string;
  title: string | null;
  description: string;
  h1: string;
}
export const EVENT_TYPES: EventTypeTab[];
export const EVENTS_DEFAULT_SORT: string;
export function eventsListPath(type: string, page: number): string;
export function eventsListMeta(type: string, page: number): EventsListMeta;

export function formatTitle(title: string | null | undefined): string;
export function eventTitle(event: EventLike): string;
export function eventDescription(event: EventLike): string;
export function artistTitle(artist: ArtistLike): string;
export function artistDescription(artist: ArtistLike): string;
export function organizationSchema(): JsonLd;
export function breadcrumbSchema(items: { name: string; url: string }[]): JsonLd;
export function routeBreadcrumb(path: string): JsonLd | null;
