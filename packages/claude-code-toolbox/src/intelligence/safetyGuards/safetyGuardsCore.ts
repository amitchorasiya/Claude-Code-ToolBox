/**
 * Pure logic: types, default patterns, domain lists.
 * No vscode imports — unit-testable.
 */

export type DestructiveCommandMode = "block" | "warn";
export type DomainWhitelistMode = "allowlist" | "blocklist";

export interface SafetyGuardsConfig {
  enabled: boolean;
  destructiveCommands: {
    enabled: boolean;
    mode: DestructiveCommandMode;
    patterns: string[];
    allowOverrides: string[];
  };
  domainWhitelist: {
    enabled: boolean;
    mode: DomainWhitelistMode;
    domains: string[];
    blockedDomains: string[];
  };
}

export const DEFAULT_DESTRUCTIVE_PATTERNS: string[] = [
  "rm -rf",
  "rm -fr",
  "rm -r /",
  "rmdir /s",
  "del /f /s /q",
  "git push --force",
  "git push -f",
  "git reset --hard",
  "git branch -D",
  "git branch -d -f",
  "git checkout -- .",
  "git checkout .",
  "git restore .",
  "git clean -f",
  "git clean -fd",
  "git clean -fdx",
  "DROP TABLE",
  "DROP DATABASE",
  "DROP SCHEMA",
  "TRUNCATE TABLE",
  "TRUNCATE",
  "DELETE FROM",
  "curl|sh",
  "curl|bash",
  "wget|sh",
  "wget|bash",
  "chmod 777",
  "chmod -R 777",
  "mkfs",
  "dd if=",
  "> /dev/sda",
  ":(){ :|:& };:",
  "kill -9 1",
  "killall",
  "pkill -9",
  "npm publish",
  "npx rimraf /",
];

export const DEFAULT_ALLOWED_DOMAINS: string[] = [
  "github.com",
  "*.github.com",
  "raw.githubusercontent.com",
  "api.github.com",
  "stackoverflow.com",
  "*.stackoverflow.com",
  "npmjs.com",
  "*.npmjs.com",
  "registry.npmjs.org",
  "pypi.org",
  "*.pypi.org",
  "developer.mozilla.org",
  "*.readthedocs.io",
  "docs.rs",
  "pkg.go.dev",
  "crates.io",
  "rubygems.org",
  "maven.org",
  "*.maven.org",
  "docs.python.org",
  "nodejs.org",
  "typescriptlang.org",
  "*.typescriptlang.org",
  "react.dev",
  "vuejs.org",
  "angular.io",
  "nextjs.org",
  "vercel.com",
  "*.cloudflare.com",
  "wikipedia.org",
  "*.wikipedia.org",
  "arxiv.org",
  "*.google.com",
  "*.microsoft.com",
  "learn.microsoft.com",
  "*.amazonaws.com",
  "docs.aws.amazon.com",
];

export const DEFAULT_BLOCKED_DOMAINS: string[] = [
  "pastebin.com",
  "*.paste.ee",
  "hastebin.com",
  "transfer.sh",
  "file.io",
];
