#!/usr/bin/env bash
set -euo pipefail

# AntiVibe Pre-Commit Security Scanner
# =====================================
# Scans staged files for vulnerabilities before commit.
#
# Checks performed:
#   1. Hardcoded secrets (API keys, tokens, passwords)
#   2. SQL injection patterns (string concatenation in queries)
#   3. XSS patterns (innerHTML, dangerouslySetInnerHTML)
#   4. Dependency audit (if lock files changed)
#   5. Semgrep scan (if installed)
#
# Install as git hook:
#   cp bin/pre-commit-scan.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Exit codes:
#   0 = PASS (commit allowed)
#   1 = FAIL (commit blocked — HIGH+ severity issues found)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIG_FILE=".antivibe/config.yaml"
FINDINGS_HIGH=0
FINDINGS_MEDIUM=0
FINDINGS_LOW=0
SEVERITY_THRESHOLD="high"

# ─── Config loading ──────────────────────────────────────────────────

if [ -f "$CONFIG_FILE" ]; then
  THRESHOLD_FROM_CONFIG=$(grep -E '^\s*severity_threshold:' "$CONFIG_FILE" 2>/dev/null | sed 's/.*:\s*//' | tr -d '"' | tr -d ' ' || echo "")
  if [ -n "$THRESHOLD_FROM_CONFIG" ]; then
    SEVERITY_THRESHOLD="$THRESHOLD_FROM_CONFIG"
  fi
fi

# ─── Header ──────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AntiVibe Pre-Commit Security Scan      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Severity threshold: ${BLUE}${SEVERITY_THRESHOLD}${NC}"
echo ""

# ─── Get staged files ────────────────────────────────────────────────

# If in a git repo, get staged files; otherwise scan all files
if git rev-parse --git-dir &>/dev/null; then
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")
else
  # Not in a git repo — scan files in current directory (for manual runs)
  STAGED_FILES=$(find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" -o -name "*.rb" -o -name "*.go" -o -name "*.java" -o -name "*.sql" \) | head -100)
fi

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}No staged files to scan.${NC}"
  echo ""
  exit 0
fi

FILE_COUNT=$(echo "$STAGED_FILES" | wc -l | tr -d ' ')
echo -e "  Scanning ${BLUE}${FILE_COUNT}${NC} staged file(s)..."
echo ""

# ─── Check 1: Hardcoded Secrets ──────────────────────────────────────

echo -e "${BLUE}[1/5]${NC} Scanning for hardcoded secrets..."

# Patterns that indicate hardcoded secrets
SECRET_PATTERNS=(
  # API Keys (generic)
  '["\x27](?:api[_-]?key|apikey)["\x27]\s*[:=]\s*["\x27][a-zA-Z0-9_\-]{20,}["\x27]'
  # AWS Access Key
  'AKIA[0-9A-Z]{16}'
  # AWS Secret Key
  '["\x27]?aws[_-]?secret[_-]?access[_-]?key["\x27]?\s*[:=]\s*["\x27][A-Za-z0-9/+=]{40}["\x27]'
  # Generic token assignment
  '["\x27](?:token|secret|password|passwd|pwd)["\x27]\s*[:=]\s*["\x27][^\x27"]{8,}["\x27]'
  # Private key content
  '-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----'
  # Stripe key
  'sk_(?:live|test)_[a-zA-Z0-9]{24,}'
  # GitHub token
  'gh[pousr]_[A-Za-z0-9_]{36,}'
  # Slack token
  'xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}'
  # Generic password in connection string
  '://[^:]+:[^@]{8,}@'
)

SECRETS_FOUND=0

for file in $STAGED_FILES; do
  # Skip binary files, lock files, and this script itself
  case "$file" in
    *.lock|*.png|*.jpg|*.gif|*.ico|*.woff*|*.ttf|*.eot|*.svg|package-lock.json|yarn.lock|pnpm-lock.yaml)
      continue
      ;;
  esac

  [ -f "$file" ] || continue

  for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(grep -nEi "$pattern" "$file" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
      echo -e "  ${RED}HIGH${NC} — Potential secret in ${file}:"
      echo "$MATCHES" | head -3 | while read -r line; do
        echo -e "    ${RED}→${NC} $line"
      done
      SECRETS_FOUND=$((SECRETS_FOUND + 1))
      FINDINGS_HIGH=$((FINDINGS_HIGH + 1))
    fi
  done
done

if [ "$SECRETS_FOUND" -eq 0 ]; then
  echo -e "  ${GREEN}PASS${NC} — No hardcoded secrets detected"
fi

# ─── Check 2: SQL Injection ──────────────────────────────────────────

echo -e "${BLUE}[2/5]${NC} Scanning for SQL injection patterns..."

SQL_INJECTION_PATTERNS=(
  # String concatenation in SQL (JS/TS)
  'query\s*\(\s*[`"'\'']\s*SELECT.*\+\s*'
  'query\s*\(\s*[`"'\'']\s*INSERT.*\+\s*'
  'query\s*\(\s*[`"'\'']\s*UPDATE.*\+\s*'
  'query\s*\(\s*[`"'\'']\s*DELETE.*\+\s*'
  # f-string SQL (Python)
  'execute\s*\(\s*f["\x27].*(?:SELECT|INSERT|UPDATE|DELETE)'
  # String format SQL (Python)
  'execute\s*\(\s*["\x27].*%s.*%\s*\('
  # Ruby string interpolation in SQL
  'execute\s*\(\s*".*#\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)'
)

SQLI_FOUND=0

for file in $STAGED_FILES; do
  case "$file" in
    *.js|*.ts|*.jsx|*.tsx|*.py|*.rb|*.go|*.java|*.php)
      ;;
    *)
      continue
      ;;
  esac

  [ -f "$file" ] || continue

  for pattern in "${SQL_INJECTION_PATTERNS[@]}"; do
    MATCHES=$(grep -nEi "$pattern" "$file" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
      echo -e "  ${RED}HIGH${NC} — Potential SQL injection in ${file}:"
      echo "$MATCHES" | head -3 | while read -r line; do
        echo -e "    ${RED}→${NC} $line"
      done
      SQLI_FOUND=$((SQLI_FOUND + 1))
      FINDINGS_HIGH=$((FINDINGS_HIGH + 1))
    fi
  done
done

if [ "$SQLI_FOUND" -eq 0 ]; then
  echo -e "  ${GREEN}PASS${NC} — No SQL injection patterns detected"
fi

# ─── Check 3: XSS Patterns ──────────────────────────────────────────

echo -e "${BLUE}[3/5]${NC} Scanning for XSS patterns..."

XSS_PATTERNS=(
  # innerHTML assignment
  '\.innerHTML\s*='
  # dangerouslySetInnerHTML
  'dangerouslySetInnerHTML'
  # document.write
  'document\.write\s*\('
  # eval with variables
  'eval\s*\(\s*[^"'\''`]'
  # v-html (Vue)
  'v-html\s*='
  # bypassSecurityTrust (Angular)
  'bypassSecurityTrust'
)

XSS_FOUND=0

for file in $STAGED_FILES; do
  case "$file" in
    *.js|*.ts|*.jsx|*.tsx|*.vue|*.html|*.htm|*.php)
      ;;
    *)
      continue
      ;;
  esac

  [ -f "$file" ] || continue

  for pattern in "${XSS_PATTERNS[@]}"; do
    MATCHES=$(grep -nEi "$pattern" "$file" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
      echo -e "  ${YELLOW}MEDIUM${NC} — Potential XSS in ${file}:"
      echo "$MATCHES" | head -3 | while read -r line; do
        echo -e "    ${YELLOW}→${NC} $line"
      done
      XSS_FOUND=$((XSS_FOUND + 1))
      FINDINGS_MEDIUM=$((FINDINGS_MEDIUM + 1))
    fi
  done
done

if [ "$XSS_FOUND" -eq 0 ]; then
  echo -e "  ${GREEN}PASS${NC} — No XSS patterns detected"
fi

# ─── Check 4: Dependency audit ───────────────────────────────────────

echo -e "${BLUE}[4/5]${NC} Checking dependency changes..."

LOCK_FILES_CHANGED=false
for file in $STAGED_FILES; do
  case "$file" in
    package-lock.json|yarn.lock|pnpm-lock.yaml|requirements.txt|Gemfile.lock|poetry.lock|Cargo.lock)
      LOCK_FILES_CHANGED=true
      break
      ;;
  esac
done

if [ "$LOCK_FILES_CHANGED" = true ]; then
  echo -e "  Lock file changed — running audit..."

  if [ -f "package-lock.json" ] && command -v npm &>/dev/null; then
    AUDIT_OUT=$(npm audit --audit-level=high 2>&1 || true)
    if echo "$AUDIT_OUT" | grep -qi "found.*high\|found.*critical"; then
      echo -e "  ${RED}HIGH${NC} — npm audit found high/critical vulnerabilities"
      FINDINGS_HIGH=$((FINDINGS_HIGH + 1))
    else
      echo -e "  ${GREEN}PASS${NC} — npm audit clean"
    fi
  fi

  if [ -f "requirements.txt" ] && command -v pip-audit &>/dev/null; then
    PIP_AUDIT_OUT=$(pip-audit -r requirements.txt 2>&1 || true)
    if echo "$PIP_AUDIT_OUT" | grep -qi "vulnerability\|CVE"; then
      echo -e "  ${RED}HIGH${NC} — pip-audit found vulnerabilities"
      FINDINGS_HIGH=$((FINDINGS_HIGH + 1))
    else
      echo -e "  ${GREEN}PASS${NC} — pip-audit clean"
    fi
  fi
else
  echo -e "  ${GREEN}PASS${NC} — No lock file changes"
fi

# ─── Check 5: Semgrep (if installed) ────────────────────────────────

echo -e "${BLUE}[5/5]${NC} Running advanced scanner..."

if command -v semgrep &>/dev/null; then
  # Run semgrep on staged files only
  SEMGREP_FILES=$(echo "$STAGED_FILES" | tr '\n' ' ')
  SEMGREP_OUT=$(semgrep --config p/security-audit --config p/secrets --json $SEMGREP_FILES 2>/dev/null || true)

  SEMGREP_HIGH=$(echo "$SEMGREP_OUT" | grep -o '"severity":"ERROR"' | wc -l | tr -d ' ' || echo "0")
  SEMGREP_MED=$(echo "$SEMGREP_OUT" | grep -o '"severity":"WARNING"' | wc -l | tr -d ' ' || echo "0")

  if [ "$SEMGREP_HIGH" -gt 0 ]; then
    echo -e "  ${RED}HIGH${NC} — Semgrep found $SEMGREP_HIGH high-severity issues"
    FINDINGS_HIGH=$((FINDINGS_HIGH + SEMGREP_HIGH))
  fi
  if [ "$SEMGREP_MED" -gt 0 ]; then
    echo -e "  ${YELLOW}MEDIUM${NC} — Semgrep found $SEMGREP_MED medium-severity issues"
    FINDINGS_MEDIUM=$((FINDINGS_MEDIUM + SEMGREP_MED))
  fi
  if [ "$SEMGREP_HIGH" -eq 0 ] && [ "$SEMGREP_MED" -eq 0 ]; then
    echo -e "  ${GREEN}PASS${NC} — Semgrep clean"
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} — Semgrep not installed (install: pip install semgrep)"
  echo -e "       Using built-in pattern matching only"
fi

# ─── Results ─────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Findings: ${RED}HIGH=$FINDINGS_HIGH${NC}  ${YELLOW}MEDIUM=$FINDINGS_MEDIUM${NC}  LOW=$FINDINGS_LOW"
echo ""

# Determine if we should block based on severity threshold
SHOULD_BLOCK=false

case "$SEVERITY_THRESHOLD" in
  critical)
    # Only block on critical (we don't have a separate critical count, using HIGH)
    [ "$FINDINGS_HIGH" -gt 0 ] && SHOULD_BLOCK=true
    ;;
  high)
    [ "$FINDINGS_HIGH" -gt 0 ] && SHOULD_BLOCK=true
    ;;
  medium)
    [ "$FINDINGS_HIGH" -gt 0 ] || [ "$FINDINGS_MEDIUM" -gt 0 ] && SHOULD_BLOCK=true
    ;;
  low)
    [ "$FINDINGS_HIGH" -gt 0 ] || [ "$FINDINGS_MEDIUM" -gt 0 ] || [ "$FINDINGS_LOW" -gt 0 ] && SHOULD_BLOCK=true
    ;;
esac

if [ "$SHOULD_BLOCK" = true ]; then
  echo -e "${RED}COMMIT BLOCKED — Fix the above issues before committing.${NC}"
  echo -e "  Threshold: ${SEVERITY_THRESHOLD} | Blocking findings: HIGH=$FINDINGS_HIGH"
  echo ""
  echo "  To bypass (not recommended): git commit --no-verify"
  echo ""
  exit 1
else
  echo -e "${GREEN}PASS — No blocking issues found. Commit allowed.${NC}"
  echo ""
  exit 0
fi
