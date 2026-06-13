import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useNavigationContainerRef, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AIAgent, type ExecutionResult, type KnowledgeEntry, type TokenUsage } from 'react-native-agentic-ai';
import screenMap from '../ai-screen-map.json';
import { FlightDemoProvider } from '@/lib/flight-demo';

export const unstable_settings = {
  initialRouteName: 'index',
};

const FLIGHT_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'flight-backend-truth',
    title: 'Why Flight Agents Fail',
    content:
      'Flight booking failures are usually not model failures. They happen because fare locks, seat holds, loyalty validation, payment authorization, ticketing, PNR settlement, retries, and compliance acknowledgements must reconcile across separate systems.',
    tags: ['backend', 'state', 'booking'],
  },
  {
    id: 'purchase-consent',
    title: 'High-Stakes Travel Consent',
    content:
      'The agent may plan and prepare a booking, but final purchase requires explicit user approval after current fare price, restrictions, traveler identity, seat, payment auth, and refund/change rules are visible.',
    tags: ['compliance', 'approval', 'payment'],
  },
  {
    id: 'otp-boundary',
    title: 'Payment Verification Boundary',
    content:
      '3DS and OTP challenges are user-only verification steps. The agent must wait for the user and must not pretend payment verification completed by itself.',
    tags: ['otp', '3ds', 'payment'],
  },
];

export default function RootLayout() {
  const navRef = useNavigationContainerRef();
  const pathname = usePathname();
  const analyticsKey = process.env.EXPO_PUBLIC_MOBILEAI_KEY || '';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlightDemoProvider>
        <AIAgent
          provider="gemini"
          analyticsKey={analyticsKey}
          navRef={navRef}
          pathname={pathname}
          screenMap={screenMap as any}
          enableVoice
          debug
          maxSteps={35}
          accentColor="#2563eb"
          knowledgeBase={FLIGHT_KNOWLEDGE}
          userContext={{
            userId: 'flight_demo_user_001',
            name: 'Demo Traveler',
            email: 'demo.traveler@example.com',
            plan: 'Travel Pro',
          }}
          instructions={{
            system:
              'You are SkyForge Travel’s AI booking copilot. Be honest: planning is easy, execution is constrained by live airline state. Read the app state carefully before acting. Treat flight purchase as high stakes. Ask for permission before app actions, before changing traveler data, before selecting paid seats, before payment, and before final booking. If backend state changes, explain the exact blocker and recover using the visible app workflow. Never claim a booking is complete until a PNR appears on the Confirmation screen.',
            getScreenInstructions: (screenName: string) => {
              if (screenName === 'Payment') {
                return 'Payment verification is user-only. Do not type or invent an OTP. Ask the user to complete the challenge.';
              }
              if (screenName === 'Review') {
                return 'Before final booking, ensure fare restrictions are acknowledged, final availability has been checked, payment is verified, and the user explicitly approves final purchase.';
              }
              return undefined;
            },
          }}
          transformScreenContent={(content: string) =>
            content
              .replace(/\bP\d{7,9}\b/g, 'P********')
              .replace(/\b\d{6}\b/g, '[OTP_MASKED]')
              .replace(/\b4242\b/g, '****')
          }
          onBeforeTask={() => {
            console.log('[SkyForge Audit] Agent task started');
          }}
          onAfterTask={(result: ExecutionResult) => {
            console.log('[SkyForge Audit] Agent task completed:', result.success);
          }}
          onTokenUsage={(usage: TokenUsage) => {
            console.log(`[SkyForge Tokens] ${usage.totalTokens} tokens, $${usage.estimatedCostUSD.toFixed(6)}`);
          }}
        >
          <ThemeProvider value={DefaultTheme}>
            <Stack ref={navRef} screenOptions={{ headerStyle: { backgroundColor: '#15172f' }, headerTintColor: '#fff' }}>
              <Stack.Screen name="index" options={{ title: 'SkyForge Travel' }} />
              <Stack.Screen name="trips" options={{ title: 'Trip Hub' }} />
              <Stack.Screen name="search" options={{ title: 'Trip Search' }} />
              <Stack.Screen name="results" options={{ title: 'Flight Results' }} />
              <Stack.Screen name="fare/[id]" options={{ title: 'Fare Details' }} />
              <Stack.Screen name="traveler" options={{ title: 'Traveler Info' }} />
              <Stack.Screen name="documents" options={{ title: 'Documents' }} />
              <Stack.Screen name="profile" options={{ title: 'Traveler Profile' }} />
              <Stack.Screen name="seats" options={{ title: 'Seat Map' }} />
              <Stack.Screen name="payment" options={{ title: 'Payment Verification' }} />
              <Stack.Screen name="rules" options={{ title: 'Fare Rules' }} />
              <Stack.Screen name="review" options={{ title: 'Booking Review' }} />
              <Stack.Screen name="confirmation" options={{ title: 'Confirmation' }} />
              <Stack.Screen name="ops" options={{ title: 'Ops Log' }} />
            </Stack>
          </ThemeProvider>
        </AIAgent>
      </FlightDemoProvider>
    </GestureHandlerRootView>
  );
}
