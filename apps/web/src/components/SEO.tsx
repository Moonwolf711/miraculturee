import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'MiraCulture';
const DEFAULT_TITLE = 'MiraCulture — Fan-Powered Tickets';
const DEFAULT_DESCRIPTION =
  'Fans worldwide buy tickets at face value to support artists. Local fans win those tickets through fair, cryptographic raffles for just $5. No scalpers. No bots.';
const DEFAULT_IMAGE = '/og-image.png';
const BASE_URL = 'https://miraculture.com';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
  jsonLd,
}: SEOProps) {
  const location = useLocation();

  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = url || `${BASE_URL}${location.pathname}`;
  const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  const jsonLdArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={canonicalUrl} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {/* JSON-LD Structured Data */}
      {jsonLdArray.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

/**
 * Organization schema for site-wide structured data.
 */
export function getOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MiraCulture',
    url: BASE_URL,
    logo: `${BASE_URL}/favicon.svg`,
    description: DEFAULT_DESCRIPTION,
    sameAs: [],
  };
}

/**
 * BreadcrumbList schema generator.
 */
export function getBreadcrumbSchema(
  items: { name: string; url: string }[],
): Record<string, unknown> {
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

/**
 * Event schema generator for EventDetailPage.
 */
export function getEventSchema(event: {
  title: string;
  description?: string | null;
  artistName: string;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  date: string;
  ticketPriceCents: number;
  id: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description:
      event.description ||
      `${event.artistName} live at ${event.venueName}, ${event.venueCity}`,
    startDate: event.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venueName,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.venueAddress,
        addressLocality: event.venueCity,
      },
    },
    performer: {
      '@type': 'MusicGroup',
      name: event.artistName,
    },
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/events/${event.id}`,
      priceCurrency: 'USD',
      price: (event.ticketPriceCents / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
    organizer: {
      '@type': 'Organization',
      name: 'MiraCulture',
      url: BASE_URL,
    },
  };
}
