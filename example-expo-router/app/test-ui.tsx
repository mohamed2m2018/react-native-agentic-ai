import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Image, ImageBackground, Switch, ActivityIndicator,
  Pressable, TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback,
  ScrollView, FlatList, SectionList, VirtualizedList, KeyboardAvoidingView,
  Modal, RefreshControl, StatusBar, Platform, StyleSheet,
  TouchableNativeFeedback, InputAccessoryView, SafeAreaView, Animated
} from 'react-native';
import { AIZone } from '@mobileai/react-native';

// Lean Core / Community
import Checkbox from 'expo-checkbox';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';

// React Native Paper
import {
  Avatar, Badge, Banner, Card, Chip, DataTable, Portal, Divider,
  FAB, IconButton, List, Menu, ProgressBar, RadioButton, Searchbar,
  SegmentedButtons, Snackbar, Surface, ToggleButton
} from 'react-native-paper';

const DUMMY_DATA = Array.from({ length: 5 }).map((_, i) => ({ id: `${i}`, title: `Item ${i}` }));
const SECTION_DATA = [{ title: 'Section 1', data: ['A', 'B'] }, { title: 'Section 2', data: ['C', 'D'] }];

export default function ExhaustiveTestScreen() {
  const [text, setText] = useState('');
  const [toggle, setToggle] = useState(false);
  const [checkboxState, setCheckboxState] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [radioVal, setRadioVal] = useState('first');
  const [modalVisible, setModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [segButton, setSegButton] = useState('walk');
  const [verificationCode, setVerificationCode] = useState('');
  
  // Feedback State
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  
  // Animation for premium touch
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const triggerFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setSnackbarVisible(true);
  };

  const simulateLoading = () => {
    setIsLoading(true);
    triggerFeedback('Processing request...');
    setTimeout(() => {
      setIsLoading(false);
      triggerFeedback('Action completed successfully!');
    }, 1500);
  };

  const animatePressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const animatePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    triggerFeedback('Refreshing data...');
    setTimeout(() => {
      setRefreshing(false);
      triggerFeedback('Data up to date');
    }, 2000);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        >
          <StatusBar barStyle="dark-content" />
          
          <View style={styles.headerContainer}>
            <Text style={styles.title}>UI Components</Text>
            <Text style={styles.subtitle}>Exhaustive testing ground for AI traversal</Text>
          </View>

          {/* 1. CORE REACT NATIVE COMPONENTS */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}><Text style={styles.cardTitle}>1. Core Inputs & Controls</Text></View>
            <View style={styles.cardBody}>
              
              <Text style={styles.label}>Standard Input</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Type something..." 
                placeholderTextColor="#94A3B8"
                value={text} 
                onChangeText={setText}
                onEndEditing={() => triggerFeedback(`Saved: ${text}`)}
              />

              <Text style={styles.label}>Multiline Feedback</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                placeholder="Share your thoughts..." 
                placeholderTextColor="#94A3B8"
                multiline 
                numberOfLines={3} 
              />

              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.label}>Push Notifications</Text>
                  <Text style={styles.helperText}>Enable alerts for events</Text>
                </View>
                <Switch 
                  value={toggle} 
                  onValueChange={(val) => {
                    setToggle(val);
                    triggerFeedback(val ? 'Notifications Enabled' : 'Notifications Disabled');
                  }} 
                  trackColor={{ false: '#CBD5E1', true: '#6366F1' }}
                  thumbColor="#fff"
                />
              </View>

              <Divider style={styles.divider} />

              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity 
                  style={styles.primaryButton} 
                  activeOpacity={0.8}
                  onPressIn={animatePressIn}
                  onPressOut={animatePressOut}
                  onPress={simulateLoading}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Simulate Secure Action</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

            </View>
          </Surface>

          {/* 2. TOUCHABLES & FEEDBACK */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}><Text style={styles.cardTitle}>2. Touch Surfaces</Text></View>
            <View style={styles.cardBody}>
              
              <Pressable 
                style={({ pressed }) => [styles.touchableBase, pressed && styles.touchablePressed, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                onPress={() => triggerFeedback('Pressable triggered')}
              >
                <Text style={[styles.touchableText, { color: '#1D4ED8' }]}>Modern Pressable (Recommended)</Text>
              </Pressable>

              <TouchableOpacity 
                style={[styles.touchableBase, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]} 
                activeOpacity={0.6}
                onPress={() => triggerFeedback('TouchableOpacity triggered')}
              >
                <Text style={[styles.touchableText, { color: '#15803D' }]}>Legacy TouchableOpacity</Text>
              </TouchableOpacity>

              <TouchableHighlight 
                style={[styles.touchableBase, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]} 
                underlayColor="#FFEDD5"
                onPress={() => triggerFeedback('TouchableHighlight triggered')}
              >
                <Text style={[styles.touchableText, { color: '#C2410C' }]}>Legacy TouchableHighlight</Text>
              </TouchableHighlight>

            </View>
          </Surface>

          {/* 3. LEAN CORE & COMMUNITY WIDGETS */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}><Text style={styles.cardTitle}>3. Advanced Modules</Text></View>
            <View style={styles.cardBody}>
              
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Accept Terms & Conditions</Text>
                <Checkbox 
                  value={checkboxState} 
                  onValueChange={(val) => {
                    setCheckboxState(val);
                    triggerFeedback(val ? 'Terms Accepted' : 'Terms Declined');
                  }} 
                  color={checkboxState ? '#6366F1' : undefined} 
                />
              </View>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => bottomSheetRef.current?.present()}>
                <Text style={styles.secondaryButtonText}>Open Configuration Drawer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { marginTop: 12, backgroundColor: '#FFF7ED' }]}
                onPress={() => setModalVisible(true)}
              >
                <Text style={[styles.secondaryButtonText, { color: '#C2410C' }]}>Open Native Modal</Text>
              </TouchableOpacity>

              <BottomSheetModal ref={bottomSheetRef} snapPoints={['60%']} backgroundStyle={{ borderRadius: 24 }}>
                <BottomSheetScrollView contentContainerStyle={{ padding: 24 }}>
                  <Text style={[styles.title, { marginBottom: 8 }]}>Settings Details</Text>
                  <Text style={styles.helperText}>Configure your environment natively.</Text>
                  <Text style={[styles.label, { marginTop: 24 }]}>Verification Code</Text>
                  <BottomSheetTextInput 
                    style={styles.input} 
                    placeholder="Enter code..." 
                    placeholderTextColor="#94A3B8"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                  />
                  <TouchableOpacity style={styles.primaryButton} onPress={() => {
                    bottomSheetRef.current?.dismiss();
                    triggerFeedback('Settings Saved');
                  }}>
                    <Text style={styles.primaryButtonText}>Save & Close</Text>
                  </TouchableOpacity>
                </BottomSheetScrollView>
              </BottomSheetModal>

              <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
              >
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>Native Modal Test</Text>
                    <Text style={styles.modalBody}>
                      This is a React Native Modal rendered above the current screen. Use it to test
                      whether the AI overlay stays accessible and touch behavior still feels right.
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Type inside modal..."
                      placeholderTextColor="#94A3B8"
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.secondaryButton, styles.modalActionButton]}
                        onPress={() => setModalVisible(false)}
                      >
                        <Text style={styles.secondaryButtonText}>Close Modal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryButton, styles.modalActionButton]}
                        onPress={() => {
                          setModalVisible(false);
                          triggerFeedback('Native modal confirmed');
                        }}
                      >
                        <Text style={styles.primaryButtonText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              <View style={styles.mediaContainer}>
                <ExpoImage
                  source="https://picsum.photos/seed/696/600/400"
                  contentFit="cover"
                  transition={1000}
                  style={styles.mediaImage}
                />
                <BlurView intensity={30} style={styles.glassmorphicOverlay}>
                  <Text style={styles.glassText}>Glassmorphic Overlay</Text>
                </BlurView>
              </View>

            </View>
          </Surface>

          {/* 4. PAPER ENTERPRISE COMPONENTS */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}><Text style={styles.cardTitle}>4. Complex Form Assembly</Text></View>
            <View style={styles.cardBody}>
              
              <View style={[styles.rowBetween, { marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar.Image size={48} source={{ uri: 'https://i.pravatar.cc/150?img=68' }} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: '#1E293B' }}>Alex Designer</Text>
                    <Text style={styles.helperText}>Premium Member</Text>
                  </View>
                </View>
                <IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />
              </View>

              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={{ x: 350, y: 0 }} // Simplified anchor for demo
              >
                <Menu.Item onPress={() => { setMenuVisible(false); triggerFeedback('Editing profile'); }} title="Edit Profile" />
                <Divider />
                <Menu.Item onPress={() => { setMenuVisible(false); triggerFeedback('Logged out'); }} title="Logout" />
              </Menu>

              <Searchbar 
                placeholder="Search components..." 
                onChangeText={setSearchQuery} 
                value={searchQuery} 
                style={styles.searchBar}
                inputStyle={{ minHeight: 0 }} // Fixes padding issues in paper searchbar
                elevation={0}
              />

              <SegmentedButtons
                value={segButton}
                onValueChange={(val) => {
                  setSegButton(val);
                  triggerFeedback(`View changed to ${val}`);
                }}
                buttons={[ 
                  { value: 'walk', label: 'Walk', icon: 'walk' }, 
                  { value: 'transit', label: 'Transit', icon: 'train' }, 
                  { value: 'drive', label: 'Drive', icon: 'car' }
                ]}
                style={{ marginVertical: 16 }}
              />

              <List.Section title="Advanced Options" titleStyle={{ fontWeight: '700', color: '#1E293B', paddingLeft: 0 }}>
                <List.Accordion title="Network Settings" left={props => <List.Icon {...props} icon="wifi" color="#6366F1" />} style={styles.accordion}>
                  <List.Item title="Wi-Fi" description="Connected to HOME_5G" onPress={() => triggerFeedback('Opening WiFi')} />
                  <List.Item title="Cellular" description="5G Auto" onPress={() => triggerFeedback('Opening Cellular')} />
                </List.Accordion>
                <List.Accordion title="Privacy & Security" left={props => <List.Icon {...props} icon="shield-lock" color="#10B981" />} style={styles.accordion}>
                  <List.Item title="Location Services" onPress={() => {}} />
                </List.Accordion>
              </List.Section>

            </View>
          </Surface>

          {/* 5. DATA GRIDS */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.cardHeader}><Text style={styles.cardTitle}>5. Data Grids</Text></View>
            <View style={{ padding: 0 }}>
              <DataTable>
                <DataTable.Header style={{ backgroundColor: '#F8FAFC' }}>
                  <DataTable.Title>Name</DataTable.Title>
                  <DataTable.Title numeric>Memory</DataTable.Title>
                  <DataTable.Title numeric>Status</DataTable.Title>
                </DataTable.Header>
                <DataTable.Row onPress={() => triggerFeedback('Selected React Node')}>
                  <DataTable.Cell>React Node</DataTable.Cell>
                  <DataTable.Cell numeric>14 MB</DataTable.Cell>
                  <DataTable.Cell numeric><Badge style={{ backgroundColor: '#10B981' }}>OK</Badge></DataTable.Cell>
                </DataTable.Row>
                <DataTable.Row onPress={() => triggerFeedback('Selected Image Cache')}>
                  <DataTable.Cell>Image Cache</DataTable.Cell>
                  <DataTable.Cell numeric>45 MB</DataTable.Cell>
                  <DataTable.Cell numeric><Badge style={{ backgroundColor: '#F59E0B' }}>WARN</Badge></DataTable.Cell>
                </DataTable.Row>
              </DataTable>
            </View>
          </Surface>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => triggerFeedback('Created new entry!')}
        color="#fff"
      />

      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: 'Dismiss',
            onPress: () => setSnackbarVisible(false),
            color: '#A5B4FC'
          }}
          style={{ backgroundColor: '#1E293B', borderRadius: 12 }}
        >
          {feedbackMsg}
        </Snackbar>
      </Portal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1F5F9' },
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 8 },
  
  headerContainer: { marginBottom: 24, paddingHorizontal: 4 },
  title: { fontSize: 32, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 4, fontWeight: '500' },
  
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#334155', letterSpacing: 0.2 },
  cardBody: { padding: 20 },
  
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  helperText: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 16,
  },
  textArea: { minHeight: 100, paddingTop: 16, textAlignVertical: 'top' },
  
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { marginVertical: 24, backgroundColor: '#E2E8F0' },
  
  primaryButton: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  secondaryButtonText: { color: '#475569', fontSize: 16, fontWeight: '700' },
  
  touchableBase: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
  },
  touchablePressed: { opacity: 0.7 },
  touchableText: { fontSize: 15, fontWeight: '600' },
  
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  
  mediaContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
    position: 'relative',
  },
  mediaImage: { width: '100%', height: '100%' },
  glassmorphicOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  glassText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
  },
  
  searchBar: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginBottom: 16,
  },
  accordion: { backgroundColor: '#FFFFFF', paddingHorizontal: 0 },
  
  fab: {
    position: 'absolute',
    margin: 24,
    right: 0,
    bottom: 0,
    backgroundColor: '#6366F1',
    borderRadius: 16,
  },
});
