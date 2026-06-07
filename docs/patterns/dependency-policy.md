# Pattern: Dependency Policy

Dependencies are a trust decision. Every package you install runs code on your machine and your users' machines.

## Before Adding Any Package

1. **Verify it exists** — search the registry (npm, PyPI) directly. AI tools hallucinate package names.
2. **Check popularity** — >1000 weekly downloads minimum. Unknown packages are a red flag.
3. **Check maintenance** — last published within 12 months. No abandoned packages.
4. **Check for known vulnerabilities** — `npm audit`, `pip-audit`, or Snyk.
5. **Review install scripts** — `preinstall`/`postinstall` scripts can run arbitrary code.

## Lock Files (Required)

```bash
# Always commit lock files
package-lock.json   # npm
yarn.lock           # Yarn
pnpm-lock.yaml      # pnpm
poetry.lock         # Python Poetry
Gemfile.lock        # Ruby
go.sum              # Go
```

Lock files pin exact versions. Without them, `npm install` on CI could pull a compromised minor version.

## Verification Commands

```bash
# Check if a package exists and get metadata
npm info <package-name>

# Check for known vulnerabilities
npm audit

# Python equivalent
pip-audit

# Check a package before installing (Socket.dev CLI)
socket npm info <package-name>
```

## Allowed vs Blocked Categories

### Prefer stdlib/framework built-ins for:
- Cryptography (use `crypto` module, not random npm packages)
- URL parsing (use `URL` built-in)
- HTTP requests (use `fetch`, not `got`/`axios`/`node-fetch` unless you need specific features)
- Path manipulation (use `path` module)
- UUID generation (use `crypto.randomUUID()`)

### Red flags — reject these:
- Packages with <100 weekly downloads
- Packages with no README or documentation
- Packages published in the last 7 days with no track record
- Packages that request filesystem/network access beyond their stated purpose
- Any package name you haven't verified exists on the registry

## Anti-Slopsquatting Checklist

Before running `npm install <package>` on AI-suggested packages:

```bash
# 1. Does this package actually exist?
npm info <package-name> 2>/dev/null || echo "DOES NOT EXIST"

# 2. When was it published? New + unknown = suspicious
npm info <package-name> time

# 3. Who maintains it? Known org or random account?
npm info <package-name> maintainers

# 4. How many downloads? Low = possibly a slopsquat
npm info <package-name> --json | jq '.dist-tags'
```

## Rules

1. Never blindly install AI-suggested packages without verification
2. Lock files are committed and never deleted
3. Run `npm audit` / `pip-audit` in CI on every PR
4. Prefer built-in solutions over third-party for security-critical code
5. New dependencies require explicit justification in the PR description
