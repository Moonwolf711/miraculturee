import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { CaptchaService } from '../services/captcha.service.js';
import { VPNDetectionService } from '../services/vpn-detection.service.js';
import { GeoVerificationService } from '../services/geo-verification.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    captcha: CaptchaService;
    vpnDetection: VPNDetectionService;
    geoVerification: GeoVerificationService;
  }
}

async function securityPlugin(app: FastifyInstance) {
  const captcha = new CaptchaService();
  const vpnDetection = new VPNDetectionService();
  const geoVerification = new GeoVerificationService();

  app.decorate('captcha', captcha);
  app.decorate('vpnDetection', vpnDetection);
  app.decorate('geoVerification', geoVerification);

  app.log.info('[Security] Services initialized:');
  app.log.info(`  - CAPTCHA: ${captcha.isEnabled() ? 'ENABLED' : 'DISABLED'}`);
  app.log.info(`  - VPN Detection: ${vpnDetection.isEnabled() ? 'ENABLED' : 'DISABLED'}`);
  app.log.info(`  - Geo-Verification: ${geoVerification.isEnabled() ? 'ENABLED' : 'DISABLED'}`);
}

export default fp(securityPlugin);
