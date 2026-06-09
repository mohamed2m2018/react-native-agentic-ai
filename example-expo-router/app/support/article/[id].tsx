import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AIZone } from '@mobileai/react-native';

import { useFoodDelivery } from '@/app/lib/delivery-demo';

export default function SupportArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { supportArticles } = useFoodDelivery();
  const article = supportArticles.find((item) => item.id === id);

  if (!article) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centered}>
        <Text style={styles.title}>Article not found</Text>
        <Link href="/help" asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>Open Help Center</Text>
          </Pressable>
        </Link>
      </ScrollView>
    );
  }

  return (
    <AIZone id="support-article">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.summary}>{article.summary}</Text>
        <Text style={styles.body}>{article.content}</Text>

        <View style={styles.tags}>
          {article.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              #{tag}
            </Text>
          ))}
        </View>

        <Link href={{ pathname: '/support', params: { issueType: 'wrong-item' } }} asChild>
          <Pressable style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Ask support about this</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </AIZone>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 12 },
  centered: { padding: 24, alignItems: 'center', gap: 12 },
  title: { fontSize: 30, fontWeight: '800' },
  summary: { color: '#334155', fontSize: 16, fontWeight: '600' },
  body: { color: '#475569', lineHeight: 23 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  primaryBtn: { marginTop: 16, backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 },
  secondaryText: { fontWeight: '700' },
});
