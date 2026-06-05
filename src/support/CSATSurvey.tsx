/**
 * CSAT Survey — Customer Satisfaction component.
 *
 * Shown after a support conversation ends (or after idle timeout).
 * Supports three rating types: emoji, stars, thumbs.
 */


import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import type { CSATConfig, CSATRating } from './types';

interface CSATSurveyProps {
  config: CSATConfig;
  metadata: CSATRating['metadata'];
  onDismiss: () => void;
  theme?: {
    primaryColor?: string;
    textColor?: string;
    backgroundColor?: string;
  };
}

const EMOJI_OPTIONS = [
  { emoji: '😡', label: 'Terrible', score: 1 },
  { emoji: '😞', label: 'Bad', score: 2 },
  { emoji: '😐', label: 'Okay', score: 3 },
  { emoji: '😊', label: 'Good', score: 4 },
  { emoji: '🤩', label: 'Amazing', score: 5 },
];

const STAR_COUNT = 5;

export function CSATSurvey({
  config,
  metadata,
  onDismiss,
  theme,
}: CSATSurveyProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const primary = theme?.primaryColor ?? '#8b5cf6';
  const textColor = theme?.textColor ?? '#ffffff';
  const bgColor = theme?.backgroundColor ?? 'rgba(26, 26, 46, 0.98)';
  const ratingType = config.ratingType ?? 'emoji';
  const question = config.question ?? 'How was your experience?';

  const handleSubmit = () => {
    if (selectedScore === null) return;

    const rating: CSATRating = {
      score: selectedScore,
      feedback: feedback.trim() || undefined,
      metadata,
    };

    config.onSubmit(rating);
    setSubmitted(true);

    // Auto-dismiss after 1.5s
    setTimeout(onDismiss, 1500);
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Text style={[styles.thankYou, { color: textColor }]}>
          Thank you for your feedback! 🙏
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Question */}
      <Text style={[styles.question, { color: textColor }]}>{question}</Text>

      {/* Rating selector */}
      <View style={styles.ratingContainer}>
        {ratingType === 'emoji' && (
          <View style={styles.emojiRow}>
            {EMOJI_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.score}
                onPress={() => setSelectedScore(opt.score)}
                style={[
                  styles.emojiButton,
                  selectedScore === opt.score && {
                    backgroundColor: `${primary}30`,
                    borderColor: primary,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.emojiLabel,
                    { color: selectedScore === opt.score ? primary : '#71717a' },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {ratingType === 'stars' && (
          <View style={styles.starsRow}>
            {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map(
              (star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedScore(star)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.star,
                      {
                        color:
                          selectedScore !== null && star <= selectedScore
                            ? '#fbbf24'
                            : '#52525b',
                      },
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        {ratingType === 'thumbs' && (
          <View style={styles.thumbsRow}>
            <TouchableOpacity
              onPress={() => setSelectedScore(0)}
              style={[
                styles.thumbButton,
                selectedScore === 0 && {
                  backgroundColor: '#ef444430',
                  borderColor: '#ef4444',
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.thumbEmoji}>👎</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedScore(1)}
              style={[
                styles.thumbButton,
                selectedScore === 1 && {
                  backgroundColor: '#22c55e30',
                  borderColor: '#22c55e',
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.thumbEmoji}>👍</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Optional feedback text */}
      {selectedScore !== null && (
        <TextInput
          style={[styles.feedbackInput, { color: textColor }]}
          placeholder="Any additional feedback? (optional)"
          placeholderTextColor="#52525b"
          value={feedback}
          onChangeText={setFeedback}
          multiline
          maxLength={500}
        />
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.dismissText}>Skip</Text>
        </TouchableOpacity>
        {selectedScore !== null && (
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: primary }]}
            onPress={handleSubmit}
            activeOpacity={0.7}
          >
            <Text style={[styles.submitText, { color: textColor }]}>
              Submit
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    margin: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  thankYou: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 12,
  },
  ratingContainer: {
    marginBottom: 12,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  emojiButton: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emoji: {
    fontSize: 28,
  },
  emojiLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  star: {
    fontSize: 36,
  },
  thumbsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  thumbButton: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumbEmoji: {
    fontSize: 36,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissText: {
    color: '#71717a',
    fontSize: 14,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
