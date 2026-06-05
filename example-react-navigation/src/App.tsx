import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AIAgent } from '@mobileai/react-native';
import screenMap from '../ai-screen-map.json';
import type { ExecutionResult, TokenUsage } from '@mobileai/react-native';
import { CartProvider } from './CartContext';
import { AuthProvider, useAuth } from './AuthContext';
import type { MenuItem } from './menuData';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import MenuScreen from './screens/MenuScreen';
import DishDetailScreen from './screens/DishDetailScreen';
import DishReviewsScreen from './screens/DishReviewsScreen';
import ReportIssueScreen from './screens/ReportIssueScreen';
import WriteReviewScreen from './screens/WriteReviewScreen';
import ReviewThanksScreen from './screens/ReviewThanksScreen';
import LoyaltyProgramScreen from './screens/LoyaltyProgramScreen';
import RedeemRewardScreen from './screens/RedeemRewardScreen';
import GiftCardScreen from './screens/GiftCardScreen';
import GiftConfirmationScreen from './screens/GiftConfirmationScreen';
import SearchScreen from './screens/SearchScreen';
import CartScreen from './screens/CartScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import NotificationPrefsScreen from './screens/NotificationPrefsScreen';

// ─── Navigation Types ───────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Menu: { category: string };
  DishDetail: { dish: MenuItem };
  DishReviews: { dishName: string };
  ReportIssue: { dishName: string; reviewId: number };
  WriteReview: { dishName: string };
  ReviewThanks: { dishName: string };
  LoyaltyProgram: undefined;
  RedeemReward: undefined;
  GiftCard: { rewardName: string; pointCost: number };
  GiftConfirmation: { rewardName: string; recipientEmail: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  NotificationPrefs: undefined;
};

// ─── Navigators ─────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
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
        options={{ title: 'FoodApp' }}
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
      <HomeStack.Screen
        name="DishReviews"
        component={DishReviewsScreen}
        options={({ route }) => ({ title: `${route.params.dishName} Reviews` })}
      />
      <HomeStack.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ title: 'Report Issue' }}
      />
      <HomeStack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={({ route }) => ({ title: `Review ${route.params.dishName}` })}
      />
      <HomeStack.Screen
        name="ReviewThanks"
        component={ReviewThanksScreen}
        options={{ title: 'Review Submitted' }}
      />
      <HomeStack.Screen
        name="LoyaltyProgram"
        component={LoyaltyProgramScreen}
        options={{ title: 'Loyalty Program' }}
      />
      <HomeStack.Screen
        name="RedeemReward"
        component={RedeemRewardScreen}
        options={{ title: 'Redeem Rewards' }}
      />
      <HomeStack.Screen
        name="GiftCard"
        component={GiftCardScreen}
        options={{ title: 'Send Gift Card' }}
      />
      <HomeStack.Screen
        name="GiftConfirmation"
        component={GiftConfirmationScreen}
        options={{ title: 'Gift Sent!' }}
      />
    </HomeStack.Navigator>
  );
}

// ─── Settings Stack Navigator ───────────────────────────────

function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={HEADER_STYLE}>
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <SettingsStack.Screen
        name="NotificationPrefs"
        component={NotificationPrefsScreen}
        options={{ title: 'Notification Preferences' }}
      />
    </SettingsStack.Navigator>
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
          tabBarIcon: ({ focused }) => <TabIcon emoji="H" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          ...HEADER_STYLE,
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="S" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: 'Cart',
          ...HEADER_STYLE,
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="C" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          ...HEADER_STYLE,
          headerShown: true,
          tabBarIcon: ({ focused }) => <TabIcon emoji="P" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="G" focused={focused} />,
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
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
          analyticsKey={process.env.EXPO_PUBLIC_MOBILEAI_KEY || ''}
          navRef={navRef}
          screenMap={screenMap}
          maxSteps={25}
          enableVoice
          debug
          instructions={{
            system: 'You are a helpful food delivery assistant. Always be polite.',
            getScreenInstructions: (screenName: string) => {
              if (screenName === 'Cart') {
                return 'SECURITY GUARD: You are on the Cart screen. NEVER execute the "checkout" action without first summarizing the order total and asking the user to confirm using the "ask_user" tool.';
              }
              return undefined;
            },
          }}
          transformScreenContent={(content: string) => {
            return content.replace(/\b(?:\d[ -]*?){13,16}\b/g, '****-****-****-****');
          }}
          onBeforeTask={() => {
            console.log('[SECURITY] Task started. Audit log engaged.');
          }}
          onAfterTask={(result: ExecutionResult) => {
            console.log('[SECURITY] Task completed. Success:', result.success);
            if (result.tokenUsage) {
              console.log(`[COST] Total: ${result.tokenUsage.totalTokens} tokens, $${result.tokenUsage.estimatedCostUSD.toFixed(6)}`);
            }
          }}
          onTokenUsage={(usage: TokenUsage) => {
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
