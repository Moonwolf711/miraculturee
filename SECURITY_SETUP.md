# MiraCulture Security System Setup Guide

## Overview

This guide covers the setup and configuration of MiraCulture's comprehensive security system, which includes:

1. **Cryptographic Commitment Scheme** - Provably fair raffle draws
2. **hCAPTCHA** - Bot protection
3. **VPN/Proxy Detection** - Location spoofing prevention
4. **Server-Side Geo-Verification** - IP-based location validation

---

## 🔐 Security Features

### 1. Cryptographic Commitment Scheme

**What it does:**
- Generates a cryptographic seed before each raffle draw
- Publishes the hash of the seed (commitment) before entries close
- Reveals the seed after the draw for public verification
- Anyone can independently verify the draw results

**How it works:**
```
1. Pool closes → Generate random seed → Hash seed (SHA-256)
2. Publish hash publicly (commitment)
3. Run draw using deterministic RNG seeded with the seed
4. Reveal seed after draw
5. Anyone can verify: hash(revealed_seed) == published_hash
6. Anyone can re-run draw with revealed seed and verify results match
```

**API Endpoints:**
- `POST /raffle/:poolId/close` - Close pool and publish seed hash
- `GET /raffle/:poolId/verify` - Verify draw fairness

**No configuration required** - Works out of the box!

---

### 2. hCAPTCHA (Bot Protection)

**What it does:**
- Prevents bots from automating purchases and raffle entries
- Privacy-focused alternative to Google reCAPTCHA
- GDPR compliant

**Setup:**

#### Step 1: Get hCaptcha Keys
1. Go to https://www.hcaptcha.com/
2. Sign up for a free account
3. Create a new site
4. Copy your **Site Key** and **Secret Key**

#### Step 2: Configure Backend
Add to `apps/api/.env`:
```bash
CAPTCHA_ENABLED=true
HCAPTCHA_SECRET_KEY=0x0000000000000000000000000000000000000000
```

#### Step 3: Configure Frontend
Add to `apps/web/.env`:
```bash
VITE_HCAPTCHA_SITE_KEY=00000000-0000-0000-0000-000000000000
```

#### Step 4: Update Components
Replace `StripeCheckout` with `StripeCheckoutWithCaptcha` in your components:

```tsx
import StripeCheckoutWithCaptcha from '../components/StripeCheckoutWithCaptcha';

const [captchaToken, setCaptchaToken] = useState<string | null>(null);

<StripeCheckoutWithCaptcha
  clientSecret={clientSecret}
  onSuccess={handleSuccess}
  onError={handleError}
  onCaptchaVerify={setCaptchaToken}
  title="Complete Purchase"
/>
```

#### Step 5: Include Token in API Calls
```tsx
const response = await fetch('/api/support/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId,
    ticketCount,
    message,
    captchaToken, // Include this
  }),
});
```

**Free Tier:** 100,000 requests/month

---

### 3. VPN/Proxy Detection

**What it does:**
- Detects VPN, proxy, and Tor connections
- Prevents users from spoofing their location
- Logs suspicious activity for review

**Setup:**

#### Option A: Free Tier (Recommended for Launch)
Uses `ip-api.com` (free, no API key required)

Add to `apps/api/.env`:
```bash
VPN_DETECTION_ENABLED=true
# No API key needed for free tier
```

#### Option B: Premium Service (Better Accuracy)
Uses `vpnapi.io` (free tier: 1,000 requests/day)

1. Go to https://vpnapi.io/
2. Sign up and get API key
3. Add to `apps/api/.env`:
```bash
VPN_DETECTION_ENABLED=true
VPNAPI_KEY=your_vpnapi_key_here
```

**How it works:**
- Checks IP address against VPN/proxy databases
- Calculates risk score (0-100)
- Blocks high-risk connections
- Logs suspicious activity to `SuspiciousActivity` table

**Free Tier:**
- vpnapi.io: 1,000 requests/day
- ip-api.com: 45 requests/minute (fallback)

---

### 4. Server-Side Geo-Verification

**What it does:**
- Gets user's location from IP address (server-side)
- Compares with client-provided location
- Rejects entries if discrepancy exceeds threshold
- Uses server location for raffle validation (prevents spoofing)

**Setup:**

Add to `apps/api/.env`:
```bash
GEO_VERIFICATION_ENABLED=true
GEO_MAX_DISCREPANCY_KM=100
```

**How it works:**
```
1. User submits raffle entry with lat/lng
2. Server gets IP-based location (ip-api.com)
3. Calculate distance between client and server locations
4. If discrepancy > 100km → Reject and log suspicious activity
5. Use SERVER location for raffle validation (not client)
```

**No API key required** - Uses `ip-api.com` (free tier: 45 requests/minute)

---

## 📋 Complete Environment Variables

### Backend (`apps/api/.env`)
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Stripe
STRIPE_SECRET_KEY=sk_test_...

# Security Features
CAPTCHA_ENABLED=true
HCAPTCHA_SECRET_KEY=0x0000000000000000000000000000000000000000

VPN_DETECTION_ENABLED=true
VPNAPI_KEY=your_vpnapi_key_here  # Optional, has fallback

GEO_VERIFICATION_ENABLED=true
GEO_MAX_DISCREPANCY_KM=100
```

### Frontend (`apps/web/.env`)
```bash
VITE_API_URL=https://api.miraculture.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_HCAPTCHA_SITE_KEY=00000000-0000-0000-0000-000000000000
```

---

## 🗄️ Database Migration

Run the migration to add security fields:

```bash
cd apps/api
psql $DATABASE_URL < prisma/migrations/add_security_features.sql
```

Or manually run:
```sql
-- Add cryptographic commitment fields to RafflePool
ALTER TABLE "RafflePool" ADD COLUMN "seedHash" TEXT;
ALTER TABLE "RafflePool" ADD COLUMN "revealedSeed" TEXT;
ALTER TABLE "RafflePool" ADD COLUMN "algorithm" TEXT NOT NULL DEFAULT 'SHA-256 + Fisher-Yates + Seedrandom';
ALTER TABLE "RafflePool" ADD COLUMN "verificationUrl" TEXT;

-- Create SuspiciousActivity table
CREATE TABLE "SuspiciousActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "riskScore" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuspiciousActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SuspiciousActivity_userId_idx" ON "SuspiciousActivity"("userId");
CREATE INDEX "SuspiciousActivity_ip_idx" ON "SuspiciousActivity"("ip");
CREATE INDEX "SuspiciousActivity_type_idx" ON "SuspiciousActivity"("type");
CREATE INDEX "SuspiciousActivity_createdAt_idx" ON "SuspiciousActivity"("createdAt");

ALTER TABLE "SuspiciousActivity" ADD CONSTRAINT "SuspiciousActivity_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 🧪 Testing

### Test CAPTCHA
1. Set `CAPTCHA_ENABLED=false` in development
2. Test payment flows without CAPTCHA
3. Enable CAPTCHA and verify widget appears
4. Submit without solving → Should fail
5. Solve CAPTCHA → Should succeed

### Test VPN Detection
1. Use a VPN service
2. Try to enter a raffle
3. Should be blocked with error: "VPN, proxy, or Tor connections are not allowed"
4. Check `SuspiciousActivity` table for logged entry

### Test Geo-Verification
1. Submit raffle entry with fake coordinates (e.g., Tokyo when you're in Denver)
2. Should be blocked with error: "Location verification failed. Your IP location is XXXkm from your reported location."
3. Check `SuspiciousActivity` table for logged entry

### Test Cryptographic Commitment
1. Create a raffle pool
2. Close the pool: `POST /raffle/:poolId/close`
3. Check response for `seedHash`
4. Run the draw
5. Verify: `GET /raffle/:poolId/verify`
6. Response should show:
   - `hashValid: true` (hash matches revealed seed)
   - `resultsValid: true` (draw results match expected)
   - `verified: true` (overall verification passed)

---

## 🚀 Deployment Checklist

### Railway Deployment

1. **Add Environment Variables**
   - Go to Railway project → Variables
   - Add all backend env vars from above
   - Restart API service

2. **Run Database Migration**
   ```bash
   # Connect to Railway database
   railway connect
   # Run migration
   psql $DATABASE_URL < apps/api/prisma/migrations/add_security_features.sql
   ```

3. **Deploy Frontend**
   - Add frontend env vars to Railway
   - Redeploy web service

4. **Verify Deployment**
   - Check API logs for: `[Security] Services initialized:`
   - Should show which features are enabled
   - Test raffle entry with CAPTCHA

---

## 📊 Monitoring Suspicious Activity

Query suspicious activity:
```sql
-- Recent suspicious activity
SELECT * FROM "SuspiciousActivity" 
ORDER BY "createdAt" DESC 
LIMIT 100;

-- Top offenders
SELECT "userId", "type", COUNT(*) as count
FROM "SuspiciousActivity"
GROUP BY "userId", "type"
ORDER BY count DESC;

-- High-risk IPs
SELECT "ip", AVG("riskScore") as avg_risk, COUNT(*) as attempts
FROM "SuspiciousActivity"
WHERE "riskScore" > 50
GROUP BY "ip"
ORDER BY avg_risk DESC;
```

---

## 💰 Cost Estimate

| Service | Free Tier | Cost After Free Tier |
|---------|-----------|----------------------|
| hCaptcha | 100k requests/month | $0.50/1k requests |
| vpnapi.io | 1,000 requests/day | $10/month for 100k |
| ip-api.com | 45 requests/minute | $13/month for commercial |
| Cryptographic Commitment | Free (built-in) | Free |

**Launch Cost:** $0/month (free tiers sufficient)

**Scale Cost** (10k users/month): ~$20-30/month

---

## 🔧 Troubleshooting

### CAPTCHA not showing
- Check `VITE_HCAPTCHA_SITE_KEY` is set in frontend `.env`
- Check browser console for errors
- Verify site key is correct (not secret key)

### VPN detection not working
- Check `VPN_DETECTION_ENABLED=true` in backend `.env`
- Check API logs for VPN detection errors
- Verify IP is public (not localhost/private)

### Geo-verification failing in development
- Set `GEO_VERIFICATION_ENABLED=false` for local development
- Or use a public IP for testing

### Raffle verification failing
- Ensure pool was closed before drawing (`POST /raffle/:poolId/close`)
- Check `seedHash` and `revealedSeed` are both set in database
- Verify `seedrandom` package is installed

---

## 📚 Additional Resources

- [hCaptcha Documentation](https://docs.hcaptcha.com/)
- [vpnapi.io Documentation](https://vpnapi.io/docs)
- [ip-api.com Documentation](https://ip-api.com/docs)
- [Cryptographic Commitment Schemes](https://en.wikipedia.org/wiki/Commitment_scheme)

---

## ✅ Security Checklist

Before launch, verify:

- [ ] hCaptcha keys configured (frontend + backend)
- [ ] CAPTCHA appears on all payment flows
- [ ] VPN detection enabled and tested
- [ ] Geo-verification enabled and tested
- [ ] Database migration applied
- [ ] Raffle verification endpoint tested
- [ ] Suspicious activity logging working
- [ ] All environment variables set in Railway
- [ ] Security features enabled in production
- [ ] Monitoring dashboard set up for suspicious activity

---

**Questions?** Check the code comments in:
- `apps/api/src/services/captcha.service.ts`
- `apps/api/src/services/vpn-detection.service.ts`
- `apps/api/src/services/geo-verification.service.ts`
- `apps/api/src/services/raffle.service.ts`
