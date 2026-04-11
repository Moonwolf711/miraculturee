# scripts/

Repo-level utility scripts. Not part of any app bundle.

## `asc.mjs` — App Store Connect API client

Zero-dependency Node.js client for the App Store Connect REST API. Replaces the Java/jjwt example from StackOverflow with a correct ES256 JWT implementation (uses `ieee-p1363` signature encoding — Apple rejects DER-encoded ASN.1 signatures, which is the #1 reason `401 Unauthorized` responses happen when porting from Java examples).

### One-time setup

```bash
# 1. Move the .p8 out of OneDrive (it's replicated to Microsoft's cloud right now).
mkdir -p "$HOME/.apple-keys"
mv "/c/Users/Owner/OneDrive/Desktop/AuthKey_22TM26BJ8D.p8" "$HOME/.apple-keys/"
chmod 600 "$HOME/.apple-keys/AuthKey_22TM26BJ8D.p8"

# 2. Export the env vars. Put these in ~/.bashrc or ~/.profile (NOT in the repo).
export ASC_KEY_FILE="$HOME/.apple-keys/AuthKey_22TM26BJ8D.p8"
export ASC_KEY_ID="22TM26BJ8D"
export ASC_ISSUER_ID="<UUID from appstoreconnect.apple.com/access/integrations/api>"
```

### Commands

```bash
# Smoke test — validates the key and lists the first 5 apps under the account
node scripts/asc.mjs whoami

# Full inventories
node scripts/asc.mjs list-apps
node scripts/asc.mjs list-bundle-ids
node scripts/asc.mjs list-certificates
node scripts/asc.mjs list-profiles
node scripts/asc.mjs list-devices

# Register com.miraculturee.app bundle ID (idempotent — checks if it exists first)
node scripts/asc.mjs register-bundle-id

# Look up the numeric Apple ID for the existing App record
node scripts/asc.mjs find-app

# App Store Connect API does NOT allow creating App records (Apple restriction —
# POST /v1/apps returns 403 FORBIDDEN_ERROR). This command checks if the
# app exists and, if not, prints the exact manual web-UI steps.
node scripts/asc.mjs create-app

# Do the bundle registration + app check in sequence
node scripts/asc.mjs bootstrap

# Low-level passthrough for ad-hoc calls
node scripts/asc.mjs raw GET /v1/apps/1234567890
node scripts/asc.mjs raw GET "/v1/apps?filter[bundleId]=com.miraculturee.app"
```

### Env var overrides

| Var | Default | Purpose |
|---|---|---|
| `ASC_KEY_FILE` | — (required) | Path to `.p8` private key |
| `ASC_KEY_ID` | `22TM26BJ8D` | Key ID from the `.p8` filename |
| `ASC_ISSUER_ID` | — (required) | Issuer UUID from App Store Connect |
| `ASC_TEAM_ID` | `GMQY9LD9C2` | Apple team ID |
| `ASC_BUNDLE_ID` | `com.miraculturee.app` | App bundle identifier |
| `ASC_APP_NAME` | `miraculturee` | Display name |
| `ASC_APP_SKU` | `MIRACULTUREE-IOS-001` | SKU (must be unique in team) |
| `ASC_PRIMARY_LOCALE` | `en-US` | Primary locale |

### Security

- The `.p8` file MUST NEVER be committed. Repo `.gitignore` has `*.p8` / `AuthKey_*.p8` / `*.p12` patterns so even an accidental `git add` is blocked.
- Do **not** hardcode `ASC_ISSUER_ID` into any committed file. It's not as sensitive as the private key but it's still an account identifier that can be used together with a leaked key.
- JWT lifetime is capped at 20 minutes per Apple's requirement; each script invocation generates a fresh token.
- The script runs entirely locally — no credentials are sent anywhere except to `api.appstoreconnect.apple.com`.
