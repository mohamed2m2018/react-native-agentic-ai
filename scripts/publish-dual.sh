#!/bin/bash
set -euo pipefail

# ─── Dual Publish Script ────────────────────────────────────────
# Bumps version, builds, and publishes under two npm package names:
#   1. @mobileai/react-native        (scoped)
#   2. react-native-agentic-ai        (unscoped)
#
# Usage:
#   ./scripts/publish-dual.sh patch            # bump patch, build, publish both
#   ./scripts/publish-dual.sh minor             # bump minor, build, publish both
#   ./scripts/publish-dual.sh major             # bump major, build, publish both
#   ./scripts/publish-dual.sh patch --dry-run   # dry run
# ─────────────────────────────────────────────────────────────────

BUMP="${1:-patch}"
DRY_RUN=""

if [[ "${2:-}" == "--dry-run" ]] || [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "🔍 Dry-run mode — nothing will actually be published."
  if [[ "${1:-}" == "--dry-run" ]]; then
    BUMP="patch"
  fi
fi

NAME_A="@mobileai/react-native"
NAME_B="react-native-agentic-ai"

# Ensure we're in the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ─── Bump version ────────────────────────────────────────────────
OLD_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "📦 Bumping version ($BUMP): $OLD_VERSION → ..."
npm version "$BUMP" --no-git-tag-version
NEW_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "   New version: $NEW_VERSION"

# ─── Build ───────────────────────────────────────────────────────
echo ""
echo "🔨 Building package..."
npm run prepare

# ─── Back up original package.json ──────────────────────────────
cp package.json package.json.bak

# Helper: swap name in package.json
swap_name() {
  node -e "
    const pkg = require('./package.json');
    pkg.name = '$1';
    require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
}

# Ensure we always restore package.json, even on error
cleanup() {
  echo ""
  echo "♻️  Restoring original package.json..."
  mv package.json.bak package.json
}
trap cleanup EXIT

# ─── Publish under name A ────────────────────────────────────────
# --ignore-scripts avoids re-running prepare (build already done above)
echo ""
echo "🚀 Publishing $NAME_A@$NEW_VERSION..."
swap_name "$NAME_A"
npm publish --access public --ignore-scripts $DRY_RUN

# ─── Publish under name B ────────────────────────────────────────
echo ""
echo "🚀 Publishing $NAME_B@$NEW_VERSION..."
swap_name "$NAME_B"
npm publish --access public --ignore-scripts $DRY_RUN

echo ""
echo "✅ Done! Published $NEW_VERSION under both names:"
echo "   • $NAME_A@$NEW_VERSION"
echo "   • $NAME_B@$NEW_VERSION"