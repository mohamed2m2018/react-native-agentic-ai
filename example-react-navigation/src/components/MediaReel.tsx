import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

const MOCK_MEDIA = [
  { id: '1', type: 'image' as const, url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop', title: 'Cheesy Pizza' },
  { id: '2', type: 'image' as const, url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=400&fit=crop', title: 'Making a Burger' },
  { id: '3', type: 'image' as const, url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=400&fit=crop', title: 'Sweet Donut' },
  { id: '4', type: 'image' as const, url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop', title: 'Grilling Steak' },
];

export default function MediaReel() {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {MOCK_MEDIA.map(item => (
          <Pressable
            key={item.id}
            style={styles.mediaCard}
            onPress={() => {}}
          >
            <Image source={{ uri: item.url }} style={styles.mediaFrame} />
            <View style={styles.overlay}></View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 20 },
  scroll: { paddingHorizontal: 24, gap: 16 },
  mediaCard: {
    width: 160,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e9ecef',
  },
  mediaFrame: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  overlayText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
