import { StyleSheet, TextInput, Pressable, ScrollView  } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function EditProfileScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} defaultValue="John Smith" />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} defaultValue="john.smith@example.com" keyboardType="email-address" />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} defaultValue="+1 555-0123" keyboardType="phone-pad" />

      <Text style={styles.label}>Bio</Text>
      <TextInput style={[styles.input, styles.textArea]} defaultValue="Love shopping for new tech and outdoor gear." multiline numberOfLines={3} />

      <Pressable style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#6c757d', textTransform: 'uppercase', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', borderRadius: 10, padding: 14, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#3498DB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
