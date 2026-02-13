import type { FastifyBaseLogger } from 'fastify';

export interface EdmtrainConfig {
  clientKey: string;
  locationIds: number[];
}

export interface EdmtrainVenue {
  id: number;
  name: string;
  location: string;
  address: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface EdmtrainArtist {
  id: number;
  name: string;
  link: string | null;
  b2bInd: boolean;
}

export interface EdmtrainEvent {
  id: number;
  link: string;
  name: string | null;
  ages: string | null;
  festivalInd: boolean;
  livestreamInd: boolean;
  electronicGenreInd: boolean;
  otherGenreInd: boolean;
  date: string;
  startTime: string | null;
  endTime: string | null;
  createdDate: string;
  venue: EdmtrainVenue;
  artistList: EdmtrainArtist[];
}

interface EdmtrainResponse {
  success: boolean;
  data: EdmtrainEvent[];
  message?: string;
}

export class EdmtrainClient {
  private config: EdmtrainConfig;
  private log: FastifyBaseLogger;
  private baseUrl = 'https://edmtrain.com/api';

  constructor(config: EdmtrainConfig, log: FastifyBaseLogger) {
    this.config = config;
    this.log = log;
  }

  async fetchEvents(): Promise<EdmtrainEvent[]> {
    const allEvents: EdmtrainEvent[] = [];

    // EDMTrain API accepts locationIds as comma-separated
    const locationChunks = this.chunkArray(this.config.locationIds, 5);

    for (const chunk of locationChunks) {
      const params = new URLSearchParams({
        client: this.config.clientKey,
        locationIds: chunk.join(','),
      });

      const url = `${this.baseUrl}/events?${params}`;
      this.log.info({ url: url.replace(this.config.clientKey, '***') }, 'Fetching EDMTrain events');

      const response = await fetch(url);
      if (!response.ok) {
        this.log.error({ status: response.status }, 'EDMTrain API error');
        continue;
      }

      const body = await response.json() as EdmtrainResponse;
      if (!body.success) {
        this.log.error({ message: body.message }, 'EDMTrain API returned error');
        continue;
      }

      // Filter out livestreams — we want in-person events only
      const inPerson = body.data.filter((e) => !e.livestreamInd);
      allEvents.push(...inPerson);
      this.log.info({ locationIds: chunk, count: inPerson.length }, 'Fetched EDMTrain batch');
    }

    // Deduplicate by event id
    const seen = new Set<number>();
    return allEvents.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
