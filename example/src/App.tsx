import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AIAgent } from '@mobileai/react-native';
import { CartProvider } from './CartContext';
import { AuthProvider, useAuth } from './AuthContext';
import type { MenuItem } from './menuData';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import MenuScreen from './screens/MenuScreen';
import DishDetailScreen from './screens/DishDetailScreen';
import SearchScreen from './screens/SearchScreen';
import CartScreen from './screens/CartScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';

// ─── Navigation Types ───────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Menu: { category: string };
  DishDetail: { dish: MenuItem };
};

// ─── Navigators ─────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator();

// ─── Screen Options ─────────────────────────────────────────

const HEADER_STYLE = {
  headerStyle: { backgroundColor: '#1a1a2e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

// ─── Home Stack Navigator ───────────────────────────────────

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={HEADER_STYLE}>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '🍽️ FoodApp' }}
      />
      <HomeStack.Screen
        name="Menu"
        component={MenuScreen}
        options={({ route }) => ({ title: route.params.category })}
      />
      <HomeStack.Screen
        name="DishDetail"
        component={DishDetailScreen}
        options={({ route }) => ({ title: route.params.dish.name })}
      />
    </HomeStack.Navigator>
  );
}

// ─── Tab Icon Component ─────────────────────────────────────

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

// ─── Main Tabs ──────────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1a1a2e',
        tabBarInactiveTintColor: '#adb5bd',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e9ecef' },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          ...HEADER_STYLE,
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: '🛒 Cart',
          ...HEADER_STYLE,
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          ...HEADER_STYLE,
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          ...HEADER_STYLE,
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Auth Flow ──────────────────────────────────────────────

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Root Navigation ────────────────────────────────────────

function RootNavigator() {
  // const { isLoggedIn } = useAuth();
  // return isLoggedIn ? <MainTabs /> : <AuthFlow />;
  return <MainTabs />;  // Skip login for voice testing
}

// ─── App ────────────────────────────────────────────────────

export default function App() {
  const navRef = useNavigationContainerRef();

  return (
    <AuthProvider>
      <CartProvider>
        <AIAgent
          apiKey={process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''}
          navRef={navRef}
          enableVoice
          enableLive
          debug
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
            return content.replace(/\b(?:\d[ -]*?){13,16}\b/g, '****-****-****-****');
          }}
          onBeforeTask={() => {
            console.log('[SECURITY] Task started. Audit log engaged.');
          }}
          onAfterTask={(result) => {
            console.log('[SECURITY] Task completed. Success:', result.success);
            if (result.tokenUsage) {
              console.log(`[COST] Total: ${result.tokenUsage.totalTokens} tokens, $${result.tokenUsage.estimatedCostUSD.toFixed(6)}`);
            }
          }}
          onTokenUsage={(usage) => {
            console.log(`[TOKENS] Step: ${usage.promptTokens} in / ${usage.completionTokens} out / $${usage.estimatedCostUSD.toFixed(6)}`);
          }}
        >
          <NavigationContainer ref={navRef}>
            <RootNavigator />
          </NavigationContainer>
        </AIAgent>
      </CartProvider>
    </AuthProvider>
  );
}
