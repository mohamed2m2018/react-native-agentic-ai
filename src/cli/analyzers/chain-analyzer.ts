/**
 * Navigation chain analyzer.
 * Builds a directed graph from navigation links found in screen files,
 * then extracts navigation chains (paths from root to leaf screens).
 */

export interface NavigationGraph {
  /** Map of route → routes it navigates to */
  edges: Map<string, Set<string>>;
}

/**
 * Build a navigation graph from screen navigation links.
 * Links are resolved against the known route list to handle dynamic segments.
 */
export function buildNavigationGraph(
  screenLinks: Record<string, string[]>,
  knownRoutes?: string[]
): NavigationGraph {
  const edges = new Map<string, Set<string>>();
  const routes = knownRoutes || Object.keys(screenLinks);

  for (const [route, links] of Object.entries(screenLinks)) {
    if (!edges.has(route)) {
      edges.set(route, new Set());
    }
    for (const link of links) {
      const resolved = resolveLink(link, route, routes);
      if (resolved && resolved !== route) {
        edges.get(route)!.add(resolved);
      }
    }
  }

  return { edges };
}

/**
 * Extract navigation chains from the graph.
 * A chain is a path from a root screen (no incoming edges) to a leaf screen (no outgoing edges).
 */
export function extractChains(graph: NavigationGraph, allRoutes: string[]): string[][] {
  // Find root nodes (screens that no other screen navigates to)
  const hasIncoming = new Set<string>();
  for (const targets of graph.edges.values()) {
    for (const target of targets) {
      hasIncoming.add(target);
    }
  }

  const roots = allRoutes.filter(r => !hasIncoming.has(r) && graph.edges.has(r));

  // DFS from each root to find chains
  const chains: string[][] = [];

  function dfs(current: string, path: string[], visited: Set<string>) {
    const neighbors = graph.edges.get(current);
    if (!neighbors || neighbors.size === 0) {
      // Leaf node — record chain if it's longer than 1
      if (path.length > 1) {
        chains.push([...path]);
      }
      return;
    }

    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        path.push(next);
        dfs(next, path, visited);
        path.pop();
        visited.delete(next);
      }
    }
  }

  for (const root of roots) {
    dfs(root, [root], new Set([root]));
  }

  // Deduplicate: keep the longest chain for each leaf
  return deduplicateChains(chains);
}

function deduplicateChains(chains: string[][]): string[][] {
  // Sort by length descending, keep longest chains
  chains.sort((a, b) => b.length - a.length);

  const covered = new Set<string>();
  const result: string[][] = [];

  for (const chain of chains) {
    const key = chain.join(' → ');
    // Check if this chain is a subset of an already-kept chain
    const isSubset = result.some(kept => {
      const keptStr = kept.join(' → ');
      return keptStr.includes(key);
    });

    if (!isSubset && !covered.has(key)) {
      result.push(chain);
      covered.add(key);
    }
  }

  return result;
}

/**
 * Resolve a raw navigation link to a known route name.
 *
 * Handles:
 * - Leading/trailing slashes: "/about/" → "about"
 * - Dynamic segment mismatch: "item-reviews/[param]" → "item-reviews/[id]"
 * - Inline param values: "item-reviews/abc123" → "item-reviews/[id]"
 * - Relative routes: "./article" (resolved relative to fromRoute)
 * - External URLs are skipped
 */
function resolveLink(link: string, fromRoute: string, knownRoutes: string[]): string | null {
  let normalized = link;

  // Skip external URLs
  if (normalized.startsWith('http') || normalized.startsWith('mailto')) {
    return null;
  }

  // Handle relative routes
  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    const fromDir = fromRoute.includes('/') ? fromRoute.substring(0, fromRoute.lastIndexOf('/')) : '';
    if (normalized.startsWith('./')) {
      normalized = fromDir ? `${fromDir}/${normalized.slice(2)}` : normalized.slice(2);
    } else if (normalized.startsWith('../')) {
      // Go up one level
      const parentDir = fromDir.includes('/') ? fromDir.substring(0, fromDir.lastIndexOf('/')) : '';
      normalized = parentDir ? `${parentDir}/${normalized.slice(3)}` : normalized.slice(3);
    }
  }

  // Strip leading/trailing slashes
  normalized = normalized.replace(/^\/+|\/+$/g, '');

  if (!normalized) return null;

  // 1. Exact match — fastest path
  if (knownRoutes.includes(normalized)) {
    return normalized;
  }

  // 2. Fuzzy match: resolve dynamic segments
  //    "item-reviews/[param]" should match "item-reviews/[id]"
  //    "item-reviews/abc123" should match "item-reviews/[id]"
  const linkSegments = normalized.split('/');

  for (const route of knownRoutes) {
    const routeSegments = route.split('/');
    if (routeSegments.length !== linkSegments.length) continue;

    let matches = true;
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSeg = routeSegments[i]!;
      const linkSeg = linkSegments[i]!;

      // Exact segment match
      if (routeSeg === linkSeg) continue;

      // Route has dynamic segment [id] — matches any link segment
      // (including [param], concrete values like "abc123", etc.)
      if (routeSeg.startsWith('[') && routeSeg.endsWith(']')) continue;

      // Link has a bracket placeholder [param] — matches route's [id]
      if (linkSeg.startsWith('[') && linkSeg.endsWith(']') &&
          routeSeg.startsWith('[') && routeSeg.endsWith(']')) continue;

      matches = false;
      break;
    }

    if (matches) return route;
  }

  return null;
}

