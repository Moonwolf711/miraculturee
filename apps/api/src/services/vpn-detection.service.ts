/**
 * VPN/Proxy Detection Service
 * 
 * Detects VPNs, proxies, and Tor connections to prevent location spoofing
 * Uses vpnapi.io (free tier: 1,000 requests/day) with fallback to ip-api.com
 */

export interface VPNCheckResult {
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  riskScore: number;
  message?: string;
}

export class VPNDetectionService {
  private apiKey: string | undefined;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.VPNAPI_KEY;
    this.enabled = process.env.VPN_DETECTION_ENABLED === 'true';

    if (this.enabled && !this.apiKey) {
      console.warn('[VPNDetectionService] VPN detection enabled but VPNAPI_KEY not set, using fallback');
    }
  }

  /**
   * Check if an IP address is a VPN, proxy, or Tor node
   */
  async checkIP(ip: string): Promise<VPNCheckResult> {
    // Skip check if disabled
    if (!this.enabled) {
      return {
        isVPN: false,
        isProxy: false,
        isTor: false,
        isHosting: false,
        riskScore: 0,
        message: 'VPN detection disabled',
      };
    }

    // Skip localhost and private IPs
    if (this.isPrivateIP(ip)) {
      return {
        isVPN: false,
        isProxy: false,
        isTor: false,
        isHosting: false,
        riskScore: 0,
        message: 'Private IP address',
      };
    }

    try {
      // Try primary service (vpnapi.io) if API key is available
      if (this.apiKey) {
        return await this.checkWithVPNAPI(ip);
      }

      // Fallback to free service (ip-api.com)
      return await this.checkWithIPAPI(ip);
    } catch (error) {
      console.error('[VPNDetectionService] Error checking IP:', error);
      
      // Fail open (allow access) in case of service errors
      return {
        isVPN: false,
        isProxy: false,
        isTor: false,
        isHosting: false,
        riskScore: 0,
        message: 'Detection service unavailable',
      };
    }
  }

  /**
   * Check using vpnapi.io (premium service with free tier)
   */
  private async checkWithVPNAPI(ip: string): Promise<VPNCheckResult> {
    const response = await fetch(`https://vpnapi.io/api/${ip}?key=${this.apiKey}`);
    
    if (!response.ok) {
      throw new Error(`VPNAPI returned ${response.status}`);
    }

    const data = await response.json();

    const isVPN = data.security?.vpn === true;
    const isProxy = data.security?.proxy === true;
    const isTor = data.security?.tor === true;
    const isHosting = data.security?.hosting === true;

    return {
      isVPN,
      isProxy,
      isTor,
      isHosting,
      riskScore: this.calculateRiskScore({ isVPN, isProxy, isTor, isHosting }),
      message: 'Checked with vpnapi.io',
    };
  }

  /**
   * Check using ip-api.com (free service, no API key required)
   * Less accurate but good fallback
   */
  private async checkWithIPAPI(ip: string): Promise<VPNCheckResult> {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,proxy,hosting`
    );

    if (!response.ok) {
      throw new Error(`IP-API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('IP-API query failed');
    }

    const isProxy = data.proxy === true;
    const isHosting = data.hosting === true;

    return {
      isVPN: isHosting, // Hosting IPs are often VPNs
      isProxy,
      isTor: false, // ip-api.com doesn't detect Tor
      isHosting,
      riskScore: this.calculateRiskScore({ isVPN: isHosting, isProxy, isTor: false, isHosting }),
      message: 'Checked with ip-api.com (fallback)',
    };
  }

  /**
   * Calculate risk score (0-100) based on detection results
   */
  private calculateRiskScore(result: {
    isVPN: boolean;
    isProxy: boolean;
    isTor: boolean;
    isHosting: boolean;
  }): number {
    let score = 0;

    if (result.isVPN) score += 40;
    if (result.isProxy) score += 30;
    if (result.isTor) score += 50;
    if (result.isHosting) score += 20;

    return Math.min(score, 100);
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
   * Check if VPN detection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
