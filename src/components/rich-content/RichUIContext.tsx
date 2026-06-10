import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { BlockDefinition } from '../../core/types';
import {
  BlockRegistryContext,
  globalBlockRegistry,
  toBlockDefinition,
  type BlockRegistry,
} from '../../core/BlockRegistry';
import {
  DEFAULT_RICH_UI_THEME,
  resolveRichUITheme,
  type RichUITheme,
  type RichUIThemeOverride,
} from '../../theme/RichUITheme';

interface RichUIContextValue {
  theme: RichUITheme;
  surfaceThemes: Partial<Record<'chat' | 'zone' | 'support', RichUITheme>>;
}

const RichUIThemeContext = createContext<RichUIContextValue>({
  theme: DEFAULT_RICH_UI_THEME,
  surfaceThemes: {},
});

export function RichUIProvider({
  children,
  registry,
  blocks,
  theme,
  surfaceThemes,
}: {
  children: React.ReactNode;
  registry?: BlockRegistry;
  blocks?: Array<BlockDefinition | React.ComponentType<any>>;
  theme?: RichUIThemeOverride;
  surfaceThemes?: Partial<Record<'chat' | 'zone' | 'support', RichUIThemeOverride>>;
}) {
  const activeRegistry = registry || globalBlockRegistry;

  useEffect(() => {
    if (Array.isArray(blocks)) {
      blocks.forEach((block) => {
        activeRegistry.register(
          typeof block === 'function' ? toBlockDefinition(block) : block
        );
      });
    }
  }, [activeRegistry, blocks]);

  const resolvedTheme = useMemo(
    () => resolveRichUITheme(theme),
    [theme]
  );
  const resolvedSurfaceThemes = useMemo(
    () => ({
      chat: surfaceThemes?.chat
        ? resolveRichUITheme(theme, surfaceThemes.chat)
        : undefined,
      zone: surfaceThemes?.zone
        ? resolveRichUITheme(theme, surfaceThemes.zone)
        : undefined,
      support: surfaceThemes?.support
        ? resolveRichUITheme(theme, surfaceThemes.support)
        : undefined,
    }),
    [surfaceThemes, theme]
  );

  return (
    <BlockRegistryContext.Provider value={activeRegistry}>
      <RichUIThemeContext.Provider
        value={{
          theme: resolvedTheme,
          surfaceThemes: resolvedSurfaceThemes,
        }}
      >
        {children}
      </RichUIThemeContext.Provider>
    </BlockRegistryContext.Provider>
  );
}

export function useRichUITheme(surface?: 'chat' | 'zone' | 'support'): RichUITheme {
  const context = useContext(RichUIThemeContext);
  if (!surface) return context.theme;
  return context.surfaceThemes[surface] || context.theme;
}

export function useBlockRegistry(): BlockRegistry {
  return useContext(BlockRegistryContext);
}
