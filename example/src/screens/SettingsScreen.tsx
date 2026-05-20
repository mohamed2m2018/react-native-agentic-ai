import { useState } from 'react';
import { View, Text, TextInput, Switch, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';

export default function SettingsScreen() {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    // Profile
    fullName: 'Demo User',
    email: 'demo@test.com',
    bio: 'I love trying new food.',
    
    // Preferences
    dietaryPreference: 'None',
    currency: 'USD',
    
    // Notifications
    emailAlerts: true,
    pushNotifications: true,
    smsPromos: false,
    orderUpdates: true,
    
    // Security
    twoFactorAuth: false,
  });

  const updateForm = (key: keyof typeof form, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate network delay
    setTimeout(() => {
      setIsSaving(false);
      Alert.alert('Success', 'Your settings have been saved.', [{ text: 'OK' }]);
    }, 1200);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Account Settings</Text>

      {/* --- Profile Section --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(val) => updateForm('fullName', val)}
          accessibilityLabel="Full Name Input"
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={(val) => updateForm('email', val)}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityLabel="Email Input"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.bio}
          onChangeText={(val) => updateForm('bio', val)}
          multiline
          numberOfLines={3}
          accessibilityLabel="Bio Input"
        />
      </View>

      {/* --- Preferences Section --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <Text style={styles.label}>Dietary Preference</Text>
        <View style={styles.radioGroup}>
          {['None', 'Vegetarian', 'Vegan', 'Keto'].map(diet => (
            <Pressable
              key={diet}
              style={[styles.radioItem, form.dietaryPreference === diet && styles.radioItemActive]}
              onPress={() => updateForm('dietaryPreference', diet)}
              accessibilityLabel={`Select ${diet} dietary preference`}
              accessibilityState={{ selected: form.dietaryPreference === diet }}
            >
              <Text style={[styles.radioText, form.dietaryPreference === diet && styles.radioTextActive]}>
                {diet}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Currency</Text>
        <View style={styles.radioGroup}>
          {['USD', 'EUR', 'GBP'].map(curr => (
            <Pressable
              key={curr}
              style={[styles.radioItem, form.currency === curr && styles.radioItemActive]}
              onPress={() => updateForm('currency', curr)}
              accessibilityLabel={`Select currency ${curr}`}
              accessibilityState={{ selected: form.currency === curr }}
            >
              <Text style={[styles.radioText, form.currency === curr && styles.radioTextActive]}>
                {curr}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* --- Notifications Section --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Email Alerts</Text>
          <Switch
            value={form.emailAlerts}
            onValueChange={(val) => updateForm('emailAlerts', val)}
            accessibilityLabel="Toggle Email Alerts"
            trackColor={{ true: '#1a1a2e' }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Push Notifications</Text>
          <Switch
            value={form.pushNotifications}
            onValueChange={(val) => updateForm('pushNotifications', val)}
            accessibilityLabel="Toggle Push Notifications"
            trackColor={{ true: '#1a1a2e' }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Order Updates</Text>
          <Switch
            value={form.orderUpdates}
            onValueChange={(val) => updateForm('orderUpdates', val)}
            accessibilityLabel="Toggle Order Updates"
            trackColor={{ true: '#1a1a2e' }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>SMS Promotional Offers</Text>
          <Switch
            value={form.smsPromos}
            onValueChange={(val) => updateForm('smsPromos', val)}
            accessibilityLabel="Toggle SMS Promos"
            trackColor={{ true: '#1a1a2e' }}
          />
        </View>
      </View>

      {/* --- Security Section --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Two-Factor Authentication</Text>
          <Switch
            value={form.twoFactorAuth}
            onValueChange={(val) => updateForm('twoFactorAuth', val)}
            accessibilityLabel="Toggle Two-Factor Authentication"
            trackColor={{ true: '#1a1a2e' }}
          />
        </View>
      </View>

      {/* --- Save Button --- */}
      <Pressable
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
        accessibilityLabel="Save Changes"
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 24, paddingBottom: 60 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 24 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#6c757d', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1a1a2e',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  radioItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#fff',
  },
  radioItemActive: {
    backgroundColor: '#1a1a2e',
    borderColor: '#1a1a2e',
  },
  radioText: { fontSize: 14, color: '#495057', fontWeight: '500' },
  radioTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  switchLabel: { fontSize: 16, color: '#1a1a2e', fontWeight: '500' },
  saveButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    marginTop: 10,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
