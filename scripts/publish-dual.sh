#!/bin/bash
set -euo pipefail

# ─── Dual Publish Script ────────────────────────────────────────
# Publishes the same built artifacts under two npm package names:
#   1. @mobileai/react-native        (scoped)
#   2. react-native-agentic-ai       (unscoped)
#
# Reads the ACTUAL name from package.json and publishes under BOTH names,
# regardless of which name is currently set.
#
# Usage:
#   ./scripts/publish-dual.sh           # publish both
#   ./scripts/publish-dual.sh --dry-run # preview without publishing
# ─────────────────────────────────────────────────────────────────

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "🔍 Dry-run mode — nothing will actually be published."
fi

NAME_A="@mobileai/react-native"
NAME_B="react-native-agentic-ai"

# Ensure we're in the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Back up original package.json BEFORE any modifications
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

# Ensure the build is fresh
echo "📦 Building package..."
npx bob build

# ─── Publish under name A ────────────────────────────────────────
echo ""
echo "🚀 Publishing as $NAME_A..."
swap_name "$NAME_A"
npm publish --access public $DRY_RUN

# ─── Publish under name B ────────────────────────────────────────
echo ""
echo "🚀 Publishing as $NAME_B..."
swap_name "$NAME_B"
npm publish --access public $DRY_RUN

echo ""
echo "✅ Done! Published under both names:"
echo "   • $NAME_A"
echo "   • $NAME_B"
