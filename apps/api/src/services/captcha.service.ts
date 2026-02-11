/**
 * hCaptcha Verification Service
 * 
 * Protects against bot attacks by verifying hCaptcha tokens
 * Free tier: 100,000 requests/month
 */

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

  /**
   * Verify a hCaptcha token
   * @param token - The hCaptcha response token from the client
   * @param ip - Optional IP address of the user (for additional verification)
   * @returns true if verification succeeds, false otherwise
   */
  async verify(token: string, ip?: string): Promise<boolean> {
    // Skip verification if CAPTCHA is disabled (for development)
    if (!this.enabled) {
      console.warn('[CaptchaService] CAPTCHA verification skipped (disabled)');
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

      // Include IP address if provided (optional but recommended)
      if (ip) {
        params.append('remoteip', ip);
      }

      const response = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.success) {
        console.log('[CaptchaService] CAPTCHA verification successful');
        return true;
      } else {
        console.error('[CaptchaService] CAPTCHA verification failed:', data['error-codes']);
        return false;
      }
    } catch (error) {
      console.error('[CaptchaService] CAPTCHA verification error:', error);
      // Fail open in case of service issues (consider failing closed in production)
      return false;
    }
  }

  /**
   * Check if CAPTCHA is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
