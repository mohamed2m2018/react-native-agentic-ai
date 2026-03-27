import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
// import { AIAgent, MobileAI } from 'experimental-stuff'; // old
// import { buildSupportPrompt, createEscalateTool } from 'experimental-stuff'; // old
// import type { KnowledgeEntry } from 'experimental-stuff'; // old
import { AIAgent } from '@mobileai/react-native';
import { buildSupportPrompt, createEscalateTool } from '@mobileai/react-native';
import type { KnowledgeEntry } from '@mobileai/react-native';
import screenMap from '../ai-screen-map.json';
import { useColorScheme } from '@/components/useColorScheme';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// ─── Knowledge Base ─────────────────────────────────────────
const SHOP_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'return-policy',
    title: 'Return & Refund Policy',
    content:
      'We offer a 30-day return policy on all items. '
      + 'Items must be unused and in original packaging. '
      + 'Refunds are processed within 5-7 business days to the original payment method. '
      + 'Electronics must be returned within 15 days.',
    tags: ['return', 'refund', 'exchange', 'policy'],
  },
  {
    id: 'shipping-info',
    title: 'Shipping Information',
    content:
      'Standard shipping: 5-7 business days ($4.99). '
      + 'Express shipping: 2-3 business days ($12.99). '
      + 'Free shipping on orders over $75. '
      + 'We ship to all 50 US states. International shipping available for select countries.',
    tags: ['shipping', 'delivery', 'tracking', 'international'],
  },
  {
    id: 'warranty',
    title: 'Warranty Policy',
    content:
      'All electronics come with a 1-year manufacturer warranty. '
      + 'Footwear has a 6-month warranty against defects. '
      + 'Accessories and home items have a 90-day warranty. '
      + 'Warranty does not cover normal wear and tear.',
    tags: ['warranty', 'guarantee', 'defect', 'repair'],
  },
  {
    id: 'store-hours',
    title: 'Customer Support Hours',
    content:
      'Live chat: Monday-Friday 9AM-9PM EST. '
      + 'Phone support: Monday-Friday 10AM-6PM EST at 1-800-SHOP-APP. '
      + 'Email: support@shopapp.com (response within 24 hours). '
      + 'Weekend support available via email only.',
    tags: ['support', 'contact', 'hours', 'phone', 'email'],
  },
];

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  if (!loaded) return null;
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const navRef = useNavigationContainerRef();

  // 🔹 Feature flag sync on mount (requires api.mobileai.dev — coming soon)
  // useEffect(() => {
  //   const chatEnabled = MobileAI.getFlag('chat_enabled', 'control');
  //   console.log('[FeatureFlag] chat_enabled =', chatEnabled);
  // }, []);

  // 🔹 Support mode
  const supportSystem = buildSupportPrompt({
    enabled: true,
    systemContext: 'You are a support agent for ShopApp. Help with returns, shipping, and warranty.',
    autoEscalateTopics: ['billing dispute', 'account deletion', 'fraud'],
  });

  const escalateTool = createEscalateTool(
    {
      onEscalate: (ctx) => console.log('[Support] Escalating:', ctx.conversationSummary),
      escalationMessage: 'Connecting you to a live agent...',
    },
    () => ({
      currentScreen: 'unknown',
      originalQuery: '',
      stepsBeforeEscalation: 0,
    })
  );

  return (
    <AIAgent
      apiKey={process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''}
      navRef={navRef}
      mcpServerUrl={__DEV__ ? 'ws://localhost:3101' : undefined}
      knowledgeBase={SHOP_KNOWLEDGE}
      showChatBar={true}
      enableUIControl={true}
      debug={true}
      screenMap={screenMap as any}
      accentColor="#6C5CE7"
      // 🔹 Analytics telemetry
      analyticsKey={process.env.EXPO_PUBLIC_MOBILEAI_KEY}
      // 🔹 Budget guard (realistic for a multi-step task)
      maxTokenBudget={50000}
      maxCostUSD={0.50}
      // 🔹 Proactive hint — pulse after 1 min, badge after 2 mins
      proactiveHelp={{
        enabled: true,
        pulseAfterMinutes: 1,
        badgeAfterMinutes: 2,
        badgeText: 'Need help browsing? Tap to ask!',
      }}
      theme={{
        backgroundColor: 'rgba(44, 30, 104, 0.95)',
        inputBackgroundColor: 'rgba(255, 255, 255, 0.12)',
      }}
      instructions={{
        system: `You are ShopApp's AI assistant. Help users browse products, answer questions about policies and shipping, and navigate the app. ${supportSystem}`,
      }}
      // 🔹 Escalate tool for support mode
      customTools={{ escalate: escalateTool }}
    >
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="product/[id]" options={{ title: 'Product Details' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
          <Stack.Screen name="favorites" options={{ title: 'Favorites' }} />
          <Stack.Screen name="order-history" options={{ title: 'Order History' }} />
          <Stack.Screen name="addresses" options={{ title: 'Addresses' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
          <Stack.Screen name="language" options={{ title: 'Language' }} />
          <Stack.Screen name="about" options={{ title: 'About' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="help" options={{ title: 'Help Center' }} />
          <Stack.Screen name="categories" options={{ title: 'Categories' }} />
          <Stack.Screen name="category/[id]" options={{ title: 'Category' }} />
          <Stack.Screen name="subcategory/[id]" options={{ title: 'Subcategory' }} />
          <Stack.Screen name="item/[id]" options={{ title: 'Item Details' }} />
          <Stack.Screen name="item-reviews/[id]" options={{ title: 'Reviews' }} />
        </Stack>
      </ThemeProvider>
    </AIAgent>
  );
}
