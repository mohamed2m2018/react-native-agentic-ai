import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AIAgent } from '@mobileai/react-native';
import { CartProvider } from './CartContext';
import HomeScreen from './screens/HomeScreen';
import MenuScreen from './screens/MenuScreen';
import CartScreen from './screens/CartScreen';

// ─── Navigation Types ───────────────────────────────────────

export type RootStackParamList = {
  Home: undefined;
  Menu: { category: string };
  Cart: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── App ────────────────────────────────────────────────────

export default function App() {
  const navRef = useNavigationContainerRef<RootStackParamList>();

  return (
    <CartProvider>
      <AIAgent
        apiKey={process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''}
        navRef={navRef}
        instructions={{
          system: 'You are a helpful food delivery assistant. Always be polite.',
          getScreenInstructions: (screenName) => {
            if (screenName === 'Cart') {
              return 'SECURITY GUARD: You are on the Cart screen. NEVER execute the "checkout" action without first summarizing the order total and asking the user to confirm using the "ask_user" tool.';
            }
            return undefined;
          },
        }}
        transformScreenContent={(content) => {
          // Security: Mask sensitive data like credit card numbers before sending to LLM
          return content.replace(/\b(?:\d[ -]*?){13,16}\b/g, '****-****-****-****');
        }}
        onBeforeTask={() => {
          console.log('[SECURITY] Task started. Audit log engaged.');
        }}
        onAfterTask={(result) => {
          console.log('[SECURITY] Task completed. Success:', result.success);
        }}
      >
        <NavigationContainer ref={navRef}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#1a1a2e' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: '🍽️ FoodApp' }}
            />
            <Stack.Screen
              name="Menu"
              component={MenuScreen}
              options={({ route }) => ({ title: route.params.category })}
            />
            <Stack.Screen
              name="Cart"
              component={CartScreen}
              options={{ title: '🛒 Cart' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AIAgent>
    </CartProvider>
  );
}
