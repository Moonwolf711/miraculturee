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
  }

  async checkIP(ip: string): Promise<VPNCheckResult> {
    if (!this.enabled) {
      return { isVPN: false, isProxy: false, isTor: false, isHosting: false, riskScore: 0, message: 'VPN detection disabled' };
    }

    if (this.isPrivateIP(ip)) {
      return { isVPN: false, isProxy: false, isTor: false, isHosting: false, riskScore: 0, message: 'Private IP address' };
    }

    try {
      if (this.apiKey) {
        return await this.checkWithVPNAPI(ip);
      }
      return await this.checkWithIPAPI(ip);
    } catch (error) {
      console.error('[VPNDetectionService] Error checking IP:', error);
      return { isVPN: false, isProxy: false, isTor: false, isHosting: false, riskScore: 0, message: 'Detection service unavailable' };
    }
  }

  private async checkWithVPNAPI(ip: string): Promise<VPNCheckResult> {
    const response = await fetch(`https://vpnapi.io/api/${ip}?key=${this.apiKey}`);
    if (!response.ok) throw new Error(`VPNAPI returned ${response.status}`);

    const data = await response.json() as { security?: { vpn?: boolean; proxy?: boolean; tor?: boolean; hosting?: boolean } };
    const isVPN = data.security?.vpn === true;
    const isProxy = data.security?.proxy === true;
    const isTor = data.security?.tor === true;
    const isHosting = data.security?.hosting === true;

    return {
      isVPN, isProxy, isTor, isHosting,
      riskScore: this.calculateRiskScore({ isVPN, isProxy, isTor, isHosting }),
      message: 'Checked with vpnapi.io',
    };
  }

  private async checkWithIPAPI(ip: string): Promise<VPNCheckResult> {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,proxy,hosting`);
    if (!response.ok) throw new Error(`IP-API returned ${response.status}`);

    const data = await response.json() as { status: string; proxy?: boolean; hosting?: boolean };
    if (data.status !== 'success') throw new Error('IP-API query failed');

    const isProxy = data.proxy === true;
    const isHosting = data.hosting === true;

    return {
      isVPN: isHosting,
      isProxy,
      isTor: false,
      isHosting,
      riskScore: this.calculateRiskScore({ isVPN: isHosting, isProxy, isTor: false, isHosting }),
      message: 'Checked with ip-api.com (fallback)',
    };
  }

  private calculateRiskScore(result: { isVPN: boolean; isProxy: boolean; isTor: boolean; isHosting: boolean }): number {
    let score = 0;
    if (result.isVPN) score += 40;
    if (result.isProxy) score += 30;
    if (result.isTor) score += 50;
    if (result.isHosting) score += 20;
    return Math.min(score, 100);
  }

  private isPrivateIP(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    return [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./].some((r) => r.test(ip));
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
