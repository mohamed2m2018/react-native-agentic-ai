import React, { useRef, useEffect, useContext, useState } from 'react';
import type { ReactElement } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { ZoneRegistryContext } from '../core/ZoneRegistry';
import type { AIZoneConfig } from '../core/types';

interface AIZoneProps extends AIZoneConfig {
  children: React.ReactNode;
  style?: any;
}

// React context to broadcast simplified state down strictly to children
export const AIZoneStateContext = React.createContext<{ simplified: boolean }>({ simplified: false });

/**
 * Declarative boundary that grants the AI permission to modify its subtree.
 * Has zero visual impact by default.
 */
export function AIZone({ 
  id, 
  allowHighlight, 
  allowInjectHint, 
  allowSimplify, 
  allowInjectCard, 
  templates, 
  children,
  style,
}: AIZoneProps) {
  const zoneRef = useRef<any>(null);
  const registry = useContext(ZoneRegistryContext);

  // State managed by AI tools
  const [simplified, setSimplified] = useState(false);
  const [injectedCard, setInjectedCard] = useState<ReactElement | null>(null);

  useEffect(() => {
    // Register zone permissions on mount
    registry.register({
      id,
      allowHighlight,
      allowInjectHint,
      allowSimplify,
      allowInjectCard,
      templates,
    }, zoneRef);

    // Unregister on unmount
    return () => registry.unregister(id);
  }, [id, allowHighlight, allowInjectHint, allowSimplify, allowInjectCard, templates, registry]);

  // If the zone exposes an API to manipulate itself locally (outside of AI), 
  // we would attach it to the ref or a secondary context. For now, the tools 
  // will dispatch events or we can expose a global setter.
  // Actually, the easiest way for the AI tools to mutate this state is 
  // an EventEmitter or assigning a controller object to the registry.
  
  useEffect(() => {
    // Attach controller to the registry so tools can act on this specific mount instance
    const zone = registry.get(id);
    if (zone) {
      (zone as any)._controller = {
        simplify: () => setSimplified(true),
        restore: () => {
          setSimplified(false);
          setInjectedCard(null);
        },
        injectCard: (card: ReactElement) => setInjectedCard(card),
      };
    }
  }, [id, registry]);

  return (
    <View ref={zoneRef} style={style} collapsable={false}>
      <AIZoneStateContext.Provider value={{ simplified }}>
        {children}
        
        {/* Render AI-Injected Card slot at the bottom of the zone */}
        {injectedCard && (
          <View style={styles.cardWrapper}>
            {injectedCard}
            <Pressable 
              style={styles.closeCardBtn} 
              onPress={() => setInjectedCard(null)}
              accessibilityLabel="Dismiss AI Card"
            >
              <Text style={styles.closeCardText}>×</Text>
            </Pressable>
          </View>
        )}

        {/* User cancellation button for simplification */}
        {simplified && (
          <Pressable 
            style={styles.showAllBtn} 
            onPress={() => setSimplified(false)}
            accessibilityLabel="Show all options"
          >
            <Text style={styles.showAllText}>Show all options</Text>
          </Pressable>
        )}
      </AIZoneStateContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginVertical: 12,
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  closeCardBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeCardText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  showAllBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  showAllText: {
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
  }
});
