/**
 * .claudeignore pattern matching: gitignore-subset using only Node.js built-ins.
 * Pure logic — no vscode imports.
 */

export const DEFAULT_CLAUDEIGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/*.lock",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/.git/**",
  "**/*.min.js",
  "**/*.min.css",
  "**/*.map",
  "**/*.bundle.js",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/vendor/**",
  "**/__pycache__/**",
  "**/*.pyc",
  "**/target/**",
  "**/bin/Debug/**",
  "**/bin/Release/**",
];

export const DEFAULT_CLAUDEIGNORE_CONTENT = `# .claudeignore — files Claude Code should avoid reading
# Patterns follow gitignore syntax (subset)
# Token Optimization uses this to warn (never block) on irrelevant file reads.

# Dependencies
**/node_modules/**
**/vendor/**
**/__pycache__/**

# Lock files
**/*.lock
**/package-lock.json
**/yarn.lock
**/pnpm-lock.yaml

# Build output
**/dist/**
**/build/**
**/out/**
**/target/**
**/bin/Debug/**
**/bin/Release/**
**/coverage/**
**/.next/**
**/.nuxt/**

# Minified / generated
**/*.min.js
**/*.min.css
**/*.map
**/*.bundle.js

# VCS internals
**/.git/**

# Large binary / media (optional — uncomment if needed)
# **/*.png
# **/*.jpg
# **/*.woff2
# **/*.ttf
`;

export function parseClaudeIgnore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function matchesClaudeIgnore(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  for (const pattern of patterns) {
    if (globMatch(normalized, pattern)) {
      return true;
    }
  }
  return false;
}

function globMatch(filePath: string, pattern: string): boolean {
  if (pattern.length > 500) return false;
  const regexStr = globToRegex(pattern);
  let re: RegExp;
  try {
    re = new RegExp(`^${regexStr}$`);
  } catch {
    return false;
  }
  return re.test(filePath) || re.test(`/${filePath}`);
}

function globToRegex(glob: string): string {
  let result = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          result += "(?:.+/)?";
          i += 3;
          continue;
        }
        result += ".*";
        i += 2;
        continue;
      }
      result += "[^/]*";
      i++;
    } else if (c === "?") {
      result += "[^/]";
      i++;
    } else if (c === ".") {
      result += "\\.";
      i++;
    } else if (c === "/") {
      result += "/";
      i++;
    } else {
      result += escapeRegexChar(c);
      i++;
    }
  }
  return result;
}

function escapeRegexChar(c: string): string {
  if ("^$+{}()|[]\\".includes(c)) {
    return `\\${c}`;
  }
  return c;
}
