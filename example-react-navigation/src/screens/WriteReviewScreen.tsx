import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'WriteReview'>;

export default function WriteReviewScreen({ route, navigation }: Props) {
  const { dishName } = route.params;
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recommend, setRecommend] = useState(true);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Write a Review</Text>
      <Text style={styles.subtitle}>Share your experience with {dishName}</Text>

      <Text style={styles.label}>Your Rating</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <Pressable key={star} onPress={() => setRating(star)}>
            <Text style={[styles.star, star <= rating && styles.starFilled]}>
              {star <= rating ? '★' : '☆'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Review Title</Text>
      <TextInput
        style={styles.input}
        placeholder="Summarize your experience"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Review Details</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="What did you like or dislike?"
        value={body}
        onChangeText={setBody}
        multiline
      />

      <Text style={styles.label}>Would you recommend?</Text>
      <View style={styles.recommendRow}>
        <Pressable
          style={[styles.recommendBtn, recommend && styles.recommendActive]}
          onPress={() => setRecommend(true)}
        >
          <Text style={[styles.recommendText, recommend && styles.recommendActiveText]}>👍 Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.recommendBtn, !recommend && styles.recommendActive]}
          onPress={() => setRecommend(false)}
        >
          <Text style={[styles.recommendText, !recommend && styles.recommendActiveText]}>👎 No</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.submitBtn, (!rating || !title || !body) && styles.submitDisabled]}
        onPress={() => navigation.navigate('ReviewThanks', { dishName })}
      >
        <Text style={styles.submitText}>Submit Review</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 60 },
  header: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', marginTop: 20, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 36, color: '#dee2e6' },
  starFilled: { color: '#F39C12' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1a1a2e',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  recommendRow: { flexDirection: 'row', gap: 12 },
  recommendBtn: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e9ecef', alignItems: 'center',
  },
  recommendActive: { borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.08)' },
  recommendText: { fontSize: 16, color: '#6c757d' },
  recommendActiveText: { color: '#28a745', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#28a745', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 30,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
