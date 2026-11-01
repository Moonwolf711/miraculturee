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

export function formatTitle(title: string | null | undefined): string;
export function eventTitle(event: EventLike): string;
export function eventDescription(event: EventLike): string;
export function artistTitle(artist: ArtistLike): string;
export function artistDescription(artist: ArtistLike): string;
export function organizationSchema(): JsonLd;
export function breadcrumbSchema(items: { name: string; url: string }[]): JsonLd;
export function routeBreadcrumb(path: string): JsonLd | null;
