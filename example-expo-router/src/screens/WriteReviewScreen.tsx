import { StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useState } from 'react';

export function WriteReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recommend, setRecommend] = useState(true);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>Write a Review</Text>
        <Text style={styles.subtitle}>Share your experience with this product</Text>

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
          placeholder="What did you like or dislike? How do you use this product?"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={5}
        />

        <Text style={styles.label}>Would you recommend this product?</Text>
        <View style={styles.recommendRow}>
          <Pressable
            style={[styles.recommendBtn, recommend && styles.recommendBtnActive]}
            onPress={() => setRecommend(true)}
          >
            <Text style={[styles.recommendText, recommend && styles.recommendTextActive]}>👍 Yes</Text>
          </Pressable>
          <Pressable
            style={[styles.recommendBtn, !recommend && styles.recommendBtnActive]}
            onPress={() => setRecommend(false)}
          >
            <Text style={[styles.recommendText, !recommend && styles.recommendTextActive]}>👎 No</Text>
          </Pressable>
        </View>

        <Link href={`/review-thanks/${id}`} asChild>
          <Pressable style={[styles.submitBtn, (!rating || !title || !body) && styles.submitDisabled]}>
            <Text style={styles.submitText}>Submit Review</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

export default WriteReviewScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 36, color: '#dee2e6' },
  starFilled: { color: '#F39C12' },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    backgroundColor: 'rgba(150,150,150,0.04)',
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  recommendRow: { flexDirection: 'row', gap: 12 },
  recommendBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    alignItems: 'center',
  },
  recommendBtnActive: { borderColor: '#27AE60', backgroundColor: 'rgba(39,174,96,0.08)' },
  recommendText: { fontSize: 16, color: '#6c757d' },
  recommendTextActive: { color: '#27AE60', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#27AE60',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
