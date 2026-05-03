import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useNavigationContainerRef, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PaperProvider } from 'react-native-paper';
import { AIAgent } from '@mobileai/react-native';
import { buildSupportPrompt, createEscalateTool } from '@mobileai/react-native';
import type { KnowledgeEntry } from '@mobileai/react-native';
import screenMap from '../ai-screen-map.json';
import { useColorScheme } from '@/components/useColorScheme';
import { FoodDeliveryProvider, getSupportContext } from '@/app/lib/delivery-demo';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const DASHBITE_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'delivery-policies',
    title: 'Delivery and ETA Policy',
    content:
      'DashBite estimates live delivery windows, but weather, traffic, and rider route changes can shift ETA. '
      + 'Couriers are actively reassigned before order handoff if the route changes.',
    tags: ['delivery', 'eta', 'courier'],
  },
  {
    id: 'delivery-support',
    title: 'Delivery Support Playbook',
    content:
      'When support requests arrive, confirm order id, restaurant confirmation, and current tracking step first. '
      + 'If ETA is delayed by 15+ minutes or more, validate rider location and ask a few context questions before escalating.',
    tags: ['support', 'delivery', 'eta', 'escalation'],
  },
  {
    id: 'missing-wrong-items',
    title: 'Missing or Wrong Items',
    content:
      'When an item is missing or incorrect, capture quantity, item modifiers, and any substitution evidence from the user. '
      + 'Always ask whether the item is still cook-in-progress or already consumed before closing with a payout action.',
    tags: ['order accuracy', 'refund'],
  },
  {
    id: 'refund-safety',
    title: 'Refund and Safety Cases',
    content:
      'Food quality, allergy, duplicate charge, and courier safety concerns should be escalated immediately to live support with '
      + 'order metadata and customer statement. Refunds can be initiated after order evidence is confirmed.',
    tags: ['refund', 'safety', 'escalation'],
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
  const pathname = usePathname();
  const analyticsKey =
    (__DEV__ ? process.env.EXPO_PUBLIC_MOBILEAI_DEV_KEY : undefined)
    ?? process.env.EXPO_PUBLIC_MOBILEAI_KEY;
  const mcpServerUrl = process.env.EXPO_PUBLIC_MOBILEAI_MCP_URL;

  // 🔹 Feature flag sync on mount (requires api.mobileai.dev — coming soon)
  // useEffect(() => {
  //   const chatEnabled = MobileAI.getFlag('chat_enabled', 'control');
  //   console.log('[FeatureFlag] chat_enabled =', chatEnabled);
  // }, []);

  // 🔹 Support mode
  const supportSystem = buildSupportPrompt({
    enabled: true,
    persona: {
      agentName: 'Nora',
      preset: 'wow-service',
      tone: 'warm, reassuring, and practical',
    },
    systemContext:
      'You are Nora, a warm support teammate for DashBite, a delivery-focused food marketplace. '
      + 'Start by reassuring the customer and showing that you understand what went wrong. '
      + 'Use the app context to resolve order status and delivery issues clearly, without sounding cold or robotic. '
      + 'Be precise with order IDs and recent status, but keep your wording calm, friendly, and human.',
    autoEscalateTopics: [
      'food allergy',
      'courier safety',
      'duplicate charge',
      'undelivered',
      'refund',
      'safety concern',
    ],
  });

  const escalateTool = createEscalateTool(
    {
      config: {
        buttonLabel: 'Talk to live support',
        onEscalate: (ctx) => console.log('[DashBite Support] Escalating:', ctx.conversationSummary),
        escalationMessage: 'Connecting you to our live support specialist...',
      },
      analyticsKey,
      getContext: () => {
        const supportContext = getSupportContext();
        return {
          currentScreen: supportContext?.screen || supportContext?.source || 'unknown',
          originalQuery:
            supportContext?.orderId
              ? `Order ${supportContext.orderId} (${supportContext.issueType ?? 'support request'}) from ${supportContext.restaurant ?? 'DashBite'}`
              : '',
          stepsBeforeEscalation: 0,
        };
      },
      getHistory: () => [],
      onEscalationStarted: () => {},
      getScreenFlow: () => [],
    }
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <PaperProvider>
          <FoodDeliveryProvider>
            <AIAgent
              provider="gemini"
              navRef={navRef}
              pathname={pathname}
              mcpServerUrl={mcpServerUrl}
              knowledgeBase={DASHBITE_KNOWLEDGE}
              showChatBar={true}
              interactionMode="copilot"
              enableUIControl={true}
              debug={true}
              screenMap={screenMap as any}
              accentColor="#F97316"
              analyticsKey={analyticsKey}
              supportStyle="wow-service"
              proactiveHelp={{
                enabled: true,
                pulseAfterMinutes: 1,
                badgeAfterMinutes: 2,
                badgeText: 'Need help with your order? Ask me.',
              }}
              theme={{
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                inputBackgroundColor: 'rgba(255, 255, 255, 0.14)',
              }}
              instructions={{
                system: `You are DashBite's AI host assistant. Help users discover restaurants and place food orders quickly, then handle support with a warm, calming tone and clear next steps. Lead with empathy, avoid abrupt wording, and make the user feel taken care of. ${supportSystem}`,
              }}
              customTools={{ escalate: escalateTool }}
            >
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack ref={navRef}>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="test-ui" options={{ title: 'Overlay Test Lab' }} />
                  <Stack.Screen name="store/[id]" options={{ title: 'Restaurant' }} />
                  <Stack.Screen name="menu-item/[id]" options={{ title: 'Menu Item' }} />
                  <Stack.Screen name="cart" options={{ title: 'Cart' }} />
                  <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
                  <Stack.Screen name="order/[id]/tracking" options={{ title: 'Track Order' }} />
                  <Stack.Screen name="order/[id]/help" options={{ title: 'Order Help' }} />
                  <Stack.Screen name="support/article/[id]" options={{ title: 'Support Article' }} />
                  <Stack.Screen name="payment-methods" options={{ title: 'Payment Methods' }} />
                  <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
                  <Stack.Screen name="favorites" options={{ title: 'Saved Restaurants' }} />
                  <Stack.Screen name="addresses" options={{ title: 'Saved Addresses' }} />
                  <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
                  <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
                  <Stack.Screen name="language" options={{ title: 'Language' }} />
                  <Stack.Screen name="about" options={{ title: 'About DashBite' }} />
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
          </FoodDeliveryProvider>
        </PaperProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
