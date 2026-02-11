/**
 * Geo-Verification Service
 * 
 * Provides server-side IP geolocation to prevent location spoofing
 * Uses ip-api.com (free tier: 45 requests/minute)
 */

export interface GeoLocation {
  lat: number;
  lng: number;
  city: string;
  country: string;
  region?: string;
  accuracy: number; // Estimated accuracy in km
}

export interface GeoVerificationResult {
  verified: boolean;
  serverLocation: GeoLocation;
  clientLat: number;
  clientLng: number;
  discrepancyKm: number;
  message: string;
}

export class GeoVerificationService {
  private enabled: boolean;
  private maxDiscrepancyKm: number;

  constructor() {
    this.enabled = process.env.GEO_VERIFICATION_ENABLED === 'true';
    this.maxDiscrepancyKm = parseInt(process.env.GEO_MAX_DISCREPANCY_KM || '100');
  }

  /**
   * Get geolocation from IP address
   */
  async getLocation(ip: string): Promise<GeoLocation> {
    // Skip for private IPs
    if (this.isPrivateIP(ip)) {
      throw new Error('Cannot geolocate private IP address');
    }

    try {
      const response = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country,regionName,query`
      );

      if (!response.ok) {
        throw new Error(`IP-API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        throw new Error('IP geolocation failed');
      }

      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city,
        country: data.country,
        region: data.regionName,
        accuracy: 50, // ip-api.com typical accuracy is ~50km
      };
    } catch (error) {
      console.error('[GeoVerificationService] Error getting location:', error);
      throw error;
    }
  }

  /**
   * Verify that client-provided location matches IP-based location
   */
  async verifyLocation(
    clientLat: number,
    clientLng: number,
    ip: string
  ): Promise<GeoVerificationResult> {
    // Skip verification if disabled
    if (!this.enabled) {
      return {
        verified: true,
        serverLocation: {
          lat: clientLat,
          lng: clientLng,
          city: 'Unknown',
          country: 'Unknown',
          accuracy: 0,
        },
        clientLat,
        clientLng,
        discrepancyKm: 0,
        message: 'Geo-verification disabled',
      };
    }

    // Skip for private IPs (development)
    if (this.isPrivateIP(ip)) {
      return {
        verified: true,
        serverLocation: {
          lat: clientLat,
          lng: clientLng,
          city: 'Localhost',
          country: 'Local',
          accuracy: 0,
        },
        clientLat,
        clientLng,
        discrepancyKm: 0,
        message: 'Private IP address (development)',
      };
    }

    try {
      const serverLocation = await this.getLocation(ip);
      const discrepancyKm = this.calculateDistance(
        clientLat,
        clientLng,
        serverLocation.lat,
        serverLocation.lng
      );

      const verified = discrepancyKm <= this.maxDiscrepancyKm;

      return {
        verified,
        serverLocation,
        clientLat,
        clientLng,
        discrepancyKm,
        message: verified
          ? `Location verified (${discrepancyKm.toFixed(1)}km discrepancy)`
          : `Location mismatch (${discrepancyKm.toFixed(1)}km discrepancy exceeds ${this.maxDiscrepancyKm}km limit)`,
      };
    } catch (error) {
      console.error('[GeoVerificationService] Verification error:', error);

      // Fail open in case of service errors (consider failing closed in production)
      return {
        verified: true,
        serverLocation: {
          lat: clientLat,
          lng: clientLng,
          city: 'Unknown',
          country: 'Unknown',
          accuracy: 0,
        },
        clientLat,
        clientLng,
        discrepancyKm: 0,
        message: 'Verification service unavailable',
      };
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Check if an IP is private/localhost
   */
  private isPrivateIP(ip: string): boolean {
    // Localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return true;
    }

    // Private IPv4 ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
    ];

    return privateRanges.some((range) => range.test(ip));
  }

  /**
   * Check if geo-verification is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
