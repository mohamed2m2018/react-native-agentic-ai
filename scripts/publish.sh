#!/bin/bash
set -euo pipefail

# ─── Publish Script ─────────────────────────────────────────────
# Bumps the version, builds (SDK + MCP server) and publishes
# react-native-agentic-ai to npm.
#
# Usage:
#   ./scripts/publish.sh patch            # bump patch, build, publish
#   ./scripts/publish.sh minor            # bump minor
#   ./scripts/publish.sh none             # publish the version in package.json as is
#   ./scripts/publish.sh patch --dry-run  # dry run (version bump is reverted)
#
# npm asks for your two-factor code when publishing.
# ─────────────────────────────────────────────────────────────────

BUMP="${1:-patch}"
DRY_RUN=""
if [[ "${2:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "🔍 Dry-run mode — nothing will be published."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [[ -n "$DRY_RUN" ]]; then
  cp package.json package.json.bak
  cp package-lock.json package-lock.json.bak
  trap 'mv package.json.bak package.json; mv package-lock.json.bak package-lock.json' EXIT
fi

if [[ "$BUMP" != "none" ]]; then
  npm version "$BUMP" --no-git-tag-version
fi
VERSION=$(node -e "console.log(require('./package.json').version)")

SDK_VERSION=$(sed -n "s/.*SDK_VERSION = '\(.*\)'.*/\1/p" src/config/version.ts)
if [[ "$SDK_VERSION" != "$VERSION" ]]; then
  echo "❌ src/config/version.ts says $SDK_VERSION but package.json says $VERSION. Update it first."
  exit 1
fi

echo "🔨 Building..."
npm run prepare

echo "🚀 Publishing react-native-agentic-ai@$VERSION..."
npm publish --access public --ignore-scripts $DRY_RUN

echo "✅ Done: react-native-agentic-ai@$VERSION"
