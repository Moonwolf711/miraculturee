export class CaptchaService {
  private secretKey: string;
  private enabled: boolean;

  constructor() {
    this.secretKey = process.env.HCAPTCHA_SECRET_KEY || '';
    this.enabled = process.env.CAPTCHA_ENABLED === 'true';

    if (this.enabled && !this.secretKey) {
      console.warn('[CaptchaService] CAPTCHA is enabled but HCAPTCHA_SECRET_KEY is not set');
    }
  }

  async verify(token: string | undefined, ip?: string): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    if (!token) {
      console.error('[CaptchaService] No CAPTCHA token provided');
      return false;
    }

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      });

      if (ip) {
        params.append('remoteip', ip);
      }

      const response = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await response.json() as { success: boolean; 'error-codes'?: string[] };

      if (data.success) {
        return true;
      } else {
        console.error('[CaptchaService] Verification failed:', data['error-codes']);
        return false;
      }
    } catch (error) {
      console.error('[CaptchaService] Verification error:', error);
      return false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
