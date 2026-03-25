/**
 * Test App Components — Real React Native components with extreme nesting depth.
 * Modeled after FeedYum's actual component architecture.
 *
 * These are REAL components rendered by react-test-renderer,
 * producing REAL fiber nodes for FiberTreeWalker to traverse.
 */

import React, { useState } from 'react';
import {
  View, Text, Pressable, TextInput, Switch, Image,
  FlatList, SectionList, ScrollView, ActivityIndicator,
  TouchableOpacity, Animated,
} from 'react-native';

// ─── Depth 2: ZText (custom text wrapper) ───────────────────────

export function ZText({ children, type, color, style, ...props }: any) {
  return (
    <Text style={[{ color: color || '#1a1a2e' }, style]} {...props}>
      {children}
    </Text>
  );
}
ZText.displayName = 'ZText';

// ─── Depth 3: ZButton (TouchableOpacity → ZText → Text) ────────

export function ZButton({ title, onPress, disabled, isLoading, ...props }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      {...props}
    >
      <ZText type="b16">{title}</ZText>
      {isLoading && <ActivityIndicator size="small" />}
    </TouchableOpacity>
  );
}
ZButton.displayName = 'ZButton';

// ─── Depth 4: ZInput (View → label + TextInput + error) ────────

export function ZInput({
  label, placeholder, value, onChangeText,
  errorText, secureTextEntry, editable = true,
  leftIcon, rightAccessory, required,
}: any) {
  return (
    <View>
      {label && (
        <View>
          <View style={{ flexDirection: 'row' }}>
            <ZText type="b18">{label}</ZText>
            {required && <ZText style={{ color: 'red' }}> *</ZText>}
          </View>
        </View>
      )}
      <View style={{ borderWidth: 1, borderRadius: 15, flexDirection: 'row' }}>
        {leftIcon && <View>{leftIcon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          editable={editable}
        />
        {rightAccessory && <View>{rightAccessory}</View>}
      </View>
      {errorText && <ZText style={{ color: 'red' }}>{errorText}</ZText>}
    </View>
  );
}
ZInput.displayName = 'ZInput';

// ─── Depth 4: StarRatingInput (5 tappable stars) ───────────────

export function StarRatingInput({ rating = 0, onRatingChange }: any) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Pressable
          key={star}
          onPress={() => onRatingChange?.(star)}
          accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <View>
            <Text>{star <= rating ? '★' : '☆'}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
StarRatingInput.displayName = 'StarRatingInput';

// ─── Depth 3: StarRating (display only, not interactive) ────────

export function StarRating({ rating = 0 }: any) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <View key={star}>
          <Text>{star <= rating ? '★' : '☆'}</Text>
        </View>
      ))}
      <ZText>{rating.toFixed(1)}</ZText>
    </View>
  );
}
StarRating.displayName = 'StarRating';

// ─── Depth 4: QuantityControl (- count +) ──────────────────────

export function QuantityControl({ quantity = 0, onIncrement, onDecrement }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={onDecrement}>
        <Text>-</Text>
      </TouchableOpacity>
      <ZText type="b14">{String(quantity)}</ZText>
      <TouchableOpacity onPress={onIncrement}>
        <Text>+</Text>
      </TouchableOpacity>
    </View>
  );
}
QuantityControl.displayName = 'QuantityControl';

// ─── Depth 5: PhoneInput (country picker + ZInput) ─────────────

export function PhoneInput({ countryCode = '+20', phoneNumber, onChangePhone, onChangeCountry }: any) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <TouchableOpacity onPress={onChangeCountry}>
        <ZText>{countryCode}</ZText>
      </TouchableOpacity>
      <ZInput
        placeholder="Phone number"
        value={phoneNumber}
        onChangeText={onChangePhone}
      />
    </View>
  );
}
PhoneInput.displayName = 'PhoneInput';

// ─── Depth 4: PromoCodeInput (ZInput + Apply button) ───────────

export function PromoCodeInput({ code, onChangeCode, onApply, isLoading }: any) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <ZInput
        placeholder="Enter promo code"
        value={code}
        onChangeText={onChangeCode}
      />
      <ZButton title="Apply" onPress={onApply} isLoading={isLoading} />
    </View>
  );
}
PromoCodeInput.displayName = 'PromoCodeInput';

// ─── Depth 5: AddressCard (select + edit button) ───────────────

export function AddressCard({ label, address, onSelect, onEdit }: any) {
  return (
    <TouchableOpacity onPress={onSelect}>
      <View>
        <ZText type="b16">{label}</ZText>
        <ZText>{address}</ZText>
      </View>
      <TouchableOpacity onPress={onEdit}>
        <Text>Edit</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
AddressCard.displayName = 'AddressCard';

// ─── Depth 6: DishCard (nested interactives, Animated wrapper) ─

export function DishCard({ name, price, rating = 0, imageUri, onCardPress, onAddPress }: any) {
  return (
    <Animated.View style={{ transform: [{ scale: 1 }] }}>
      <TouchableOpacity onPress={onCardPress}>
        {imageUri && <Image source={{ uri: imageUri }} style={{ width: 100, height: 100 }} />}
        <View>
          <ZText type="b16">{name}</ZText>
          <ZText type="b14">{price} EGP</ZText>
          {rating > 0 && <StarRating rating={rating} />}
        </View>
        <Animated.View style={{ transform: [{ scale: 1 }] }}>
          <TouchableOpacity onPress={onAddPress} accessibilityLabel="Add to cart">
            <Text>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}
DishCard.displayName = 'DishCard';

// ─── Depth 7: KitchenCard (nested DishCards + FollowButton) ────

export function FollowButton({ isFollowing, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress}>
      <ZText>{isFollowing ? 'Following' : 'Follow'}</ZText>
    </TouchableOpacity>
  );
}
FollowButton.displayName = 'FollowButton';

export function KitchenCard({ name, rating, deliveryTime, dishes, onPress, onFollow, onDishPress, onDishAdd }: any) {
  return (
    <TouchableOpacity onPress={onPress}>
      <View>
        <ZText type="b18">{name}</ZText>
        <View style={{ flexDirection: 'row' }}>
          <ZText>★ {rating?.toFixed(1)}</ZText>
          <ZText>{deliveryTime}</ZText>
        </View>
        <FollowButton isFollowing={false} onPress={onFollow} />
      </View>
      <FlatList
        horizontal
        data={dishes || []}
        keyExtractor={(item: any) => item.name}
        renderItem={({ item }: any) => (
          <DishCard
            name={item.name}
            price={item.price}
            rating={item.rating}
            onCardPress={() => onDishPress?.(item)}
            onAddPress={() => onDishAdd?.(item)}
          />
        )}
      />
    </TouchableOpacity>
  );
}
KitchenCard.displayName = 'KitchenCard';

// ─── Depth 6: CartItemRow (Image + info + QuantityControl + remove) ─

export function CartItemRow({ name, kitchenName, price, quantity, onIncrement, onDecrement, onRemove }: any) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View>
        <ZText type="b16">{name}</ZText>
        <ZText>{kitchenName}</ZText>
        <ZText type="b14">{price} EGP</ZText>
      </View>
      <QuantityControl quantity={quantity} onIncrement={onIncrement} onDecrement={onDecrement} />
      <TouchableOpacity onPress={onRemove} accessibilityLabel="Remove item">
        <Text>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}
CartItemRow.displayName = 'CartItemRow';

// ─── Overlays ───────────────────────────────────────────────────

export function ToastOverlay({ message, type = 'success', visible = true }: any) {
  if (!visible) return null;
  return (
    <View style={{ position: 'absolute' as const, zIndex: 999 }}>
      <Animated.View>
        <Text>{type === 'success' ? '✓' : '✕'}</Text>
        <Text>{message}</Text>
      </Animated.View>
    </View>
  );
}
ToastOverlay.displayName = 'Toast';

export function BottomSheetModal({ title, visible = true, children }: any) {
  if (!visible) return null;
  return (
    <View style={{ position: 'absolute' as const, zIndex: 500 }}>
      <Animated.View>
        <View style={{ width: 40, height: 4, backgroundColor: '#ccc', alignSelf: 'center' as const }} />
        <Text>{title}</Text>
        {children}
      </Animated.View>
    </View>
  );
}
BottomSheetModal.displayName = 'BottomSheet';

// ─── Wizard Stepper ─────────────────────────────────────────────

export function WizardStepper({ steps, currentStep }: any) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {(steps || []).map((step: string, i: number) => (
        <View key={i}>
          <View>
            <Text>{i < currentStep ? '✓' : String(i + 1)}</Text>
          </View>
          <Text>{step}</Text>
        </View>
      ))}
    </View>
  );
}
WizardStepper.displayName = 'WizardStepper';

// ─── Category Pill ──────────────────────────────────────────────

export function CategoryPill({ label, isActive, onPress }: any) {
  return (
    <Pressable onPress={onPress}>
      <ZText>{label}</ZText>
    </Pressable>
  );
}
CategoryPill.displayName = 'CategoryPill';
