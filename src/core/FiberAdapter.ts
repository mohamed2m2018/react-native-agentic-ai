/**
 * FiberAdapter — Defense in depth for React internals.
 *
 * Centralizes all direct access to React Fiber internal properties.
 * If React renames an internal property (e.g., in React 19/20), we only
 * need to update it here instead of auditing the entire codebase.
 *
 * These are intentionally simple getter functions, not a complex class abstraction,
 * to ensure maximum performance during tree walk.
 */

export function getChild(node: any): any | null {
  return node?.child ?? null;
}

export function getSibling(node: any): any | null {
  return node?.sibling ?? null;
}

export function getParent(node: any): any | null {
  return node?.return ?? null;
}

export function getProps(node: any): Record<string, any> {
  return node?.memoizedProps || {};
}

export function getStateNode(node: any): any | null {
  return node?.stateNode ?? null;
}

export function getType(node: any): any | null {
  return node?.type ?? null;
}

export function getDisplayName(node: any): string | null {
  return node?.type?.displayName ?? null;
}

/**
 * Common heuristic to find the Fiber node attached to a native view.
 *
 * Old Architecture (Bridge): __reactFiber$<hash> or __reactInternalInstance$<hash>
 * New Architecture (Fabric): __internalInstanceHandle (ReactNativeElement)
 */
export function getFiberFromNativeNode(nativeNode: any): any | null {
  if (!nativeNode) return null;

  // Old Architecture: __reactFiber$ / __reactInternalInstance$
  const key = Object.keys(nativeNode).find(
    k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );
  if (key) return nativeNode[key];

  // New Architecture (Fabric): __internalInstanceHandle
  const handle = nativeNode.__internalInstanceHandle;
  if (handle && (handle.child !== undefined || handle.memoizedProps !== undefined)) {
    return handle;
  }

  return null;
}
