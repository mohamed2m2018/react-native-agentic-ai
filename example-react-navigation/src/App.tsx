import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AIAgent } from '@mobileai/react-native';
import screenMap from '../ai-screen-map.json';
import type { ExecutionResult, TokenUsage } from '@mobileai/react-native';
import { CartProvider } from './CartContext';
import { AuthProvider } from './AuthContext';
import type { MenuItem } from './menuData';

// Screens
import HomeScreen from './screens/HomeScreen';
import MenuScreen from './screens/MenuScreen';
import DishDetailScreen from './screens/DishDetailScreen';
import DishReviewsScreen from './screens/DishReviewsScreen';
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
import OrdersListScreen from './screens/OrdersListScreen';
import OrderDetailsScreen from './screens/OrderDetailsScreen';
import DeliveryTrackerScreen from './screens/DeliveryTrackerScreen';
import BillingHistoryScreen from './screens/BillingHistoryScreen';
import ChargeDetailsScreen from './screens/ChargeDetailsScreen';
import SubscriptionManagementScreen from './screens/SubscriptionManagementScreen';
import SubscriptionWorkspaceScreen from './screens/SubscriptionWorkspaceScreen';
import SubscriptionControlsScreen from './screens/SubscriptionControlsScreen';
import SubscriptionPauseScreen from './screens/SubscriptionPauseScreen';
import SubscriptionCancellationScreen from './screens/SubscriptionCancellationScreen';
import LoyaltyActivityScreen from './screens/LoyaltyActivityScreen';
import GiftHistoryScreen from './screens/GiftHistoryScreen';
import GiftDetailsScreen from './screens/GiftDetailsScreen';
import AccountSecurityScreen from './screens/AccountSecurityScreen';

// Advanced Support Scenarios
import AdvancedSupportDashboardScreen from './screens/AdvancedSupportDashboardScreen';
import FraudLockdownScreen from './screens/FraudLockdownScreen';
import FraudQuizScreen from './screens/FraudQuizScreen';
import FraudDeviceScreen from './screens/FraudDeviceScreen';
import FraudResolutionScreen from './screens/FraudResolutionScreen';
import LogisticsEvidenceScreen from './screens/LogisticsEvidenceScreen';
import LogisticsChecklistScreen from './screens/LogisticsChecklistScreen';
import LogisticsResolutionScreen from './screens/LogisticsResolutionScreen';

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

export type ProfileStackParamList = {
  Profile: undefined;
  OrdersList: undefined;
  OrderDetails: { orderId: string };
  DeliveryTracker: { orderId: string };
  BillingHistory: undefined;
  ChargeDetails: { chargeId: string };
  SubscriptionManagement: undefined;
  SubscriptionWorkspace: { subscriptionId: string };
  SubscriptionControls: { subscriptionId: string };
  SubscriptionPause: { subscriptionId: string };
  SubscriptionCancellation: { subscriptionId: string };
  LoyaltyActivity: undefined;
  GiftHistory: undefined;
  GiftDetails: { giftId: string };
  AccountSecurity: undefined;
  ProfileNotificationPrefs: undefined;
  AdvancedSupportDashboard: undefined;
  FraudLockdown: undefined;
  FraudQuiz: undefined;
  FraudDevice: undefined;
  FraudResolution: { revokedCount: number };
  LogisticsEvidence: { disputeId: string };
  LogisticsChecklist: { disputeId: string };
  LogisticsResolution: { disputeId: string };
};

// ─── Navigators ─────────────────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
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

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={HEADER_STYLE}>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <ProfileStack.Screen
        name="OrdersList"
        component={OrdersListScreen}
        options={{ title: 'Orders' }}
      />
      <ProfileStack.Screen
        name="OrderDetails"
        component={OrderDetailsScreen}
        options={{ title: 'Order Details' }}
      />
      <ProfileStack.Screen
        name="DeliveryTracker"
        component={DeliveryTrackerScreen}
        options={{ title: 'Delivery Tracker' }}
      />
      <ProfileStack.Screen
        name="BillingHistory"
        component={BillingHistoryScreen}
        options={{ title: 'Billing History' }}
      />
      <ProfileStack.Screen
        name="ChargeDetails"
        component={ChargeDetailsScreen}
        options={{ title: 'Charge Details' }}
      />
      <ProfileStack.Screen
        name="SubscriptionManagement"
        component={SubscriptionManagementScreen}
        options={{ title: 'Subscriptions' }}
      />
      <ProfileStack.Screen
        name="SubscriptionWorkspace"
        component={SubscriptionWorkspaceScreen}
        options={{ title: 'Subscription Workspace' }}
      />
      <ProfileStack.Screen
        name="SubscriptionControls"
        component={SubscriptionControlsScreen}
        options={{ title: 'Control Room' }}
      />
      <ProfileStack.Screen
        name="SubscriptionPause"
        component={SubscriptionPauseScreen}
        options={{ title: 'Pause Planner' }}
      />
      <ProfileStack.Screen
        name="SubscriptionCancellation"
        component={SubscriptionCancellationScreen}
        options={{ title: 'Cancellation Review' }}
      />
      <ProfileStack.Screen
        name="LoyaltyActivity"
        component={LoyaltyActivityScreen}
        options={{ title: 'Loyalty Activity' }}
      />
      <ProfileStack.Screen
        name="GiftHistory"
        component={GiftHistoryScreen}
        options={{ title: 'Gift History' }}
      />
      <ProfileStack.Screen
        name="GiftDetails"
        component={GiftDetailsScreen}
        options={{ title: 'Gift Details' }}
      />
      <ProfileStack.Screen
        name="AccountSecurity"
        component={AccountSecurityScreen}
        options={{ title: 'Account Security' }}
      />
      <ProfileStack.Screen
        name="ProfileNotificationPrefs"
        component={NotificationPrefsScreen}
        options={{ title: 'Notification Preferences' }}
      />
      <ProfileStack.Screen
        name="AdvancedSupportDashboard"
        component={AdvancedSupportDashboardScreen}
        options={{ title: 'Advanced Support' }}
      />
      <ProfileStack.Screen
        name="FraudLockdown"
        component={FraudLockdownScreen}
        options={{ title: 'Account Locked', gestureEnabled: false, headerBackVisible: false }}
      />
      <ProfileStack.Screen
        name="FraudQuiz"
        component={FraudQuizScreen}
        options={{ title: 'Step 1: Identity' }}
      />
      <ProfileStack.Screen
        name="FraudDevice"
        component={FraudDeviceScreen}
        options={{ title: 'Step 2: Devices' }}
      />
      <ProfileStack.Screen
        name="FraudResolution"
        component={FraudResolutionScreen}
        options={{ title: 'Step 3: Verification Complete', gestureEnabled: false, headerBackVisible: false }}
      />
      <ProfileStack.Screen
        name="LogisticsEvidence"
        component={LogisticsEvidenceScreen}
        options={{ title: 'Missing Order Investigation' }}
      />
      <ProfileStack.Screen
        name="LogisticsChecklist"
        component={LogisticsChecklistScreen}
        options={{ title: 'Mandatory Checks' }}
      />
      <ProfileStack.Screen
        name="LogisticsResolution"
        component={LogisticsResolutionScreen}
        options={{ title: 'Select Resolution' }}
      />
    </ProfileStack.Navigator>
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
        component={ProfileStackNavigator}
        options={{
          title: 'Profile',
          headerShown: false,
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

// ─── Root Navigation ────────────────────────────────────────

function RootNavigator() {
  // const { isLoggedIn } = useAuth();
  // return isLoggedIn ? <MainTabs /> : <AuthFlow />;
  return <MainTabs />; // Skip login for voice testing
}

// ─── App ────────────────────────────────────────────────────

const mockKnowledgeBase = [
  {
    id: 'kb_hours',
    title: 'Operating Hours',
    content:
      'Our food delivery service operates from 8:00 AM to 11:30 PM daily. Orders placed after 11:15 PM will be scheduled for the next morning.',
    tags: ['hours', 'time', 'open', 'close', 'late'],
  },
  {
    id: 'kb_refunds',
    title: 'Refund Policy',
    content:
      'Full refunds are issued automatically if your order is canceled by the restaurant. For missing items, support will issue credit to your wallet within 24 hours. We do not refund delivery fees for late orders unless delayed by more than 45 minutes.',
    tags: ['refund', 'money', 'cancel', 'missing', 'late'],
  },
  {
    id: 'kb_allergies',
    title: 'Allergies and Dietary Restrictions',
    content:
      'When ordering, please leave a note for the restaurant regarding severe allergies. Note that all our franchise kitchens handle peanuts, dairy, and gluten, so cross-contamination is possible. The "Gluten-Free Smash" uses a lettuce wrap instead of a bun.',
    tags: ['allergy', 'peanut', 'gluten', 'diet', 'vegan', 'health'],
  },
  {
    id: 'kb_delivery_fees',
    title: 'Delivery Fee Structure',
    content:
      'Standard delivery is $2.99. Orders over $30 qualify for free delivery automatically. Priority delivery costs an additional $1.99 and guarantees your food is not batched with other orders.',
    tags: ['fee', 'cost', 'delivery', 'priority', 'free'],
  },
  {
    id: 'kb_subscription',
    title: 'Subscription Renewals and Cancellations',
    content:
      'Premium plans renew automatically unless canceled before the renewal timestamp. If a cancellation is marked pending at period end but a charge still posts, support must review the billing log and either explain the renewal or reverse it.',
    tags: ['subscription', 'renewal', 'cancel', 'billing'],
  },
  {
    id: 'kb_loyalty',
    title: 'Loyalty Ledger Timing',
    content:
      'Order points post immediately after a paid order. Review bonuses can take up to 24 hours to sync. Missing points beyond 24 hours should be investigated against the loyalty ledger.',
    tags: ['loyalty', 'points', 'rewards', 'review'],
  },
  {
    id: 'kb_gifts',
    title: 'Gift Card Delivery',
    content:
      'Gift cards are delivered by email. If a send fails because of a bad address, support can confirm the bounce and ask for a corrected recipient before resending.',
    tags: ['gift', 'gift card', 'email', 'delivery'],
  },
  {
    id: 'kb_account',
    title: 'Account Recovery',
    content:
      'Password reset emails can take a few minutes. New devices may still be challenged by two-factor checks or expired remembered-device tokens even after a reset link is sent.',
    tags: ['login', 'reset', '2fa', 'account'],
  },
];

export default function App() {
  const navRef = useNavigationContainerRef();

  return (
    <AuthProvider>
      <CartProvider>
        <AIAgent
          provider="gemini"
          analyticsKey={process.env.EXPO_PUBLIC_MOBILEAI_KEY || ''}
          navRef={navRef}
          screenMap={screenMap}
          maxSteps={25}
          enableVoice
          debug
          knowledgeBase={mockKnowledgeBase}
          userContext={{
            userId: 'usr_abc123',
            name: 'Demo User',
            email: 'demo@example.com',
            plan: 'Premium',
          }}
          pushToken="dummy_fcm_token_123"
          pushTokenType="fcm"
          instructions={{
            system:
              'You are a helpful food delivery assistant. Always be polite. Verify issues against app data before reporting them. Only escalate to a human when direct customer follow-up is needed.',
            getScreenInstructions: (screenName: string) => {
              if (screenName === 'Cart') {
                return 'SECURITY GUARD: You are on the Cart screen. Before using the "checkout" action, briefly summarize the order total. Do not ask_user separately for checkout because the action itself presents the final confirmation alert.';
              }
              return undefined;
            },
          }}
          transformScreenContent={(content: string) => {
            return content.replace(
              /\b(?:\d[ -]*?){13,16}\b/g,
              '****-****-****-****'
            );
          }}
          onBeforeTask={() => {
            console.log('[SECURITY] Task started. Audit log engaged.');
          }}
          onAfterTask={(result: ExecutionResult) => {
            console.log('[SECURITY] Task completed. Success:', result.success);
            if (result.tokenUsage) {
              console.log(
                `[COST] Total: ${result.tokenUsage.totalTokens} tokens, $${result.tokenUsage.estimatedCostUSD.toFixed(6)}`
              );
            }
          }}
          onTokenUsage={(usage: TokenUsage) => {
            console.log(
              `[TOKENS] Step: ${usage.promptTokens} in / ${usage.completionTokens} out / $${usage.estimatedCostUSD.toFixed(6)}`
            );
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
