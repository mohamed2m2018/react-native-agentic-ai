import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import type { HelpTopic, HelpArticle } from './types';

interface HelpArticleViewProps {
  topic: HelpTopic;
  onBack: () => void;
  onChatWithAI: (context: { topicId: string; articleQuestion?: string }) => void;
  otherLabel?: string;
  onArticleHelpful?: (topicId: string, article: HelpArticle) => void;
  onArticleNotHelpful?: (topicId: string, article: HelpArticle) => void;
}

export function HelpArticleView({
  topic,
  onBack,
  onChatWithAI,
  otherLabel = 'Chat with AI',
  onArticleHelpful,
  onArticleNotHelpful,
}: HelpArticleViewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'yes' | 'no'>>({});

  const toggleArticle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleFeedback = (index: number, helpful: boolean, article: HelpArticle) => {
    setFeedbackGiven((prev) => ({ ...prev, [index]: helpful ? 'yes' : 'no' }));
    if (helpful) {
      onArticleHelpful?.(topic.id, article);
    } else {
      onArticleNotHelpful?.(topic.id, article);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn} hitSlop={12}>
          <Text style={s.backArrow}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          {topic.icon && <Text style={s.headerIcon}>{topic.icon}</Text>}
          <Text style={s.headerTitle}>{topic.label}</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {/* Articles accordion */}
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {topic.articles.map((article, i) => {
          const isExpanded = expandedIndex === i;
          const feedback = feedbackGiven[i];

          return (
            <View key={i} style={s.articleCard}>
              <Pressable
                onPress={() => toggleArticle(i)}
                style={s.questionRow}
              >
                <Text style={s.questionText}>{article.question}</Text>
                <Text style={[s.chevron, isExpanded && s.chevronOpen]}>›</Text>
              </Pressable>

              {isExpanded && (
                <View style={s.answerContainer}>
                  <Text style={s.answerText}>{article.answer}</Text>

                  {/* Feedback row */}
                  <View style={s.feedbackRow}>
                    <Text style={s.feedbackLabel}>Did this help?</Text>
                    {feedback ? (
                      <Text style={s.feedbackThanks}>
                        {feedback === 'yes' ? 'Thanks! 👍' : 'Sorry to hear that'}
                      </Text>
                    ) : (
                      <View style={s.feedbackButtons}>
                        <Pressable
                          onPress={() => handleFeedback(i, true, article)}
                          style={s.feedbackBtn}
                          hitSlop={8}
                        >
                          <Text style={s.feedbackBtnText}>👍 Yes</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleFeedback(i, false, article)}
                          style={s.feedbackBtn}
                          hitSlop={8}
                        >
                          <Text style={s.feedbackBtnText}>👎 No</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Chat with AI fallback */}
        <Pressable
          onPress={() => onChatWithAI({ topicId: topic.id })}
          style={s.chatFallback}
        >
          <Text style={s.chatFallbackText}>
            Can't find what you need?
          </Text>
          <View style={s.chatFallbackBtn}>
            <Text style={s.chatFallbackBtnText}>{otherLabel}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 58 : 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Article card
  articleCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  questionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  chevron: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 22,
    fontWeight: '300',
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },

  // Answer
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  answerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
    paddingTop: 12,
  },

  // Feedback
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  feedbackLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  feedbackBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  feedbackBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  feedbackThanks: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Chat fallback
  chatFallback: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 20,
  },
  chatFallbackText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginBottom: 12,
  },
  chatFallbackBtn: {
    backgroundColor: '#7B68EE',
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: '#7B68EE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  chatFallbackBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
