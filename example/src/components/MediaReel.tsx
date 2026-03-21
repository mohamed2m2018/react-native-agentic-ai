import { View, Text, StyleSheet, ScrollView, Image, Pressable  } from 'react-native';
import { useState } from 'react';
// @ts-ignore — expo-video types resolve at build time
import { useVideoPlayer, VideoView } from 'expo-video';

const FOOD_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const MOCK_MEDIA = [
  { id: '1', type: 'image' as const, url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop', title: 'Cheesy Pizza' },
  { id: '2', type: 'video' as const, url: FOOD_VIDEO_URL, title: 'Making a Burger', poster: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=400&fit=crop' },
  { id: '3', type: 'image' as const, url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=400&fit=crop', title: 'Sweet Donut' },
  { id: '4', type: 'video' as const, url: FOOD_VIDEO_URL, title: 'Grilling Steak', poster: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop' },
];

function VideoCard({ item }: { item: typeof MOCK_MEDIA[1] }) {
  const player = useVideoPlayer(item.url, (p: any) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const [isPlaying, setIsPlaying] = useState(true);

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Pressable style={styles.mediaCard} onPress={togglePlay}>
      <VideoView
        style={styles.mediaFrame}
        player={player}
        nativeControls={false}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>{item.title}</Text>
        {!isPlaying && (
          <View style={styles.playIconContainer}>
            <Text style={styles.playIcon}>▶️</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function MediaReel() {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {MOCK_MEDIA.map(item =>
          item.type === 'video' ? (
            <VideoCard key={item.id} item={item} />
          ) : (
            <Pressable
              key={item.id}
              style={styles.mediaCard}
              onPress={() => {}}
            >
              <Image source={{ uri: item.url }} style={styles.mediaFrame} />
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>{item.title}</Text>
              </View>
            </Pressable>
          )
        )}
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
    marginLeft: 4,
  }
});
