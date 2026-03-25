/**
 * Test Screens — Real React Native screens with complex layouts.
 * Each screen uses the custom components from components.tsx,
 * producing deeply nested fiber trees for stress-testing.
 */

import React, { useState } from 'react';
import {
  View, Text, Pressable, TextInput, Switch, Image,
  FlatList, SectionList, ScrollView, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  ZButton, ZInput, ZText, StarRatingInput, StarRating,
  QuantityControl, PhoneInput, PromoCodeInput, AddressCard,
  DishCard, KitchenCard, CartItemRow, FollowButton,
  ToastOverlay, BottomSheetModal, WizardStepper, CategoryPill,
} from './components';

// ─── Auth Screens ───────────────────────────────────────────────

export function LoginScreen({ onLogin }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <View>
      <ZText type="h1">Welcome Back</ZText>
      <ZInput label="Email" placeholder="Enter your email" value={email} onChangeText={setEmail} required />
      <ZInput label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} secureTextEntry />
      <ZButton title="Sign In" onPress={() => onLogin?.(email, password)} />
      <Pressable onPress={() => {}}>
        <ZText>Forgot Password?</ZText>
      </Pressable>
      <Pressable onPress={() => {}}>
        <ZText>Create Account</ZText>
      </Pressable>
    </View>
  );
}

export function SignupScreen({ onSignup }: any) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  return (
    <View>
      <WizardStepper steps={['Info', 'Contact', 'Security']} currentStep={step} />
      {step === 1 && (
        <View>
          <ZInput label="Full Name" placeholder="Your name" value={name} onChangeText={setName} required />
          <ZInput label="Email" placeholder="Your email" value={email} onChangeText={setEmail} required />
          <ZButton title="Next" onPress={() => setStep(2)} />
        </View>
      )}
      {step === 2 && (
        <View>
          <PhoneInput phoneNumber={phone} onChangePhone={setPhone} />
          <ZButton title="Next" onPress={() => setStep(3)} />
          <ZButton title="Back" onPress={() => setStep(1)} />
        </View>
      )}
      {step === 3 && (
        <View>
          <ZInput label="Password" placeholder="Create password" value={password} onChangeText={setPassword} secureTextEntry required />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Switch value={agreed} onValueChange={setAgreed} />
            <ZText>I agree to Terms & Conditions</ZText>
          </View>
          <ZButton title="Sign Up" onPress={() => onSignup?.({ name, email, phone, password })} disabled={!agreed} />
          <ZButton title="Back" onPress={() => setStep(2)} />
        </View>
      )}
    </View>
  );
}

export function ForgotPasswordScreen({ onSubmit }: any) {
  const [email, setEmail] = useState('');
  return (
    <View>
      <ZText type="h1">Reset Password</ZText>
      <ZText>Enter your email to receive a reset link</ZText>
      <ZInput label="Email" placeholder="Enter your email" value={email} onChangeText={setEmail} required />
      <ZButton title="Send Reset Link" onPress={() => onSubmit?.(email)} />
    </View>
  );
}

// ─── Home Screens ───────────────────────────────────────────────

export function HomeScreen({ kitchens, onKitchenPress, onDishPress, onDishAdd, onFollow, onRefresh, isRefreshing }: any) {
  const sections = [
    { title: 'Featured Kitchens', data: (kitchens || []).slice(0, 3) },
    { title: 'Near You', data: (kitchens || []).slice(0, 2) },
    { title: 'Top Rated', data: (kitchens || []).slice(0, 2) },
  ];

  return (
    <View>
      <ZText type="h1">Discover</ZText>
      <SectionList
        sections={sections}
        keyExtractor={(item: any) => item.name}
        renderSectionHeader={({ section }: any) => (
          <ZText type="b18">{section.title}</ZText>
        )}
        renderItem={({ item }: any) => (
          <KitchenCard
            name={item.name}
            rating={item.rating}
            deliveryTime={item.deliveryTime}
            dishes={item.dishes}
            onPress={() => onKitchenPress?.(item)}
            onFollow={() => onFollow?.(item)}
            onDishPress={onDishPress}
            onDishAdd={onDishAdd}
          />
        )}
      />
    </View>
  );
}

export function MenuScreen({ items, isLoading, isLoadingMore, onAddToCart, onDishPress }: any) {
  if (isLoading) {
    return (
      <View>
        <ActivityIndicator size="large" />
        <ZText>Loading menu...</ZText>
      </View>
    );
  }

  return (
    <View>
      <ZText type="h1">Menu</ZText>
      <ZText>Showing {(items || []).length} items</ZText>
      <FlatList
        data={items || []}
        keyExtractor={(item: any) => item.name}
        renderItem={({ item }: any) => (
          <DishCard
            name={item.name}
            price={item.price}
            rating={item.rating}
            imageUri={item.imageUri}
            onCardPress={() => onDishPress?.(item)}
            onAddPress={() => onAddToCart?.(item)}
          />
        )}
        ListFooterComponent={isLoadingMore ? (
          <View>
            <ActivityIndicator size="small" />
            <ZText>Loading more...</ZText>
          </View>
        ) : null}
      />
    </View>
  );
}

export function DishDetailScreen({ dish, onAddToCart, onWriteReview }: any) {
  return (
    <ScrollView>
      {dish?.imageUri && <Image source={{ uri: dish.imageUri }} style={{ width: '100%' as any, height: 200 }} />}
      <ZText type="h1">{dish?.name}</ZText>
      <ZText>{dish?.description}</ZText>
      <ZText type="b18">{dish?.price} EGP</ZText>
      {dish?.rating > 0 && <StarRating rating={dish.rating} />}
      <ZButton
        title={dish?.soldOut ? 'Sold Out' : 'Add to Cart'}
        onPress={() => onAddToCart?.(dish)}
        disabled={dish?.soldOut}
      />
      <ZButton title="Write a Review" onPress={() => onWriteReview?.(dish)} />
    </ScrollView>
  );
}

export function WriteReviewScreen({ dishName, onSubmitReview }: any) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  return (
    <View>
      <ZText type="h1">Review {dishName}</ZText>
      <StarRatingInput rating={rating} onRatingChange={setRating} />
      <ZInput label="Your Review" placeholder="Write your review..." value={text} onChangeText={setText} multiline />
      <ZButton title="Submit Review" onPress={() => onSubmitReview?.({ rating, text })} />
    </View>
  );
}

export function ReviewThanksScreen() {
  return (
    <View>
      <ZText type="h1">Thank You!</ZText>
      <ZText>Your review has been submitted.</ZText>
    </View>
  );
}

// ─── Search Screens ─────────────────────────────────────────────

export function SearchScreen({ categories, recentSearches, onSearch, onCategoryPress }: any) {
  const [query, setQuery] = useState('');
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <ZInput placeholder="Search dishes, kitchens..." value={query} onChangeText={setQuery} />
        <ZButton title="Search" onPress={() => onSearch?.(query)} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {(categories || []).map((cat: string) => (
          <CategoryPill key={cat} label={cat} onPress={() => onCategoryPress?.(cat)} />
        ))}
      </View>
      {(recentSearches || []).length > 0 && (
        <View>
          <ZText type="b16">Recent Searches</ZText>
          {recentSearches.map((s: string, i: number) => (
            <Pressable key={i} onPress={() => onSearch?.(s)}>
              <ZText>{s}</ZText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function SearchResultsScreen({ results, onDishPress, onDishAdd }: any) {
  const sections = [
    { title: 'Dishes', data: (results?.dishes || []) },
    { title: 'Kitchens', data: (results?.kitchens || []) },
  ];
  return (
    <View>
      <ZText type="h1">Search Results</ZText>
      <SectionList
        sections={sections}
        keyExtractor={(item: any, i: number) => `${item.name}-${i}`}
        renderSectionHeader={({ section }: any) => <ZText type="b18">{section.title}</ZText>}
        renderItem={({ item, section }: any) => {
          if (section.title === 'Dishes') {
            return (
              <DishCard
                name={item.name}
                price={item.price}
                rating={item.rating}
                onCardPress={() => onDishPress?.(item)}
                onAddPress={() => onDishAdd?.(item)}
              />
            );
          }
          return (
            <TouchableOpacity onPress={() => {}}>
              <ZText type="b16">{item.name}</ZText>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ─── Cart Screens ───────────────────────────────────────────────

export function CartScreen({ items, onIncrement, onDecrement, onRemove, onCheckout, onApplyPromo }: any) {
  const [promoCode, setPromoCode] = useState('');
  const total = (items || []).reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  if (!items || items.length === 0) {
    return (
      <View>
        <ZText type="h1">Your Cart</ZText>
        <ZText>Cart is empty</ZText>
        <ZText>Add some delicious dishes!</ZText>
      </View>
    );
  }

  return (
    <View>
      <ZText type="h1">Your Cart</ZText>
      <FlatList
        data={items}
        keyExtractor={(item: any, i: number) => `${item.name}-${i}`}
        renderItem={({ item, index }: any) => (
          <CartItemRow
            name={item.name}
            kitchenName={item.kitchenName}
            price={item.price}
            quantity={item.quantity}
            onIncrement={() => onIncrement?.(index)}
            onDecrement={() => onDecrement?.(index)}
            onRemove={() => onRemove?.(index)}
          />
        )}
      />
      <PromoCodeInput
        code={promoCode}
        onChangeCode={setPromoCode}
        onApply={() => onApplyPromo?.(promoCode)}
      />
      <ZText type="b18">Total: {total} EGP</ZText>
      {/* @ts-ignore - aiIgnore is custom prop */}
      <Pressable onPress={onCheckout} aiIgnore>
        <ZText type="b18">Checkout</ZText>
      </Pressable>
    </View>
  );
}

export function CheckoutWizardScreen({ onConfirm, onScheduleChange, onAddressSave }: any) {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [cardNumber, setCardNumber] = useState('');

  return (
    <View>
      <WizardStepper steps={['Address', 'Schedule', 'Payment']} currentStep={step} />
      {step === 1 && (
        <View>
          <ZText type="b18">Delivery Address</ZText>
          <ZInput label="Address" placeholder="Enter your address" value={address} onChangeText={setAddress} required />
          <AddressCard label="Home" address="123 Main St" onSelect={() => setAddress('123 Main St')} onEdit={() => {}} />
          <AddressCard label="Work" address="456 Office Blvd" onSelect={() => setAddress('456 Office Blvd')} onEdit={() => {}} />
          <ZButton title="Continue" onPress={() => { onAddressSave?.(address); setStep(2); }} />
        </View>
      )}
      {step === 2 && (
        <View>
          <ZText type="b18">Schedule Delivery</ZText>
          <ZInput label="Date" placeholder="Select date" value={date} onChangeText={setDate} />
          <View>
            {['12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM'].map(slot => (
              <Pressable key={slot} onPress={() => { setTimeSlot(slot); onScheduleChange?.({ date, timeSlot: slot }); }}>
                <ZText style={timeSlot === slot ? { fontWeight: 'bold' } : {}}>{slot}</ZText>
              </Pressable>
            ))}
          </View>
          <ZButton title="Continue" onPress={() => setStep(3)} />
          <ZButton title="Back" onPress={() => setStep(1)} />
        </View>
      )}
      {step === 3 && (
        <View>
          <ZText type="b18">Payment</ZText>
          <ZInput label="Card Number" placeholder="**** **** **** ****" value={cardNumber} onChangeText={setCardNumber} />
          <ZText>Order Total: 150 EGP</ZText>
          <ZButton title="Confirm Order" onPress={() => onConfirm?.({ address, date, timeSlot, cardNumber })} />
          <ZButton title="Back" onPress={() => setStep(2)} />
        </View>
      )}
    </View>
  );
}

export function OrderConfirmationScreen() {
  return (
    <View>
      <ZText type="h1">Order Confirmed!</ZText>
      <ZText>Your order is being prepared.</ZText>
    </View>
  );
}

export function OrderTrackingScreen({ orderId, status }: any) {
  const statuses = ['Preparing', 'Cooking', 'On the Way', 'Delivered'];
  return (
    <View>
      <ZText type="h1">Order #{orderId}</ZText>
      {statuses.map((s, i) => (
        <View key={s}>
          <ZText style={s === status ? { fontWeight: 'bold' } : {}}>{s}</ZText>
        </View>
      ))}
      <ZText>Estimated: 30 min</ZText>
    </View>
  );
}

// ─── Social Screens ─────────────────────────────────────────────

export function ChatListScreen({ conversations, onConversationPress }: any) {
  return (
    <View>
      <ZText type="h1">Messages</ZText>
      <FlatList
        data={conversations || []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: any) => (
          <TouchableOpacity onPress={() => onConversationPress?.(item)}>
            <View style={{ flexDirection: 'row' }}>
              <View>
                <ZText type="b16">{item.name}</ZText>
                <ZText>{item.lastMessage}</ZText>
              </View>
              {item.unread > 0 && (
                <View>
                  <ZText>{item.unread}</ZText>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

export function ChatScreen({ messages, onSendMessage }: any) {
  const [text, setText] = useState('');
  return (
    <View>
      <FlatList
        data={messages || []}
        keyExtractor={(item: any, i: number) => `msg-${i}`}
        renderItem={({ item }: any) => (
          <View>
            <ZText type="b14">{item.sender}</ZText>
            <ZText>{item.text}</ZText>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row' }}>
        <ZInput placeholder="Type a message..." value={text} onChangeText={setText} />
        <ZButton title="Send" onPress={() => { onSendMessage?.(text); setText(''); }} />
      </View>
    </View>
  );
}

// ─── Profile Screens ────────────────────────────────────────────

export function ProfileScreen({ user, onEditProfile, onSettings, onAddressBook }: any) {
  return (
    <ScrollView>
      <View style={{ alignItems: 'center' }}>
        <ZText type="h1">{user?.name || 'User'}</ZText>
        <ZText>{user?.email}</ZText>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View><ZText type="b18">{user?.orders || 0}</ZText><ZText>Orders</ZText></View>
        <View><ZText type="b18">{user?.reviews || 0}</ZText><ZText>Reviews</ZText></View>
        <View><ZText type="b18">{user?.points || 0}</ZText><ZText>Points</ZText></View>
      </View>
      <ZButton title="Edit Profile" onPress={onEditProfile} />
      <ZButton title="Address Book" onPress={onAddressBook} />
      <ZButton title="Settings" onPress={onSettings} />
    </ScrollView>
  );
}

export function EditProfileScreen({ user, onSave }: any) {
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  return (
    <View>
      <ZText type="h1">Edit Profile</ZText>
      <ZInput label="Name" placeholder="Your name" value={name} onChangeText={setName} />
      <ZInput label="Bio" placeholder="Tell us about yourself" value={bio} onChangeText={setBio} multiline />
      <PhoneInput phoneNumber={phone} onChangePhone={setPhone} />
      <ZButton title="Save Changes" onPress={() => onSave?.({ name, bio, phone })} />
    </View>
  );
}

// ─── Settings Screens ───────────────────────────────────────────

export function SettingsScreen({ onToggle, onSliderChange }: any) {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [location, setLocation] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);

  const toggleAndNotify = (key: string, value: boolean, setter: any) => {
    setter(value);
    onToggle?.(key, value);
  };

  return (
    <ScrollView>
      <ZText type="h1">Settings</ZText>
      <View>
        <ZText>Dark Mode</ZText>
        <Switch value={darkMode} onValueChange={v => toggleAndNotify('darkMode', v, setDarkMode)} />
      </View>
      <View>
        <ZText>Push Notifications</ZText>
        <Switch value={notifications} onValueChange={v => toggleAndNotify('notifications', v, setNotifications)} />
      </View>
      <View>
        <ZText>Location Services</ZText>
        <Switch value={location} onValueChange={v => toggleAndNotify('location', v, setLocation)} />
      </View>
      <View>
        <ZText>Analytics</ZText>
        <Switch value={analytics} onValueChange={v => toggleAndNotify('analytics', v, setAnalytics)} />
      </View>
      <View>
        <ZText>Auto-play Videos</ZText>
        <Switch value={autoPlay} onValueChange={v => toggleAndNotify('autoPlay', v, setAutoPlay)} />
      </View>
    </ScrollView>
  );
}

export function NotificationPrefsScreen({ onToggle }: any) {
  const categories = ['Orders', 'Promotions', 'Messages', 'Reviews', 'Delivery', 'Loyalty', 'System', 'Marketing'];
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map(c => [c, false]))
  );

  return (
    <ScrollView>
      <ZText type="h1">Notification Preferences</ZText>
      {categories.map(cat => (
        <View key={cat} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <ZText>{cat}</ZText>
          <Switch
            value={prefs[cat]}
            onValueChange={v => {
              setPrefs(prev => ({ ...prev, [cat]: v }));
              onToggle?.(cat, v);
            }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

export function AddressBookScreen({ addresses, onAddAddress, onEditAddress, onSelectAddress }: any) {
  return (
    <View>
      <ZText type="h1">Address Book</ZText>
      <FlatList
        data={addresses || []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: any) => (
          <AddressCard
            label={item.label}
            address={item.address}
            onSelect={() => onSelectAddress?.(item)}
            onEdit={() => onEditAddress?.(item)}
          />
        )}
      />
      <ZButton title="Add New Address" onPress={onAddAddress} />
    </View>
  );
}

export function LoyaltyScreen({ points, rewards, onRedeem }: any) {
  return (
    <View>
      <ZText type="h1">Loyalty Program</ZText>
      <ZText type="b18">Your Points: {points || 0}</ZText>
      <FlatList
        data={rewards || []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: any) => (
          <View style={{ flexDirection: 'row' }}>
            <View>
              <ZText type="b16">{item.name}</ZText>
              <ZText>{item.points} points</ZText>
            </View>
            <ZButton
              title="Redeem"
              onPress={() => onRedeem?.(item)}
              disabled={(points || 0) < item.points}
            />
          </View>
        )}
      />
    </View>
  );
}

// ─── Onboarding ─────────────────────────────────────────────────

export function OnboardingScreen({ onFinish }: any) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { title: 'Discover Local Kitchens', body: 'Find home-cooked meals near you' },
    { title: 'Order Easily', body: 'Add dishes and checkout in seconds' },
    { title: 'Track in Real-Time', body: 'Watch your order from kitchen to door' },
    { title: 'Rate & Review', body: 'Help the community find great food' },
  ];

  return (
    <View>
      <View>
        <ZText type="h1">{slides[currentSlide]?.title}</ZText>
        <ZText>{slides[currentSlide]?.body}</ZText>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {slides.map((_, i) => (
          <View key={i}>
            <Text>{i === currentSlide ? '●' : '○'}</Text>
          </View>
        ))}
      </View>
      {currentSlide < slides.length - 1 ? (
        <View>
          <ZButton title="Next" onPress={() => setCurrentSlide(c => c + 1)} />
          <Pressable onPress={onFinish}>
            <ZText>Skip</ZText>
          </Pressable>
        </View>
      ) : (
        <ZButton title="Get Started" onPress={onFinish} />
      )}
    </View>
  );
}

// ─── Stress Screen (100+ elements) ──────────────────────────────

export function StressScreen({ itemCount = 100, onItemPress }: any) {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: String(i),
    name: `Item ${i}`,
    price: (i + 1) * 10,
  }));

  return (
    <View>
      <ZText type="h1">Stress Test ({itemCount} items)</ZText>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onItemPress?.(item)}>
            <ZText>{item.name}</ZText>
            <ZText>{item.price} EGP</ZText>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
