#!/bin/bash
set -euo pipefail

# ─── Dual Publish Script ────────────────────────────────────────
# Publishes the same built artifacts under two npm package names:
#   1. @mobileai/react-native        (primary, scoped)
#   2. react-native-agentic-ai       (alias, unscoped)
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

PRIMARY_NAME="@mobileai/react-native"
ALIAS_NAME="react-native-agentic-ai"

# Ensure we're in the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Ensure the build is fresh
echo "📦 Building package..."
npx bob build

# ─── Step 1: Publish primary name ────────────────────────────────
echo ""
echo "🚀 Publishing as $PRIMARY_NAME..."
npm publish --access public $DRY_RUN

# ─── Step 2: Swap name and publish alias ─────────────────────────
echo ""
echo "🔄 Swapping package name to $ALIAS_NAME..."

# Back up original package.json
cp package.json package.json.bak

# Replace the name field using node (cross-platform, no jq dependency)
node -e "
  const pkg = require('./package.json');
  pkg.name = '$ALIAS_NAME';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "🚀 Publishing as $ALIAS_NAME..."
npm publish --access public $DRY_RUN

# ─── Step 3: Restore original package.json ───────────────────────
echo ""
echo "♻️  Restoring original package.json..."
mv package.json.bak package.json

echo ""
echo "✅ Done! Published under both names:"
echo "   • $PRIMARY_NAME"
echo "   • $ALIAS_NAME"
