/**
 * Transforms raw navigation route names into human-readable labels.
 * Designed to handle both Expo Router (file-based) and React Navigation conventions.
 */
export function humanizeScreenName(route: string | null | undefined): string {
  if (!route) return '';

  let name = route;

  // 1. Strip Expo Router groups: e.g., "(tabs)/index" -> "index"
  // Keep replacing in case of nested groups like "(app)/(tabs)/home"
  name = name.replace(/\([^)]+\)\//g, '');

  // 2. Skip internal layout and catch-all routes
  if (name.includes('_layout') || name.includes('[...')) {
    return '';
  }

  // 3. Handle nested indexes: "settings/index" -> "settings"
  if (name.endsWith('/index')) {
    name = name.replace(/\/index$/, '');
  }

  // 4. Special case root index
  if (name === 'index') {
    return 'Home';
  }

  // 5. Strip dynamic brackets: "[id]" -> "id"
  name = name.replace(/\[([^\]]+)\]/g, '$1');

  // Strip leading/trailing slashes just in case
  name = name.replace(/^\/|\/$/g, '');

  // 6. Split on kebab-case, snake_case, slash, and camelCase boundaries
  // e.g., "product-details" -> "product details"
  // e.g., "order_history" -> "order history"
  // e.g., "UserProfile" -> "User Profile"
  // e.g., "settings/profile" -> "settings profile"
  name = name
    .replace(/[-_/]/g, ' ')
    // Insert a space before all caps (but not at the start) to separate camelCase/PascalCase
    .replace(/([a-z])([A-Z])/g, '$1 $2');

  // 7. Title-case each word and clean extra spaces
  name = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return name;
}
