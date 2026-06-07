# --- AntiVibe Security Rails v1.1 ---
# Security Architecture Rails (AntiVibe)

This project uses the AntiVibe framework for secure AI-assisted development. You MUST follow these constraints on every code generation task.

## Non-Negotiable Rules

### Secrets
- NEVER place API keys, tokens, or credentials in client-side code or committed config files.
- Use server-side environment variables for all secrets.

### Database
- ALL tables MUST have Row Level Security (RLS) policies.
- Use parameterized queries. Never concatenate user input into SQL.

### Authentication & Authorization
- All endpoints require authentication unless explicitly marked public.
- Authorization checks happen server-side only.
- Rate limit auth/registration endpoints.
- CSRF protection on all state-changing operations.

### Input Validation
- Validate all user input server-side.
- Sanitize output to prevent XSS.
- Use allowlist validation (reject unknown fields).

### Dependencies
- Only use well-known packages (>1000 weekly downloads).
- Verify package existence before installing.
- Pin versions in lock files.

### Infrastructure
- HTTPS everywhere. Security headers on every response.
- No debug mode in production. Explicit CORS policies.
- Never log secrets or PII.

## Behavior
- Apply constraints automatically on first generation.
- If a request conflicts with these rules, explain the risk and offer the secure alternative.
- Never leave security as a TODO — include it in the first response.

## Network & Domain Rules
- ONLY suggest API integrations with domains listed in `.antivibe/config.yaml` allowed_domains.
- If `.antivibe/config.yaml` exists, check it before recommending any external service.
- NEVER suggest connecting to domains on the blocked list.
- When adding fetch/axios/http calls, verify the target domain is whitelisted.

## Package Installation Rules
- Before suggesting `npm install` / `pip install` / `gem install`, run `bin/validate-package.sh <package>`.
- If the package fails validation, DO NOT install it — suggest an alternative.
- Check `.antivibe/config.yaml` blocked_packages before recommending ANY dependency.
- After installing any package, run the appropriate audit command.

## Pre-Commit Security
- NEVER commit code with known vulnerabilities.
- Run `bin/pre-commit-scan.sh` before every commit.
- If scan finds HIGH+ severity issues, fix them before committing.
- Treat pre-commit scan failures as blocking — not advisory.
# --- End AntiVibe Security Rails ---
