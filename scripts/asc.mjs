#!/usr/bin/env node
/**
 * App Store Connect API client — zero dependencies, built on node:crypto.
 *
 * Replaces the Java Spring Boot / Jwts.builder example with a tight Node
 * script that correctly generates ES256 JWTs for api.appstoreconnect.apple.com.
 *
 * IMPORTANT difference from the Java example:
 *   The Java example uses jjwt `.signWith(pk)` which produces a DER-encoded
 *   ASN.1 signature. Apple's JWT validator REJECTS that — it requires the
 *   raw IEEE P1363 r||s concatenation (64 bytes for P-256). We set
 *   `dsaEncoding: 'ieee-p1363'` on crypto.sign to get the correct format.
 *
 * Usage:
 *   ASC_KEY_FILE=~/.apple-keys/AuthKey_22TM26BJ8D.p8 \
 *   ASC_KEY_ID=22TM26BJ8D \
 *   ASC_ISSUER_ID=<your-uuid> \
 *   node scripts/asc.mjs <command> [args]
 *
 * Commands:
 *   whoami              — validates the key and dumps summary (DEFAULT)
 *   list-apps           — GET /v1/apps
 *   list-bundle-ids     — GET /v1/bundleIds
 *   list-certificates   — GET /v1/certificates
 *   list-profiles       — GET /v1/profiles
 *   list-devices        — GET /v1/devices
 *   register-bundle-id  — POST /v1/bundleIds for $ASC_BUNDLE_ID
 *   find-app            — look up the numeric Apple ID for $ASC_BUNDLE_ID
 *   create-app          — checks if App exists, prints manual-creation steps
 *                         if not (Apple's API does NOT allow POST /v1/apps)
 *   bootstrap           — run register-bundle-id + create-app in sequence
 *   raw <METHOD> <PATH>  — low-level passthrough (e.g. `raw GET /v1/apps/123`)
 *
 * Env vars (with defaults):
 *   ASC_KEY_FILE        — path to .p8 (REQUIRED, no default for security)
 *   ASC_KEY_ID          — Key ID from the .p8 filename (default: 22TM26BJ8D)
 *   ASC_ISSUER_ID       — UUID from appstoreconnect.apple.com → Integrations
 *                         (REQUIRED, no default)
 *   ASC_TEAM_ID         — Apple team ID (default: GMQY9LD9C2)
 *   ASC_BUNDLE_ID       — Bundle identifier (default: com.miraculturee.app)
 *   ASC_APP_NAME        — App Store display name (default: miraculturee)
 *   ASC_APP_SKU         — App Store SKU (default: MIRACULTUREE-IOS-001)
 *   ASC_PRIMARY_LOCALE  — Primary locale (default: en-US)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────

const cfg = {
  keyFile:
    process.env.ASC_KEY_FILE ||
    (() => {
      console.error(
        '[asc] ERROR: ASC_KEY_FILE env var is required.\n' +
          '       Point it at your .p8 private key file.\n' +
          '       RECOMMENDED: move the key off OneDrive / Desktop to a non-synced folder first, e.g.\n' +
          '         mkdir -p "$HOME/.apple-keys" && mv "/c/Users/Owner/OneDrive/Desktop/AuthKey_22TM26BJ8D.p8" "$HOME/.apple-keys/"\n' +
          '       Then: export ASC_KEY_FILE="$HOME/.apple-keys/AuthKey_22TM26BJ8D.p8"',
      );
      process.exit(2);
    })(),
  keyId: process.env.ASC_KEY_ID || '22TM26BJ8D',
  issuerId:
    process.env.ASC_ISSUER_ID ||
    (() => {
      console.error(
        '[asc] ERROR: ASC_ISSUER_ID env var is required.\n' +
          '       Find it at https://appstoreconnect.apple.com/access/integrations/api\n' +
          '       (top of the page, labeled "Issuer ID", UUID format).',
      );
      process.exit(2);
    })(),
  teamId: process.env.ASC_TEAM_ID || 'GMQY9LD9C2',
  bundleId: process.env.ASC_BUNDLE_ID || 'com.miraculturee.app',
  appName: process.env.ASC_APP_NAME || 'miraculturee',
  appSku: process.env.ASC_APP_SKU || 'MIRACULTUREE-IOS-001',
  primaryLocale: process.env.ASC_PRIMARY_LOCALE || 'en-US',
};

// Expand ~ in key path
if (cfg.keyFile.startsWith('~')) {
  cfg.keyFile = path.join(os.homedir(), cfg.keyFile.slice(1));
}

// ───────────────────────────────────────────────────────────────
// JWT signing (ES256, raw r||s signature for Apple)
// ───────────────────────────────────────────────────────────────

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt() {
  if (!fs.existsSync(cfg.keyFile)) {
    console.error(`[asc] ERROR: key file not found: ${cfg.keyFile}`);
    process.exit(2);
  }
  const privateKey = crypto.createPrivateKey({
    key: fs.readFileSync(cfg.keyFile, 'utf8'),
    format: 'pem',
  });
  const header = { alg: 'ES256', kid: cfg.keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: cfg.issuerId,
    iat: now,
    exp: now + 1200, // Apple caps JWT lifetime at 20 minutes
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;
  const signature = crypto.sign('SHA256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363', // critical: Apple rejects DER-encoded signatures
  });
  return `${signingInput}.${base64url(signature)}`;
}

// ───────────────────────────────────────────────────────────────
// HTTP helper
// ───────────────────────────────────────────────────────────────

const ASC_BASE = 'https://api.appstoreconnect.apple.com';

async function asc(method, endpoint, body) {
  const url = endpoint.startsWith('http') ? endpoint : `${ASC_BASE}${endpoint}`;
  const jwt = signJwt();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    console.error(
      `[asc] ${method} ${endpoint} → ${res.status} ${res.statusText}`,
    );
    console.error(JSON.stringify(parsed, null, 2));
    process.exit(1);
  }
  return parsed;
}

// ───────────────────────────────────────────────────────────────
// Commands
// ───────────────────────────────────────────────────────────────

const commands = {
  async whoami() {
    const stat = fs.statSync(cfg.keyFile);
    console.log('───────────────── ASC whoami ─────────────────');
    console.log(`Key file:     ${cfg.keyFile}`);
    console.log(`Key file size: ${stat.size} bytes`);
    console.log(`Key ID:       ${cfg.keyId}`);
    console.log(`Issuer ID:    ${cfg.issuerId}`);
    console.log(`Team ID:      ${cfg.teamId}`);
    console.log(`Bundle ID:    ${cfg.bundleId}`);
    console.log('──────────────────────────────────────────────');

    // Smoke test: list first 5 apps
    const apps = await asc('GET', '/v1/apps?limit=5');
    console.log(`\n✅ JWT authenticated. Found ${apps.data?.length ?? 0} apps (showing first 5):`);
    for (const app of apps.data ?? []) {
      console.log(
        `  • ${app.attributes.bundleId.padEnd(30)} ${app.attributes.name} [${app.id}]`,
      );
    }
  },

  async 'list-apps'() {
    const apps = await asc('GET', '/v1/apps?limit=200');
    console.log(JSON.stringify(apps, null, 2));
  },

  async 'list-bundle-ids'() {
    const bids = await asc('GET', '/v1/bundleIds?limit=200');
    console.log(`Found ${bids.data?.length ?? 0} bundle IDs:`);
    for (const b of bids.data ?? []) {
      console.log(
        `  • ${b.attributes.identifier.padEnd(40)} ${b.attributes.name} [${b.attributes.platform}]`,
      );
    }
  },

  async 'list-certificates'() {
    const certs = await asc('GET', '/v1/certificates?limit=200');
    console.log(`Found ${certs.data?.length ?? 0} certificates:`);
    for (const c of certs.data ?? []) {
      console.log(
        `  • ${c.attributes.certificateType.padEnd(25)} ${c.attributes.name} (exp ${c.attributes.expirationDate})`,
      );
    }
  },

  async 'list-profiles'() {
    const profs = await asc('GET', '/v1/profiles?limit=200');
    console.log(`Found ${profs.data?.length ?? 0} provisioning profiles:`);
    for (const p of profs.data ?? []) {
      console.log(
        `  • ${p.attributes.profileType.padEnd(25)} ${p.attributes.name} [${p.attributes.profileState}]`,
      );
    }
  },

  async 'list-devices'() {
    const devs = await asc('GET', '/v1/devices?limit=200');
    console.log(`Found ${devs.data?.length ?? 0} registered devices:`);
    for (const d of devs.data ?? []) {
      console.log(
        `  • ${d.attributes.deviceClass.padEnd(12)} ${d.attributes.name} (${d.attributes.udid})`,
      );
    }
  },

  async 'register-bundle-id'() {
    // Check if it already exists first
    const existing = await asc(
      'GET',
      `/v1/bundleIds?filter[identifier]=${encodeURIComponent(cfg.bundleId)}`,
    );
    if (existing.data && existing.data.length > 0) {
      console.log(
        `✅ Bundle ID ${cfg.bundleId} already registered: ${existing.data[0].id}`,
      );
      return existing.data[0];
    }
    console.log(`Registering new bundle ID: ${cfg.bundleId} …`);
    const created = await asc('POST', '/v1/bundleIds', {
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: cfg.bundleId,
          name: cfg.appName,
          platform: 'IOS',
        },
      },
    });
    console.log(`✅ Created bundle ID ${created.data.id}`);
    return created.data;
  },

  async 'find-app'() {
    // Query the app by bundleId. Returns the numeric App Store Connect
    // id if found, or exits non-zero if not found.
    const apps = await asc(
      'GET',
      `/v1/apps?filter[bundleId]=${encodeURIComponent(cfg.bundleId)}`,
    );
    if (apps.data && apps.data.length > 0) {
      const app = apps.data[0];
      console.log(`✅ App found: ${app.attributes.name}`);
      console.log(`   Numeric Apple ID (for codemagic.yaml): ${app.id}`);
      console.log(`   Bundle ID:     ${app.attributes.bundleId}`);
      console.log(`   SKU:           ${app.attributes.sku}`);
      console.log(`   Primary locale: ${app.attributes.primaryLocale}`);
      return app;
    }
    console.error(`[asc] No App Store Connect app record found for ${cfg.bundleId}.`);
    process.exit(1);
  },

  async 'create-app'() {
    // IMPORTANT: App Store Connect API does NOT support POST /v1/apps.
    // Attempting it returns 403 FORBIDDEN_ERROR with the message:
    //   "The resource 'apps' does not allow 'CREATE'.
    //    Allowed operations are: GET_COLLECTION, GET_INSTANCE, UPDATE"
    // App records can only be created through the web UI. This
    // command checks if the app already exists; if not, it prints
    // the exact manual steps with all fields pre-filled.

    // Ensure the bundle ID is registered first.
    const bundles = await asc(
      'GET',
      `/v1/bundleIds?filter[identifier]=${encodeURIComponent(cfg.bundleId)}`,
    );
    if (!bundles.data || bundles.data.length === 0) {
      console.error(
        `[asc] Bundle ID ${cfg.bundleId} is not registered. Run 'register-bundle-id' first.`,
      );
      process.exit(1);
    }

    // Check if an App record already exists for this bundle.
    const apps = await asc(
      'GET',
      `/v1/apps?filter[bundleId]=${encodeURIComponent(cfg.bundleId)}`,
    );
    if (apps.data && apps.data.length > 0) {
      const app = apps.data[0];
      console.log(`✅ App record already exists: ${app.id} (${app.attributes.name})`);
      console.log(
        `   → Paste this into codemagic.yaml APP_STORE_APPLE_ID: ${app.id}`,
      );
      return app;
    }

    // App doesn't exist — print manual steps (API cannot create it).
    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(' ⚠  Apple does not allow creating App records via API.');
    console.log(' Create it manually in the web UI (~90 seconds):');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('  1. Open: https://appstoreconnect.apple.com/apps');
    console.log('  2. Click the blue "+" (top left) → New App');
    console.log('  3. Fill in exactly these values:');
    console.log('       Platforms:        [x] iOS');
    console.log(`       Name:             ${cfg.appName}`);
    console.log(`       Primary Language: ${cfg.primaryLocale}`);
    console.log(`       Bundle ID:        ${cfg.bundleId}  (should now be in the dropdown)`);
    console.log(`       SKU:              ${cfg.appSku}`);
    console.log('       User Access:      Full Access');
    console.log('  4. Click "Create".');
    console.log('  5. Come back and run: node scripts/asc.mjs find-app');
    console.log('     That will print the numeric Apple ID to paste into codemagic.yaml.');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('');
    process.exit(2);
  },

  async bootstrap() {
    console.log('🏗  Bootstrapping App Store Connect for miraculturee …\n');
    await commands['register-bundle-id']();
    console.log('');
    await commands['create-app']();
  },

  async raw(method, endpoint) {
    if (!method || !endpoint) {
      console.error('[asc] usage: node scripts/asc.mjs raw <METHOD> <PATH>');
      process.exit(2);
    }
    const result = await asc(method.toUpperCase(), endpoint);
    console.log(JSON.stringify(result, null, 2));
  },
};

// ───────────────────────────────────────────────────────────────
// Entry point
// ───────────────────────────────────────────────────────────────

const [, , cmd = 'whoami', ...args] = process.argv;
const handler = commands[cmd];
if (!handler) {
  console.error(`[asc] Unknown command: ${cmd}`);
  console.error(`[asc] Available: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}
handler(...args).catch((err) => {
  console.error('[asc] FATAL:', err?.stack || err?.message || err);
  process.exit(1);
});
