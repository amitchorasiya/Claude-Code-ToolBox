#!/usr/bin/env bash
set -euo pipefail

# AntiVibe Package Validator
# ==========================
# Validates a package before install against the AntiVibe security policy.
#
# Usage:
#   ./bin/validate-package.sh <package-name> [--registry npm|pip|gem]
#
# Checks performed:
#   1. Package exists on the registry
#   2. Weekly downloads meet minimum threshold
#   3. Last publish date is within acceptable window
#   4. Package is not on the blocked list
#   5. No known vulnerabilities (npm audit)
#
# Exit codes:
#   0 = PASS (safe to install)
#   1 = FAIL (do not install)
#   2 = WARN (review needed)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIG_FILE=".antivibe/config.yaml"
PACKAGE=""
REGISTRY="npm"
ERRORS=()
WARNINGS=()

# ─── Argument parsing ─────────────────────────────────────────────────

usage() {
  echo "Usage: $0 <package-name> [--registry npm|pip|gem]"
  echo ""
  echo "Options:"
  echo "  --registry    Package registry to check (default: npm)"
  echo "                Supported: npm, pip, gem"
  echo ""
  echo "Examples:"
  echo "  $0 express"
  echo "  $0 flask --registry pip"
  echo "  $0 rails --registry gem"
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

PACKAGE="$1"
shift

while [ $# -gt 0 ]; do
  case "$1" in
    --registry)
      REGISTRY="${2:-npm}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      usage
      ;;
  esac
done

# ─── Config loading ──────────────────────────────────────────────────

# Simple YAML value reader (no external deps required)
# Reads a simple key-value from the config file
yaml_value() {
  local key="$1"
  local default="$2"
  if [ -f "$CONFIG_FILE" ]; then
    local val
    val=$(grep -E "^\s*${key}:" "$CONFIG_FILE" 2>/dev/null | head -1 | sed 's/.*:\s*//' | sed 's/\s*#.*//' | tr -d '"' || true)
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$default"
}

# Read blocked packages from config
get_blocked_packages() {
  if [ -f "$CONFIG_FILE" ]; then
    # Extract lines under blocked_packages: that start with "- "
    sed -n '/blocked_packages:/,/^[^ ]/p' "$CONFIG_FILE" | grep '^\s*-' | sed 's/^\s*-\s*//' | sed 's/\s*#.*//' | tr -d ' '
  fi
}

MIN_DOWNLOADS=$(yaml_value "min_weekly_downloads" "1000")
MAX_AGE_DAYS=$(yaml_value "max_age_days_since_publish" "365")

# ─── Header ──────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     AntiVibe Package Validator           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Package:  ${BLUE}${PACKAGE}${NC}"
echo -e "  Registry: ${BLUE}${REGISTRY}${NC}"
echo -e "  Policy:   ${BLUE}${CONFIG_FILE}${NC}"
echo ""

# ─── Check 1: Blocked list ───────────────────────────────────────────

echo -e "${BLUE}[1/5]${NC} Checking blocked list..."

BLOCKED=$(get_blocked_packages)
if echo "$BLOCKED" | grep -qx "$PACKAGE"; then
  ERRORS+=("BLOCKED: '$PACKAGE' is on the blocked packages list (known supply chain risk)")
  echo -e "  ${RED}FAIL${NC} — Package is on the blocked list"
else
  echo -e "  ${GREEN}PASS${NC} — Not on blocked list"
fi

# ─── Check 2: Package exists on registry ─────────────────────────────

echo -e "${BLUE}[2/5]${NC} Checking registry existence..."

case "$REGISTRY" in
  npm)
    if ! command -v npm &>/dev/null; then
      WARNINGS+=("npm not installed — cannot verify package existence")
      echo -e "  ${YELLOW}SKIP${NC} — npm not available"
    else
      NPM_INFO=$(npm info "$PACKAGE" 2>&1 || true)
      if echo "$NPM_INFO" | grep -qi "404\|not found\|ERR!"; then
        ERRORS+=("NOT FOUND: Package '$PACKAGE' does not exist on npm registry")
        echo -e "  ${RED}FAIL${NC} — Package not found on npm"
      else
        echo -e "  ${GREEN}PASS${NC} — Package exists on npm"
      fi
    fi
    ;;
  pip)
    if ! command -v pip &>/dev/null && ! command -v pip3 &>/dev/null; then
      WARNINGS+=("pip not installed — cannot verify package existence")
      echo -e "  ${YELLOW}SKIP${NC} — pip not available"
    else
      PIP_CMD=$(command -v pip3 || command -v pip)
      PIP_INFO=$($PIP_CMD index versions "$PACKAGE" 2>&1 || true)
      if echo "$PIP_INFO" | grep -qi "no matching\|ERROR\|not found"; then
        # Fallback: try PyPI JSON API
        PYPI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://pypi.org/pypi/$PACKAGE/json" 2>/dev/null || echo "000")
        if [ "$PYPI_STATUS" != "200" ]; then
          ERRORS+=("NOT FOUND: Package '$PACKAGE' does not exist on PyPI")
          echo -e "  ${RED}FAIL${NC} — Package not found on PyPI"
        else
          echo -e "  ${GREEN}PASS${NC} — Package exists on PyPI"
        fi
      else
        echo -e "  ${GREEN}PASS${NC} — Package exists on PyPI"
      fi
    fi
    ;;
  gem)
    GEM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://rubygems.org/api/v1/gems/$PACKAGE.json" 2>/dev/null || echo "000")
    if [ "$GEM_STATUS" != "200" ]; then
      ERRORS+=("NOT FOUND: Package '$PACKAGE' does not exist on RubyGems")
      echo -e "  ${RED}FAIL${NC} — Package not found on RubyGems"
    else
      echo -e "  ${GREEN}PASS${NC} — Package exists on RubyGems"
    fi
    ;;
  *)
    WARNINGS+=("Unsupported registry: $REGISTRY")
    echo -e "  ${YELLOW}SKIP${NC} — Unsupported registry '$REGISTRY'"
    ;;
esac

# ─── Check 3: Weekly downloads ───────────────────────────────────────

echo -e "${BLUE}[3/5]${NC} Checking download count (minimum: ${MIN_DOWNLOADS}/week)..."

case "$REGISTRY" in
  npm)
    DOWNLOADS_JSON=$(curl -s "https://api.npmjs.org/downloads/point/last-week/$PACKAGE" 2>/dev/null || echo "{}")
    DOWNLOADS=$(echo "$DOWNLOADS_JSON" | grep -o '"downloads":[0-9]*' | grep -o '[0-9]*' || echo "0")
    if [ "$DOWNLOADS" -eq 0 ] 2>/dev/null; then
      WARNINGS+=("Could not determine download count for '$PACKAGE'")
      echo -e "  ${YELLOW}WARN${NC} — Could not determine downloads"
    elif [ "$DOWNLOADS" -lt "$MIN_DOWNLOADS" ]; then
      ERRORS+=("LOW DOWNLOADS: '$PACKAGE' has $DOWNLOADS weekly downloads (minimum: $MIN_DOWNLOADS)")
      echo -e "  ${RED}FAIL${NC} — $DOWNLOADS downloads/week (below $MIN_DOWNLOADS threshold)"
    else
      echo -e "  ${GREEN}PASS${NC} — $DOWNLOADS downloads/week"
    fi
    ;;
  pip)
    # PyPI doesn't have a simple downloads API; use pypistats if available
    if command -v pypistats &>/dev/null; then
      PIP_DOWNLOADS=$(pypistats recent "$PACKAGE" --format json 2>/dev/null | grep -o '"last_week":[0-9]*' | grep -o '[0-9]*' || echo "0")
      if [ "$PIP_DOWNLOADS" -lt "$MIN_DOWNLOADS" ] 2>/dev/null; then
        WARNINGS+=("Low downloads for '$PACKAGE' on PyPI ($PIP_DOWNLOADS/week)")
        echo -e "  ${YELLOW}WARN${NC} — $PIP_DOWNLOADS downloads/week (pypistats)"
      else
        echo -e "  ${GREEN}PASS${NC} — $PIP_DOWNLOADS downloads/week"
      fi
    else
      WARNINGS+=("pypistats not installed — cannot check PyPI download counts")
      echo -e "  ${YELLOW}SKIP${NC} — pypistats not available (install with: pip install pypistats)"
    fi
    ;;
  gem)
    GEM_JSON=$(curl -s "https://rubygems.org/api/v1/gems/$PACKAGE.json" 2>/dev/null || echo "{}")
    GEM_DOWNLOADS=$(echo "$GEM_JSON" | grep -o '"downloads":[0-9]*' | grep -o '[0-9]*' || echo "0")
    # RubyGems reports total downloads, not weekly — use as rough indicator
    if [ "$GEM_DOWNLOADS" -lt 10000 ] 2>/dev/null; then
      WARNINGS+=("Low total downloads for '$PACKAGE' on RubyGems ($GEM_DOWNLOADS total)")
      echo -e "  ${YELLOW}WARN${NC} — $GEM_DOWNLOADS total downloads (low for RubyGems)"
    else
      echo -e "  ${GREEN}PASS${NC} — $GEM_DOWNLOADS total downloads"
    fi
    ;;
esac

# ─── Check 4: Last publish date ──────────────────────────────────────

echo -e "${BLUE}[4/5]${NC} Checking last publish date (max age: ${MAX_AGE_DAYS} days)..."

case "$REGISTRY" in
  npm)
    if command -v npm &>/dev/null; then
      LAST_PUBLISH=$(npm info "$PACKAGE" time.modified 2>/dev/null || echo "")
      if [ -n "$LAST_PUBLISH" ]; then
        # Parse the date and compare
        if command -v date &>/dev/null; then
          PUBLISH_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_PUBLISH%%.*}" "+%s" 2>/dev/null || date -d "$LAST_PUBLISH" "+%s" 2>/dev/null || echo "0")
          NOW_EPOCH=$(date "+%s")
          if [ "$PUBLISH_EPOCH" -gt 0 ] 2>/dev/null; then
            DAYS_AGO=$(( (NOW_EPOCH - PUBLISH_EPOCH) / 86400 ))
            if [ "$DAYS_AGO" -gt "$MAX_AGE_DAYS" ]; then
              WARNINGS+=("STALE: '$PACKAGE' last published $DAYS_AGO days ago (threshold: $MAX_AGE_DAYS)")
              echo -e "  ${YELLOW}WARN${NC} — Last published $DAYS_AGO days ago"
            else
              echo -e "  ${GREEN}PASS${NC} — Last published $DAYS_AGO days ago"
            fi
          else
            echo -e "  ${YELLOW}SKIP${NC} — Could not parse publish date"
          fi
        else
          echo -e "  ${YELLOW}SKIP${NC} — date command not available"
        fi
      else
        echo -e "  ${YELLOW}SKIP${NC} — Could not get publish date"
      fi
    else
      echo -e "  ${YELLOW}SKIP${NC} — npm not available"
    fi
    ;;
  pip)
    PYPI_JSON=$(curl -s "https://pypi.org/pypi/$PACKAGE/json" 2>/dev/null || echo "{}")
    PYPI_VERSION=$(echo "$PYPI_JSON" | grep -o '"version":"[^"]*"' | head -1 | sed 's/"version":"//;s/"//' || echo "")
    if [ -n "$PYPI_VERSION" ]; then
      # Try to get upload time for latest version
      UPLOAD_TIME=$(echo "$PYPI_JSON" | grep -o '"upload_time":"[^"]*"' | tail -1 | sed 's/"upload_time":"//;s/"//' || echo "")
      if [ -n "$UPLOAD_TIME" ]; then
        echo -e "  ${GREEN}PASS${NC} — Latest version: $PYPI_VERSION (published: $UPLOAD_TIME)"
      else
        echo -e "  ${YELLOW}SKIP${NC} — Could not determine publish date"
      fi
    else
      echo -e "  ${YELLOW}SKIP${NC} — Could not fetch PyPI metadata"
    fi
    ;;
  gem)
    GEM_JSON=$(curl -s "https://rubygems.org/api/v1/gems/$PACKAGE.json" 2>/dev/null || echo "{}")
    GEM_VERSION=$(echo "$GEM_JSON" | grep -o '"version":"[^"]*"' | head -1 | sed 's/"version":"//;s/"//' || echo "")
    if [ -n "$GEM_VERSION" ]; then
      echo -e "  ${GREEN}PASS${NC} — Latest version: $GEM_VERSION"
    else
      echo -e "  ${YELLOW}SKIP${NC} — Could not fetch gem metadata"
    fi
    ;;
esac

# ─── Check 5: Known vulnerabilities ──────────────────────────────────

echo -e "${BLUE}[5/5]${NC} Checking for known vulnerabilities..."

case "$REGISTRY" in
  npm)
    if command -v npm &>/dev/null; then
      # Create a temporary package.json to audit just this package
      TMPDIR_AUDIT=$(mktemp -d)
      echo "{\"name\":\"antivibe-audit\",\"dependencies\":{\"$PACKAGE\":\"latest\"}}" > "$TMPDIR_AUDIT/package.json"
      AUDIT_OUTPUT=$(cd "$TMPDIR_AUDIT" && npm audit --json 2>/dev/null || true)
      rm -rf "$TMPDIR_AUDIT"

      VULN_HIGH=$(echo "$AUDIT_OUTPUT" | grep -o '"high":[0-9]*' | grep -o '[0-9]*' || echo "0")
      VULN_CRIT=$(echo "$AUDIT_OUTPUT" | grep -o '"critical":[0-9]*' | grep -o '[0-9]*' || echo "0")

      if [ "${VULN_CRIT:-0}" -gt 0 ] 2>/dev/null; then
        ERRORS+=("VULNERABILITIES: '$PACKAGE' has $VULN_CRIT critical vulnerabilities")
        echo -e "  ${RED}FAIL${NC} — $VULN_CRIT critical vulnerabilities found"
      elif [ "${VULN_HIGH:-0}" -gt 0 ] 2>/dev/null; then
        ERRORS+=("VULNERABILITIES: '$PACKAGE' has $VULN_HIGH high-severity vulnerabilities")
        echo -e "  ${RED}FAIL${NC} — $VULN_HIGH high-severity vulnerabilities found"
      else
        echo -e "  ${GREEN}PASS${NC} — No high/critical vulnerabilities"
      fi
    else
      echo -e "  ${YELLOW}SKIP${NC} — npm not available for audit"
    fi
    ;;
  pip)
    if command -v pip-audit &>/dev/null; then
      PIP_AUDIT_OUT=$(pip-audit --requirement /dev/stdin <<< "$PACKAGE" 2>&1 || true)
      if echo "$PIP_AUDIT_OUT" | grep -qi "vulnerability\|CVE"; then
        WARNINGS+=("Potential vulnerabilities found for '$PACKAGE' (run pip-audit for details)")
        echo -e "  ${YELLOW}WARN${NC} — Potential vulnerabilities (run pip-audit for details)"
      else
        echo -e "  ${GREEN}PASS${NC} — No known vulnerabilities"
      fi
    else
      echo -e "  ${YELLOW}SKIP${NC} — pip-audit not installed (install with: pip install pip-audit)"
    fi
    ;;
  gem)
    if command -v bundle-audit &>/dev/null; then
      echo -e "  ${YELLOW}SKIP${NC} — Individual gem audit requires Gemfile context"
    else
      echo -e "  ${YELLOW}SKIP${NC} — bundle-audit not installed (install with: gem install bundler-audit)"
    fi
    ;;
esac

# ─── Results ─────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo -e "${RED}RESULT: FAIL — Do not install '$PACKAGE'${NC}"
  echo ""
  for err in "${ERRORS[@]}"; do
    echo -e "  ${RED}✗${NC} $err"
  done
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    for warn in "${WARNINGS[@]}"; do
      echo -e "  ${YELLOW}!${NC} $warn"
    done
  fi
  echo ""
  exit 1
elif [ ${#WARNINGS[@]} -gt 0 ]; then
  echo -e "${YELLOW}RESULT: WARN — Review before installing '$PACKAGE'${NC}"
  echo ""
  for warn in "${WARNINGS[@]}"; do
    echo -e "  ${YELLOW}!${NC} $warn"
  done
  echo ""
  exit 2
else
  echo -e "${GREEN}RESULT: PASS — '$PACKAGE' is safe to install${NC}"
  echo ""
  exit 0
fi
