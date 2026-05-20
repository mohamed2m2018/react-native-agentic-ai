import { View, Text, StyleSheet, ScrollView, Image, Pressable, Alert } from 'react-native';
import { useState } from 'react';

const MOCK_MEDIA = [
  { id: '1', type: 'image', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop', title: 'Cheesy Pizza' },
  { id: '2', type: 'video', url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=400&fit=crop', title: 'Making a Burger' },
  { id: '3', type: 'image', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=400&fit=crop', title: 'Sweet Donut' },
  { id: '4', type: 'video', url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop', title: 'Grilling Steak' },
];

export default function MediaReel() {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlayMedia = (item: any) => {
    if (item.type === 'video') {
      setPlayingId(item.id);
      Alert.alert('Playing Video', `Now playing: ${item.title}`);
    } else {
      Alert.alert('Viewing Image', `Looking at: ${item.title}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Featured Food Reels</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {MOCK_MEDIA.map(item => (
          <Pressable 
            key={item.id} 
            style={styles.mediaCard} 
            onPress={() => handlePlayMedia(item)}
            accessibilityLabel={`${item.type === 'video' ? 'Play video' : 'View image'} ${item.title}`}
            accessibilityRole="image"
          >
            <Image source={{ uri: item.url }} style={styles.mediaFrame} />
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>{item.title}</Text>
              {item.type === 'video' && (
                <View style={styles.playIconContainer}>
                  <Text style={styles.playIcon}>{playingId === item.id ? '⏸️' : '▶️'}</Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 16, paddingHorizontal: 24 },
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
  playIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 20,
    marginLeft: 4, // Visual alignment
  }
});
