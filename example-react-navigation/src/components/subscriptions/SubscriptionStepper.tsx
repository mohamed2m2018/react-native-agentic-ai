import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (nextValue: number) => void;
};

export function SubscriptionStepper({
  label,
  value,
  min = 0,
  max = 99,
  onChange,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          style={styles.button}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          style={styles.button}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef1fb',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginTop: -1,
  },
  value: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
});
