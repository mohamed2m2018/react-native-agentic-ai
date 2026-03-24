import { View, Text, Switch, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../App';

type Props = NativeStackScreenProps<HomeStackParamList, 'DishReviews'>;

const REVIEWS = [
  { id: 1, user: 'Sarah M.', rating: 5, text: 'Absolutely delicious! Best I\'ve ever had. The flavors are perfectly balanced.' },
  { id: 2, user: 'James K.', rating: 4, text: 'Great taste, generous portions. Would order again.' },
  { id: 3, user: 'Emily R.', rating: 5, text: 'Fresh ingredients, fast delivery. Highly recommended!' },
  { id: 4, user: 'Mark L.', rating: 3, text: 'Good but a bit too salty for my taste. Still enjoyable though.' },
];

export default function DishReviewsScreen({ route, navigation }: Props) {
  const { dishName } = route.params;

  const [priceAlerts, setPriceAlerts] = useState(false);
  const [reviewAlerts, setReviewAlerts] = useState(false);
  const [question, setQuestion] = useState('');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Reviews for {dishName}</Text>

      {REVIEWS.map(review => (
        <View key={review.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewUser}>{review.user}</Text>
            <Text style={styles.reviewRating}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
          </View>
          <Text style={styles.reviewText}>{review.text}</Text>
          {/* Corner case: navigation.push() — tests push() method detection */}
          <Pressable
            style={styles.reportLink}
            onPress={() => navigation.push('ReportIssue', { dishName, reviewId: review.id })}
          >
            <Text style={styles.reportLinkText}>Report</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Notifications</Text>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Price Drop Alerts</Text>
        <Switch value={priceAlerts} onValueChange={setPriceAlerts} />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Notify on New Reviews</Text>
        <Switch value={reviewAlerts} onValueChange={setReviewAlerts} />
      </View>

      <Text style={styles.sectionTitle}>Ask a Question</Text>

      <TextInput
        style={styles.input}
        placeholder="Type your question about this dish..."
        value={question}
        onChangeText={setQuestion}
        multiline
      />

      <Pressable style={styles.submitButton}>
        <Text style={styles.submitText}>Submit Question</Text>
      </Pressable>

      {/* Level 4 → Level 5: navigate to WriteReview */}
      <Pressable
        style={styles.writeReviewBtn}
        onPress={() => navigation.navigate('WriteReview', { dishName })}
      >
        <Text style={styles.writeReviewText}>✍️ Write a Review</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginTop: 20, marginBottom: 12 },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewUser: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  reviewRating: { fontSize: 14, color: '#f39c12' },
  reviewText: { fontSize: 14, color: '#6c757d', lineHeight: 20 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  settingLabel: { fontSize: 16, color: '#1a1a2e' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  reportLink: { marginTop: 8, alignSelf: 'flex-end' },
  reportLinkText: { fontSize: 13, color: '#dc3545' },
  writeReviewBtn: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  writeReviewText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
