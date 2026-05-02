/**
 * AIConsentDialog — Apple App Store Guideline 5.1.2(i) compliant consent flow.
 *
 * Displays a modal before the first AI interaction that:
 * 1. Names the specific third-party AI provider (e.g., "Google Gemini")
 * 2. Explains what data is shared (screen content, messages)
 * 3. Collects explicit user consent via affirmative tap
 *
 * Consent is session-scoped by default, and can be persisted when the host app
 * installs @react-native-async-storage/async-storage and sets consent.persist.
 *
 * ## Business rationale
 * Apple rejects apps that silently send personal data to third-party AI services.
 * This component ensures compliance WITHOUT the app developer needing to build
 * their own consent flow — they just set `requireConsent={true}` on <AIAgent>.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Linking,
  Animated,
} from 'react-native';
import type { AIProviderName } from '../core/types';
import { isNativeOverlayActive } from './FloatingOverlayWrapper';

const CONSENT_STORAGE_KEY = '@mobileai_ai_consent_granted';
let sessionConsentGranted = false;

function getConsentStorage(): any | null {
  try {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('AsyncStorage')) return;
      origError.apply(console, args);
    };
    try {
      const mod = require('@react-native-async-storage/async-storage');
      const candidate = mod?.default ?? mod?.AsyncStorage ?? null;
      return candidate && typeof candidate.getItem === 'function'
        ? candidate
        : null;
    } finally {
      console.error = origError;
    }
  } catch {
    return null;
  }
}

// ─── Provider Display Names ───────────────────────────────────

const PROVIDER_INFO: Record<AIProviderName, { name: string; company: string; url: string }> = {
  gemini: {
    name: 'Google Gemini',
    company: 'Google',
    url: 'https://ai.google.dev/terms',
  },
  openai: {
    name: 'OpenAI GPT',
    company: 'OpenAI',
    url: 'https://openai.com/policies/terms-of-use',
  },
};

export const DEFAULT_CONSENT_THEME = {
  backdrop: 'rgba(9, 12, 16, 0.52)',
  cardBackground: '#ffffff',
  cardBorder: 'rgba(15, 23, 42, 0.08)',
  iconBackground: '#eef4ff',
  iconColor: '#3156d3',
  title: '#111827',
  body: '#4b5563',
  muted: '#6b7280',
  sectionBackground: '#f8fafc',
  sectionBorder: 'rgba(148, 163, 184, 0.22)',
  bullet: '#3156d3',
  badgeBackground: '#eef4ff',
  badgeText: '#3156d3',
  secondaryButtonBackground: '#f3f4f6',
  secondaryButtonText: '#374151',
  primaryButtonBackground: '#111827',
  primaryButtonText: '#ffffff',
  link: '#3156d3',
};

export function resolveConsentDialogContent(
  provider: AIProviderName,
  config: AIConsentConfig,
  language: 'en' | 'ar' = 'en'
) {
  const isArabic = language === 'ar';
  const providerInfo = PROVIDER_INFO[provider] || PROVIDER_INFO.gemini;
  const theme = { ...DEFAULT_CONSENT_THEME, ...(config.theme || {}) };
  const providerLabel = config.providerLabel || (
    isArabic
      ? 'خدمة الذكاء الاصطناعي المفعلة في التطبيق'
      : 'the AI service configured for this app'
  );
  const providerUrl = config.providerUrl || providerInfo.url;
  const showProviderBadge = config.showProviderBadge === true;
  const title = isArabic
    ? (config.titleAr || 'مساعد الذكاء الاصطناعي')
    : (config.title || 'AI Assistant');
  const sharedDataItems = isArabic
    ? (config.sharedDataItemsAr || ['رسالتك', 'يستخدم فقط المعلومات الظاهرة في شاشة التطبيق الحالية لفهم السياق'])
    : (config.sharedDataItems || ['Your message', 'Relevant information from the current app screen']);

  return {
    isArabic,
    providerInfo,
    theme,
    providerLabel,
    providerUrl,
    showProviderBadge,
    title,
    sharedDataItems,
  };
}

// ─── Public Types ─────────────────────────────────────────────

export interface AIConsentConfig {
  /**
   * Whether consent is required before AI interactions.
   * When true, the agent will NOT send any data to the AI provider
   * until the user explicitly consents.
   * @default true
   */
  required?: boolean;

  /**
   * Whether to persist the consent decision across app restarts.
   * When false, the user must consent every time they launch the app.
   * When true, the decision is saved locally (e.g. AsyncStorage) and
   * the dialog is shown only once per device.
   * @default false
   */
  persist?: boolean;

  /**
   * Optional custom title for the consent dialog.
   * Default: "AI Assistant"
   */
  title?: string;

  /**
   * Optional custom body text.
   * Default: Auto-generated based on provider name.
   */
  body?: string;

  /**
   * Optional custom title for the consent dialog (Arabic).
   * Default: "مساعد الذكاء الاصطناعي"
   */
  titleAr?: string;

  /**
   * Optional custom body text (Arabic).
   * Default: Auto-generated based on provider name.
   */
  bodyAr?: string;

  /**
   * URL to the app's privacy policy.
   * If provided, a "Privacy Policy" link is shown in the dialog.
   */
  privacyPolicyUrl?: string;

  /**
   * Callback fired when user grants consent.
   */
  onConsent?: () => void;

  /**
   * Callback fired when user declines consent.
   */
  onDecline?: () => void;

  /**
   * Optional developer-controlled provider label.
   * Example: "FoodApp AI" or "Secure AI Service".
   * If omitted, the dialog uses a neutral generic label by default.
   */
  providerLabel?: string;

  /**
   * Optional provider company/owner name shown in the description.
   */
  providerCompany?: string;

  /**
   * Optional URL to provider terms or documentation.
   */
  providerUrl?: string;

  /**
   * Show or hide the small provider badge.
   * Default: false
   */
  showProviderBadge?: boolean;

  /**
   * Optional override for the provider badge text.
   */
  providerBadgeText?: string;

  /**
   * Optional softer explanation shown above the shared-data list.
   */
  summary?: string;

  /**
   * Optional calmer explanation shown above the shared-data list (Arabic).
   */
  summaryAr?: string;

  /**
   * Optional custom list of shared-data lines.
   */
  sharedDataItems?: string[];

  /**
   * Optional custom list of shared-data lines (Arabic).
   */
  sharedDataItemsAr?: string[];

  /**
   * Theme colors for the consent dialog.
   */
  theme?: Partial<typeof DEFAULT_CONSENT_THEME>;
}

// ─── Props ────────────────────────────────────────────────────

interface AIConsentDialogProps {
  visible: boolean;
  provider: AIProviderName;
  config: AIConsentConfig;
  onConsent: () => void;
  onDecline: () => void;
  language?: 'en' | 'ar';
}

// ─── Component ────────────────────────────────────────────────

export function AIConsentDialog({
  visible,
  provider,
  config,
  onConsent,
  onDecline,
  language = 'en',
}: AIConsentDialogProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const isArabic = language === 'ar';
  const {
    theme,
    providerLabel,
    providerUrl,
    showProviderBadge,
    title,
    sharedDataItems,
  } = resolveConsentDialogContent(provider, config, language);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  const handlePrivacyPolicy = useCallback(() => {
    if (config.privacyPolicyUrl) {
      Linking.openURL(config.privacyPolicyUrl);
    }
  }, [config.privacyPolicyUrl]);

  const ContentWrapper = isNativeOverlayActive ? View : Modal;
  const wrapperProps = isNativeOverlayActive
    ? { style: [StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }], pointerEvents: 'auto' as const }
    : {
        visible,
        transparent: true,
        animationType: "none" as const,
        statusBarTranslucent: true,
        onRequestClose: onDecline,
      };

  if (!visible) return null;

  return (
    <ContentWrapper {...(wrapperProps as any)}>
      <View style={[dialogStyles.backdrop, { backgroundColor: theme.backdrop }]}>
        <Animated.View
          style={[
            dialogStyles.card,
            {
              opacity: fadeAnim,
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {/* Shield Icon */}
          <View style={[dialogStyles.iconWrap, { backgroundColor: theme.iconBackground }]}>
            <Text style={[dialogStyles.iconText, { color: theme.iconColor }]}>◎</Text>
          </View>

          {/* Title */}
          <Text style={[
            dialogStyles.title,
            { color: theme.title },
            isArabic && dialogStyles.textRTL,
          ]}>
            {title}
          </Text>

          {/* Data shared summary */}
          <View
            style={[
              dialogStyles.dataSection,
              {
                backgroundColor: theme.sectionBackground,
                borderColor: theme.sectionBorder,
              },
            ]}
          >
            <Text style={[dialogStyles.dataLabel, { color: theme.muted }, isArabic && dialogStyles.textRTL]}>
              {isArabic ? 'يُشارك مع مساعد الذكاء الاصطناعي:' : 'Shared with the AI agent:'}
            </Text>
            {sharedDataItems.map((item, index) => (
              <View style={dialogStyles.dataItem} key={`${item}-${index}`}>
                <Text style={[dialogStyles.dataBullet, { color: theme.bullet }]}>•</Text>
                <Text style={[dialogStyles.dataText, { color: theme.body }, isArabic && dialogStyles.textRTL]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>

          {/* Provider badge */}
          {showProviderBadge && (
            <View style={[dialogStyles.providerBadge, { backgroundColor: theme.badgeBackground }]}>
              <Text style={[dialogStyles.providerBadgeText, { color: theme.badgeText }]}>
                {config.providerBadgeText || (isArabic ? `تعمل بواسطة ${providerLabel}` : `Uses ${providerLabel}`)}
              </Text>
            </View>
          )}

          {/* Privacy Policy link */}
          {config.privacyPolicyUrl && (
            <Pressable onPress={handlePrivacyPolicy} style={dialogStyles.privacyLink}>
              <Text style={[dialogStyles.privacyLinkText, { color: theme.link }]}>
                {isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}
              </Text>
            </Pressable>
          )}

          {!config.privacyPolicyUrl && providerUrl && showProviderBadge && (
            <Pressable
              onPress={() => Linking.openURL(providerUrl)}
              style={dialogStyles.privacyLink}
            >
              <Text style={[dialogStyles.privacyLinkText, { color: theme.link }]}>
                {isArabic ? 'معلومات إضافية' : 'Learn more'}
              </Text>
            </Pressable>
          )}

          {/* Action buttons */}
          <View style={dialogStyles.buttonRow}>
            <Pressable
              style={[dialogStyles.declineBtn, { backgroundColor: theme.secondaryButtonBackground }]}
              onPress={onDecline}
              accessibilityLabel={isArabic ? 'رفض' : 'Decline'}
            >
              <Text style={[dialogStyles.declineBtnText, { color: theme.secondaryButtonText }]}>
                {isArabic ? 'ليس الآن' : 'Not now'}
              </Text>
            </Pressable>

            <Pressable
              style={[dialogStyles.consentBtn, { backgroundColor: theme.primaryButtonBackground }]}
              onPress={onConsent}
              accessibilityLabel={isArabic ? 'متابعة' : 'Continue'}
            >
              <Text style={[dialogStyles.consentBtnText, { color: theme.primaryButtonText }]}>
                {isArabic ? 'متابعة' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </ContentWrapper>
  );
}

// ─── Hook: useAIConsent ───────────────────────────────────────

/**
 * Manages consent state. Persistence is optional and only used when AsyncStorage
 * is installed by the host app.
 *
 * @returns [hasConsented, grantConsent, revokeConsent, isLoading]
 */
export function useAIConsent(persist: boolean = false): [
  hasConsented: boolean,
  grantConsent: () => Promise<void>,
  revokeConsent: () => Promise<void>,
  isLoading: boolean,
] {
  const [hasConsented, setHasConsented] = useState(sessionConsentGranted);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        if (persist) {
          const AS = getConsentStorage();
          const stored = await AS?.getItem(CONSENT_STORAGE_KEY);
          if (stored === 'true') {
            sessionConsentGranted = true;
            setHasConsented(true);
          }
        } else {
          setHasConsented(sessionConsentGranted);
        }
      } catch {
        setHasConsented(sessionConsentGranted);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [persist]);

  const grantConsent = useCallback(async () => {
    sessionConsentGranted = true;
    setHasConsented(true);
    if (persist) {
      try {
        await getConsentStorage()?.setItem(CONSENT_STORAGE_KEY, 'true');
      } catch {
        // Consent still applies for this session when optional local persistence fails.
      }
    }
  }, [persist]);

  const revokeConsent = useCallback(async () => {
    sessionConsentGranted = false;
    setHasConsented(false);
    if (persist) {
      try {
        await getConsentStorage()?.removeItem(CONSENT_STORAGE_KEY);
      } catch {
        // Session consent is already revoked; persistence cleanup is best-effort.
      }
    }
  }, [persist]);

  return [hasConsented, grantConsent, revokeConsent, isLoading];
}

// ─── Styles ───────────────────────────────────────────────────

const dialogStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(123, 104, 238, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 26,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dataSection: {
    width: '100%',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  dataBullet: {
    color: '#7B68EE',
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  dataText: {
    fontSize: 13,
    flex: 1,
  },
  providerBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  providerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  privacyLink: {
    marginBottom: 20,
  },
  privacyLinkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  consentBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  consentBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
