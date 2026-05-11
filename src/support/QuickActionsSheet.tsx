import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import type { QuickActionsConfig, HelpTopic } from './types';
import { CloseIcon } from '../components/Icons';
import { HelpArticleView } from './HelpArticleView';
import { rankTopics, searchArticles } from './quickActionsMatcher';

interface QuickActionsSheetProps {
  visible: boolean;
  config: QuickActionsConfig;
  currentScreen?: string;
  onClose: () => void;
  onChatWithAI: (context?: { topicId?: string; articleQuestion?: string }) => void;
}

export function QuickActionsSheet({
  visible,
  config,
  currentScreen = '',
  onClose,
  onChatWithAI,
}: QuickActionsSheetProps) {
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const showSearch = config.showSearchBar !== false;
  const otherLabel = config.otherLabel ?? 'Chat with AI';

  const rankedTopics = useMemo(
    () => rankTopics(config.topics, currentScreen),
    [config.topics, currentScreen]
  );

  const searchResults = useMemo(
    () => (searchQuery.length >= 2 ? searchArticles(config.topics, searchQuery) : []),
    [config.topics, searchQuery]
  );

  const isSearching = searchQuery.length >= 2;

  const handleClose = () => {
    setSelectedTopic(null);
    setSearchQuery('');
    onClose();
  };

  const handleChatWithAI = (context?: { topicId?: string; articleQuestion?: string }) => {
    setSelectedTopic(null);
    setSearchQuery('');
    onChatWithAI(context);
  };

  if (selectedTopic) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <HelpArticleView
          topic={selectedTopic}
          onBack={() => setSelectedTopic(null)}
          onChatWithAI={handleChatWithAI}
          otherLabel={otherLabel}
          onArticleHelpful={config.onArticleHelpful}
          onArticleNotHelpful={config.onArticleNotHelpful}
        />
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={s.container}>
        {/* Drag grip */}
        <View style={s.dragHandle}>
          <View style={s.dragGrip} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} style={s.headerBtn} hitSlop={12}>
            <CloseIcon size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Text style={s.headerTitle}>How can we help?</Text>
          <View style={s.headerBtn} />
        </View>

        {/* Search bar */}
        {showSearch && (
          <View style={s.searchContainer}>
            <TextInput
              style={s.searchInput}
              placeholder="Search for help..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        )}

        <ScrollView
          style={s.content}
          contentContainerStyle={s.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isSearching ? (
            <>
              {/* Search results */}
              {searchResults.length > 0 ? (
                searchResults.map(({ topic, article }, i) => (
                  <Pressable
                    key={`${topic.id}-${i}`}
                    style={s.searchResultCard}
                    onPress={() => setSelectedTopic(topic)}
                  >
                    <Text style={s.searchResultTopic}>
                      {topic.icon} {topic.label}
                    </Text>
                    <Text style={s.searchResultQuestion}>
                      {article.question}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <View style={s.emptySearch}>
                  <Text style={s.emptySearchText}>No results found</Text>
                  <Pressable
                    onPress={() => handleChatWithAI()}
                    style={s.emptySearchBtn}
                  >
                    <Text style={s.emptySearchBtnText}>{otherLabel}</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Suggested label */}
              {rankedTopics.some((t) => t.isContextual) && (
                <Text style={s.sectionLabel}>Suggested for you</Text>
              )}

              {/* Topic grid */}
              <View style={s.topicGrid}>
                {rankedTopics.map((topic, i) => {
                  const showDivider =
                    topic.isContextual &&
                    rankedTopics[i + 1] &&
                    !rankedTopics[i + 1]!.isContextual;

                  return (
                    <View key={topic.id}>
                      <Pressable
                        style={[
                          s.topicCard,
                          topic.isContextual && s.topicCardContextual,
                        ]}
                        onPress={() => setSelectedTopic(topic)}
                      >
                        {topic.icon && (
                          <Text style={s.topicIcon}>{topic.icon}</Text>
                        )}
                        <Text style={s.topicLabel}>{topic.label}</Text>
                        <Text style={s.topicCount}>
                          {topic.articles.length}{' '}
                          {topic.articles.length === 1 ? 'article' : 'articles'}
                        </Text>
                      </Pressable>

                      {showDivider && (
                        <View style={s.divider}>
                          <View style={s.dividerLine} />
                          <Text style={s.dividerText}>All topics</Text>
                          <View style={s.dividerLine} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Chat with AI fallback */}
          {!isSearching && (
            <Pressable
              onPress={() => handleChatWithAI()}
              style={s.chatFallback}
            >
              <Text style={s.chatFallbackText}>
                Can't find what you need?
              </Text>
              <View style={s.chatFallbackBtn}>
                <Text style={s.chatFallbackBtnText}>{otherLabel}</Text>
              </View>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },

  // Drag handle
  dragHandle: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 6,
  },
  dragGrip: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 15,
  },

  // Content
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Section label
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 4,
  },

  // Topic grid
  topicGrid: {
    gap: 10,
  },
  topicCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  topicCardContextual: {
    borderColor: 'rgba(123,104,238,0.3)',
    backgroundColor: 'rgba(123,104,238,0.08)',
  },
  topicIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  topicLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  topicCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Search results
  searchResultCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchResultTopic: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchResultQuestion: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Empty search
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySearchText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    marginBottom: 16,
  },
  emptySearchBtn: {
    backgroundColor: '#7B68EE',
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  emptySearchBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Chat fallback
  chatFallback: {
    alignItems: 'center',
    marginTop: 28,
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
