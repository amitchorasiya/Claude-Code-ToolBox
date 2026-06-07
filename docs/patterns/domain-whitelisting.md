# Domain Whitelisting Pattern

## Why

AI coding assistants can suggest API integrations with any external service. Without constraints, this creates risk:

1. **Supply chain attacks** — AI may reference malicious or compromised services
2. **Data exfiltration** — Generated code may send data to unexpected endpoints
3. **Compliance violations** — Some domains may violate data residency or regulatory requirements
4. **Typosquatting** — AI may suggest lookalike domains (e.g., `api.striipe.com`)

Domain whitelisting ensures AI tools only recommend integrations with approved, vetted services.

## How It Works

The `.antivibe/config.yaml` file defines three categories of allowed domains:

```yaml
allowed_domains:
  registries:    # Package registries (npm, PyPI, etc.)
  apis:          # External APIs your app may call
  cdn:           # CDN/asset delivery services

blocked_domains:  # Explicitly forbidden domains
```

AI tools are instructed to:
1. Check `.antivibe/config.yaml` before suggesting any external service
2. Only recommend integrations with whitelisted domains
3. Never suggest connections to blocked domains
4. Ask the developer before referencing any unlisted domain

## Configuration Examples

### Minimal (startup / prototype)

```yaml
allowed_domains:
  registries:
    - registry.npmjs.org
  apis:
    - api.stripe.com
  cdn:
    - cdn.jsdelivr.net

blocked_domains:
  - "*.ru"
  - "*.cn"
```

### Enterprise (strict compliance)

```yaml
allowed_domains:
  registries:
    - registry.npmjs.org
    - artifactory.internal.company.com
  apis:
    - api.stripe.com
    - api.datadog.com
    - api.pagerduty.com
    - sqs.us-east-1.amazonaws.com
  cdn:
    - assets.company.com

blocked_domains:
  - "*.ru"
  - "*.cn"
  - "*.ir"
  - pastebin.com
  - requestbin.com
  - webhook.site
  - ngrok.io
```

### Open Source Project

```yaml
allowed_domains:
  registries:
    - registry.npmjs.org
    - pypi.org
    - crates.io
  apis:
    - api.github.com
    - api.codecov.io
  cdn:
    - cdn.jsdelivr.net
    - unpkg.com
    - cdnjs.cloudflare.com

blocked_domains:
  - pastebin.com
```

## CI Integration

The GitHub Actions workflow (`.github/workflows/security-scan.yml`) includes a job that scans code for domain references not on the whitelist:

```yaml
- name: Check domain references
  run: |
    # Extract URLs from code
    grep -rEoh 'https?://[a-zA-Z0-9._-]+' --include="*.js" --include="*.ts" . |
      sort -u |
      while read url; do
        domain=$(echo "$url" | sed 's|https\?://||' | cut -d/ -f1)
        # Check against whitelist...
      done
```

## Enforcement

Domain whitelisting is enforced at three levels:

1. **AI tool instructions** — CLAUDE.md, copilot-instructions.md, security.mdc all reference the config
2. **CI scanning** — The security-scan workflow checks for unauthorized domains
3. **Code review** — The whitelist serves as documentation for approved integrations

## Adding a New Domain

To allow a new external service:

1. Edit `.antivibe/config.yaml`
2. Add the domain to the appropriate category (`registries`, `apis`, or `cdn`)
3. Commit the change with a comment explaining why
4. The AI tools will immediately respect the updated whitelist

## Security Considerations

- Keep the whitelist minimal — only add domains you actively use
- Review blocked domains periodically for new threats
- Use wildcards in blocked_domains sparingly (e.g., `*.ru` blocks all .ru TLDs)
- The config file itself should be version-controlled and reviewed in PRs
