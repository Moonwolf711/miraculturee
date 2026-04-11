import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the miraculturee iOS wrapper.
 *
 * Architecture:
 *   - webDir points to `./www`, populated by `pnpm run copy:dist`
 *     (a copy of apps/web/dist after `pnpm --filter @miraculturee/web build`).
 *   - The iOS app bundles this web build and runs it inside WKWebView.
 *   - Live reload against a dev server is available by setting CAP_SERVER_URL
 *     (e.g. http://192.168.1.12:5173) at build time.
 */
const liveReloadUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.miraculturee.app',
  appName: 'miraculturee',
  webDir: 'www',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: true,
    scheme: 'miraculturee',
    backgroundColor: '#0a0a0a',
  },
  server: liveReloadUrl
    ? {
        url: liveReloadUrl,
        cleartext: false,
      }
    : {
        androidScheme: 'https',
        iosScheme: 'https',
        hostname: 'app.miraculturee.com',
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
