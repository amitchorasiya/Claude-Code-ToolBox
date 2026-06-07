import { describe, it, expect } from "vitest";
import { checkDomainAllowed, extractDomain, matchDomainPattern } from "./domainWhitelistCore";
import { DEFAULT_ALLOWED_DOMAINS, DEFAULT_BLOCKED_DOMAINS } from "./safetyGuardsCore";

describe("extractDomain", () => {
  it("extracts domain from full URL", () => {
    expect(extractDomain("https://github.com/user/repo")).toBe("github.com");
  });

  it("extracts domain from URL with path", () => {
    expect(extractDomain("https://docs.python.org/3/library/")).toBe("docs.python.org");
  });

  it("extracts domain from bare domain", () => {
    expect(extractDomain("npmjs.com")).toBe("npmjs.com");
  });

  it("handles URL with port", () => {
    expect(extractDomain("http://localhost:3000/api")).toBe("localhost");
  });

  it("lowercases domain", () => {
    expect(extractDomain("https://GitHub.COM/path")).toBe("github.com");
  });

  it("returns empty string for invalid input", () => {
    expect(extractDomain("")).toBe("");
  });
});

describe("matchDomainPattern", () => {
  it("matches exact domain", () => {
    expect(matchDomainPattern("github.com", "github.com")).toBe(true);
  });

  it("does not match different domain", () => {
    expect(matchDomainPattern("evil.com", "github.com")).toBe(false);
  });

  it("matches wildcard subdomain", () => {
    expect(matchDomainPattern("api.github.com", "*.github.com")).toBe(true);
  });

  it("matches wildcard for base domain", () => {
    expect(matchDomainPattern("github.com", "*.github.com")).toBe(true);
  });

  it("does not match unrelated domain with wildcard", () => {
    expect(matchDomainPattern("notgithub.com", "*.github.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchDomainPattern("GitHub.COM", "github.com")).toBe(true);
  });
});

describe("checkDomainAllowed — allowlist mode", () => {
  it("allows domain in allowlist", () => {
    const result = checkDomainAllowed(
      "https://github.com/repo",
      "allowlist",
      DEFAULT_ALLOWED_DOMAINS,
      []
    );
    expect(result.allowed).toBe(true);
  });

  it("allows subdomain via wildcard", () => {
    const result = checkDomainAllowed(
      "https://api.github.com/repos",
      "allowlist",
      DEFAULT_ALLOWED_DOMAINS,
      []
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks domain not in allowlist", () => {
    const result = checkDomainAllowed(
      "https://evil-site.com/payload",
      "allowlist",
      DEFAULT_ALLOWED_DOMAINS,
      []
    );
    expect(result.allowed).toBe(false);
    expect(result.domain).toBe("evil-site.com");
  });

  it("allows readthedocs.io subdomains", () => {
    const result = checkDomainAllowed(
      "https://flask.readthedocs.io/en/latest/",
      "allowlist",
      DEFAULT_ALLOWED_DOMAINS,
      []
    );
    expect(result.allowed).toBe(true);
  });
});

describe("checkDomainAllowed — blocklist mode", () => {
  it("blocks domain in blocklist", () => {
    const result = checkDomainAllowed(
      "https://pastebin.com/raw/abc",
      "blocklist",
      [],
      DEFAULT_BLOCKED_DOMAINS
    );
    expect(result.allowed).toBe(false);
  });

  it("allows domain not in blocklist", () => {
    const result = checkDomainAllowed(
      "https://github.com/repo",
      "blocklist",
      [],
      DEFAULT_BLOCKED_DOMAINS
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks transfer.sh", () => {
    const result = checkDomainAllowed(
      "https://transfer.sh/get/abc",
      "blocklist",
      [],
      DEFAULT_BLOCKED_DOMAINS
    );
    expect(result.allowed).toBe(false);
  });
});
