/**
 * Domain matching logic for URL whitelisting/blocklisting.
 * Pure functions, no vscode deps.
 */

export interface DomainMatch {
  allowed: boolean;
  domain: string;
  matchedRule: string;
  reason: string;
}

export function checkDomainAllowed(
  url: string,
  mode: "allowlist" | "blocklist",
  allowedDomains: string[],
  blockedDomains: string[]
): DomainMatch {
  const domain = extractDomain(url);
  if (!domain) {
    return { allowed: true, domain: "", matchedRule: "", reason: "Could not parse domain" };
  }

  if (mode === "allowlist") {
    for (const pattern of allowedDomains) {
      if (matchDomainPattern(domain, pattern)) {
        return { allowed: true, domain, matchedRule: pattern, reason: "Domain in allowlist" };
      }
    }
    return {
      allowed: false,
      domain,
      matchedRule: "",
      reason: `Domain "${domain}" not in allowlist`,
    };
  }

  for (const pattern of blockedDomains) {
    if (matchDomainPattern(domain, pattern)) {
      return {
        allowed: false,
        domain,
        matchedRule: pattern,
        reason: `Domain "${domain}" is blocked`,
      };
    }
  }
  return { allowed: true, domain, matchedRule: "", reason: "Domain not in blocklist" };
}

export function extractDomain(url: string): string {
  try {
    let normalized = url.trim();
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }
    const parsed = new URL(normalized);
    return parsed.hostname.toLowerCase();
  } catch {
    const match = url.match(/(?:https?:\/\/)?([^/:?\s#]+)/i);
    return match ? match[1].toLowerCase() : "";
  }
}

export function matchDomainPattern(domain: string, pattern: string): boolean {
  const lowerDomain = domain.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  if (lowerPattern.startsWith("*.")) {
    const suffix = lowerPattern.slice(2);
    return lowerDomain === suffix || lowerDomain.endsWith(`.${suffix}`);
  }

  return lowerDomain === lowerPattern;
}
