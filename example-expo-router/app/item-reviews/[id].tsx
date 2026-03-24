import { StyleSheet, ScrollView, Pressable, TextInput, Switch } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { useState } from 'react';

const REVIEWS: Record<string, { user: string; rating: number; comment: string; date: string }[]> = {
  p1: [
    { user: 'TechFan92', rating: 5, comment: 'Best phone I ever owned. The AI features are incredible.', date: '2024-12-15' },
    { user: 'PhotoPro', rating: 4, comment: 'Camera is amazing but battery could be better.', date: '2024-12-10' },
    { user: 'DailyUser', rating: 5, comment: 'S Pen is a game changer for productivity.', date: '2024-11-28' },
  ],
  p2: [
    { user: 'AppleLover', rating: 5, comment: 'Seamless ecosystem integration. Camera is unreal.', date: '2024-12-20' },
    { user: 'Switcher2024', rating: 5, comment: 'Switched from Android and never looking back.', date: '2024-12-05' },
  ],
  a1: [
    { user: 'MusicAddict', rating: 5, comment: 'Best noise cancellation in earbuds, period.', date: '2024-12-18' },
    { user: 'CommutePro', rating: 4, comment: 'Great for calls and music. Wish battery lasted longer.', date: '2024-11-30' },
  ],
};

const DEFAULT_REVIEWS = [
  { user: 'Shopper123', rating: 4, comment: 'Great product, fast shipping!', date: '2024-12-01' },
  { user: 'ValueHunter', rating: 5, comment: 'Excellent quality for the price.', date: '2024-11-15' },
];

// ─── Data ONLY available on this page (level 5) ──────────────
const EXPERT_TIPS: Record<string, string> = {
  p1: 'Pro tip: Enable "Motion Photo" in camera settings to capture 3-second clips with every photo. Most users miss this feature.',
  p2: 'Pro tip: Use the Action Button to instantly open the camera — set it in Settings > Action Button. Saves 2 seconds every shot.',
  a1: 'Pro tip: Run an Ear Tip Fit Test (Settings > AirPods) every 3 months — ear canals change shape, and refitting improves noise cancellation by up to 30%.',
  a2: 'Pro tip: Enable DSEE Extreme in the Sony Headphones app for AI-upscaled audio quality. Makes compressed Spotify tracks sound like lossless.',
  w1: 'Pro tip: Enable the hidden "Depth Gauge" in Water Lock mode — it tracks your diving depth up to 40 meters. Perfect for snorkeling.',
};

const ANSWERED_QUESTIONS: Record<string, { q: string; a: string; answeredBy: string }[]> = {
  p1: [
    { q: 'Does the S Pen need charging?', a: 'No, the S Pen never needs charging. It uses electromagnetic resonance powered by the screen.', answeredBy: 'Samsung Official' },
    { q: 'Can it survive a drop from 6 feet?', a: 'With the Armor Aluminum frame, yes. I dropped mine on concrete twice — not a scratch.', answeredBy: 'Verified Buyer' },
  ],
  a1: [
    { q: 'How long does the battery actually last?', a: 'Real-world: about 5.5 hours with ANC on. The case gives 4 full recharges so 24+ hours total.', answeredBy: 'Verified Buyer' },
    { q: 'Do they work with Android?', a: 'Yes, basic playback and ANC work. But you lose Spatial Audio and auto-switching between Apple devices.', answeredBy: 'Apple Support' },
  ],
  a2: [
    { q: 'Can I use them wired?', a: 'Yes — included 3.5mm cable gives you full hi-res audio even when battery is dead.', answeredBy: 'Sony Official' },
  ],
};

export default function ItemReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reviews = REVIEWS[id] || DEFAULT_REVIEWS;
  const expertTip = EXPERT_TIPS[id];
  const answeredQs = ANSWERED_QUESTIONS[id] || [];
  const [question, setQuestion] = useState('');
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [reviewNotifs, setReviewNotifs] = useState(false);

  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <ScrollView style={styles.container}>
      {expertTip && (
        <View style={styles.tipCard}>
          <Text style={styles.tipLabel}>💡 Expert Tip</Text>
          <Text style={styles.tipText}>{expertTip}</Text>
        </View>
      )}

      <View style={styles.summaryCard}>
        <Text style={styles.avgRating}>★ {avgRating}</Text>
        <Text style={styles.reviewCount}>{reviews.length} reviews</Text>
      </View>

      <Text style={styles.sectionTitle}>Customer Reviews</Text>

      {reviews.map((review, i) => (
        <View key={i} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewUser}>{review.user}</Text>
            <Text style={styles.reviewRating}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
          </View>
          <Text style={styles.reviewComment}>{review.comment}</Text>
          <Text style={styles.reviewDate}>{review.date}</Text>
        </View>
      ))}

      {answeredQs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Answered Questions</Text>
          {answeredQs.map((qa, i) => (
            <View key={i} style={styles.qaCard}>
              <Text style={styles.qaQuestion}>Q: {qa.q}</Text>
              <Text style={styles.qaAnswer}>A: {qa.a}</Text>
              <Text style={styles.qaBy}>— {qa.answeredBy}</Text>
            </View>
          ))}
        </>
      )}

      <Link href={`/write-review/${id}`} asChild>
        <Pressable style={styles.writeReviewBtn}>
          <Text style={styles.writeReviewText}>✍️ Write a Review</Text>
        </Pressable>
      </Link>

      <Text style={styles.sectionTitle}>Notification Settings</Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Price Drop Alerts</Text>
        <Switch value={priceAlerts} onValueChange={setPriceAlerts} />
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Notify on New Reviews</Text>
        <Switch value={reviewNotifs} onValueChange={setReviewNotifs} />
      </View>

      <Text style={styles.sectionTitle}>Ask a Question</Text>
      <View style={styles.questionBox}>
        <TextInput
          style={styles.questionInput}
          placeholder="Type your question about this product..."
          placeholderTextColor="#999"
          value={question}
          onChangeText={setQuestion}
          multiline
        />
        <Pressable style={styles.submitButton}>
          <Text style={styles.submitText}>Submit Question</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  summaryCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(150,150,150,0.08)',
    alignItems: 'center',
    marginBottom: 24,
  },
  avgRating: { fontSize: 36, fontWeight: 'bold', color: '#F39C12' },
  reviewCount: { fontSize: 14, color: '#6c757d', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '600', paddingHorizontal: 20, marginBottom: 12 },
  reviewCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    marginBottom: 10,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewUser: { fontSize: 15, fontWeight: '600' },
  reviewRating: { fontSize: 14, color: '#F39C12' },
  reviewComment: { fontSize: 14, color: '#6c757d', lineHeight: 20 },
  reviewDate: { fontSize: 12, color: '#aaa', marginTop: 8 },
  questionBox: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    marginBottom: 40,
  },
  questionInput: {
    fontSize: 15,
    minHeight: 60,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#3498DB',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tipCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
    marginBottom: 20,
  },
  tipLabel: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  tipText: { fontSize: 14, lineHeight: 20, color: '#6c757d' },
  qaCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 152, 219, 0.08)',
    marginBottom: 10,
  },
  qaQuestion: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  qaAnswer: { fontSize: 14, color: '#6c757d', lineHeight: 20, marginBottom: 6 },
  qaBy: { fontSize: 12, color: '#3498DB', fontStyle: 'italic' },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.08)',
    marginBottom: 10,
  },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  writeReviewBtn: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#27AE60',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  writeReviewText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
