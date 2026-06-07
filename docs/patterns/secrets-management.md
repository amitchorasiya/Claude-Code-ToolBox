# Pattern: Secrets Management

Secrets NEVER appear in client-side code, committed files, or frontend bundles. Period.

## Environment Variables (All Stacks)

```bash
# .env.local (NEVER committed to git)
DATABASE_URL=postgresql://user:pass@host:5432/db
STRIPE_SECRET_KEY=sk_live_...
JWT_SECRET=your-256-bit-secret
SENDGRID_API_KEY=SG...

# .env.example (committed — shows structure without values)
DATABASE_URL=
STRIPE_SECRET_KEY=
JWT_SECRET=
SENDGRID_API_KEY=
```

## .gitignore (Required)

```gitignore
# Secrets — NEVER commit these
.env
.env.local
.env.production
.env.*.local
*.pem
*.key
credentials.json
service-account.json
```

## Server-Side Access (Node.js)

```javascript
// CORRECT: Server-side only
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// WRONG: This exposes the key in the client bundle
// const stripe = new Stripe('sk_live_actual_key_here');
```

## Next.js Public vs Private

```javascript
// Private (server-side only) — no NEXT_PUBLIC_ prefix
const dbUrl = process.env.DATABASE_URL;

// Public (safe for client) — use NEXT_PUBLIC_ prefix ONLY for non-secret values
const appName = process.env.NEXT_PUBLIC_APP_NAME;

// NEVER do this:
// NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_...  ← EXPOSED TO BROWSER
```

## Supabase Specific

```javascript
// CORRECT: Use the anon key (public, limited by RLS) in the client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  // This is designed to be public
);

// The service_role key MUST stay server-side only
// It bypasses RLS — never expose it
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Server-side only!
);
```

## CI/CD Secrets

```yaml
# GitHub Actions — use repository secrets
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  STRIPE_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
```

## Rules

1. If a variable contains a secret, it gets NO `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` prefix
2. `.env` files with real values are NEVER committed (use `.env.example` for structure)
3. Production secrets live in your hosting platform's secret store (Vercel, AWS SSM, etc.)
4. Rotate secrets immediately if they ever appear in a commit (even if you force-push)
5. Use secret scanning (GitHub, GitGuardian, or pre-commit hooks) to catch accidental commits
