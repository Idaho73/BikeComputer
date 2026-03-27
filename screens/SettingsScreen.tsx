import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, TextInput, Alert,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { btoa } from 'react-native-quick-base64';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

const bleManager = new BleManager();
const SERVICE_UUID    = '12345678-1234-1234-1234-1234567890ab';
const WRITE_CHAR_UUID = 'abcdefab-1234-1234-1234-abcdefabcdf0';

const WHEEL_PRESETS = [
  { label: '20"',        circumference: 1.59 },
  { label: '24"',        circumference: 1.91 },
  { label: '26"',        circumference: 2.07 },
  { label: '27.5"',      circumference: 2.19 },
  { label: '28" / 700c', circumference: 2.20 },
  { label: '29"',        circumference: 2.29 },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation, route }: Props) {
  const { deviceId, currentCircumference } = route.params;
  // Alapértelmezett 27.5" (2.19m) ha az átadott érték az alapértelmezett
  const [selected, setSelected]     = useState(currentCircumference ?? 2.19);
  const [customInput, setCustomInput] = useState('');
  const [sending, setSending]       = useState(false);

  const sendToESP = async (circumference: number) => {
    setSending(true);
    try {
      const encoded = btoa(circumference.toFixed(4));
      await bleManager.writeCharacteristicWithResponseForDevice(
        deviceId, SERVICE_UUID, WRITE_CHAR_UUID, encoded
      );
      Alert.alert('Elküldve', `Kerékkerület: ${circumference.toFixed(3)} m`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Hiba', `Nem sikerült elküldeni: ${err?.message ?? 'Ismeretlen hiba'}`);
    } finally {
      setSending(false);
    }
  };

  const handleCustom = () => {
    const val = parseFloat(customInput.replace(',', '.'));
    if (isNaN(val) || val < 0.5 || val > 4.0) {
      Alert.alert('Hibás érték', 'Adj meg 0.5 és 4.0 közötti értéket (méterben).');
      return;
    }
    setSelected(val);
    sendToESP(val);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BEÁLLÍTÁSOK</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Kerékméret */}
        <Text style={styles.sectionLabel}>KERÉKMÉRET</Text>

        {WHEEL_PRESETS.map(preset => {
          const isSelected = Math.abs(selected - preset.circumference) < 0.001;
          return (
            <TouchableOpacity
              key={preset.label}
              style={[styles.presetCard, isSelected && styles.presetCardSelected]}
              onPress={() => setSelected(preset.circumference)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.presetLabel, isSelected && styles.presetLabelSelected]}>
                  {preset.label}
                </Text>
                <Text style={styles.presetCirc}>{preset.circumference.toFixed(2)} m kerület</Text>
              </View>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}

        {/* Egyéni */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>EGYÉNI KERÉKKERÜLET</Text>
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            value={customInput}
            onChangeText={setCustomInput}
            placeholder="pl. 2.155"
            placeholderTextColor="#3A4560"
            keyboardType="numeric"
            maxLength={6}
          />
          <Text style={styles.customUnit}>m</Text>
          <TouchableOpacity style={styles.customBtn} onPress={handleCustom}>
            <Text style={styles.customBtnText}>Beállít</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Hogyan mérd meg?</Text>
          <Text style={styles.infoText}>
            Jelölj meg egy pontot a kerék oldalán, told előre egy teljes fordulatig,
            majd mérd meg a két jelölés közötti távolságot méterben.
          </Text>
        </View>

        {/* Küldés */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={() => sendToESP(selected)}
          disabled={sending}
        >
          <Text style={styles.sendBtnText}>
            {sending ? 'Küldés...' : 'Mentés és küldés ESP32-nek →'}
          </Text>
          <Text style={styles.sendBtnSub}>{selected.toFixed(3)} m kerékkerület</Text>
        </TouchableOpacity>

        {/* Szenzor teszt */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ESZKÖZÖK</Text>
        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => navigation.navigate('SensorTest', { deviceId, circumference: selected })}
          activeOpacity={0.7}
        >
          <View style={styles.toolIcon}>
            <Text style={{ fontSize: 24 }}>🔧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Szenzor felszerelési teszt</Text>
            <Text style={styles.toolSub}>Élő jel, jelminőség, elhelyezési segítség</Text>
          </View>
          <Text style={styles.toolArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => navigation.navigate('History')}
          activeOpacity={0.7}
        >
          <View style={styles.toolIcon}>
            <Text style={{ fontSize: 24 }}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Session előzmények</Text>
            <Text style={styles.toolSub}>Korábbi kerékpározások megtekintése</Text>
          </View>
          <Text style={styles.toolArrow}>›</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2040',
  },
  backBtn: { width: 40 },
  backBtnText: { color: '#00E5FF', fontSize: 32, lineHeight: 32 },
  headerTitle: { color: '#00E5FF', fontSize: 14, fontWeight: '800', letterSpacing: 3 },
  scroll: { padding: 24, gap: 10, paddingBottom: 40 },
  sectionLabel: {
    color: '#4A5578', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 2,
  },
  presetCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0D1525', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1A2040',
  },
  presetCardSelected: { borderColor: '#00E5FF', backgroundColor: '#061828' },
  presetLabel: { color: '#6B7A99', fontSize: 17, fontWeight: '700' },
  presetLabelSelected: { color: '#FFFFFF' },
  presetCirc: { color: '#3A4560', fontSize: 12, marginTop: 2 },
  checkmark: { color: '#00E5FF', fontSize: 18, fontWeight: '700' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: {
    flex: 1, backgroundColor: '#0D1525', borderWidth: 1, borderColor: '#1A2040',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#E8EDF5', fontSize: 16,
  },
  customUnit: { color: '#4A5578', fontSize: 14 },
  customBtn: {
    backgroundColor: '#1A2040', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  customBtnText: { color: '#00E5FF', fontSize: 14, fontWeight: '600' },
  infoBox: {
    backgroundColor: '#0D1525', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1A2040', gap: 6,
  },
  infoTitle: { color: '#E8EDF5', fontSize: 13, fontWeight: '600' },
  infoText: { color: '#4A5578', fontSize: 12, lineHeight: 18 },
  sendBtn: {
    backgroundColor: '#00E5FF', borderRadius: 12, padding: 18,
    alignItems: 'center', gap: 4,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#0A0E1A', fontSize: 15, fontWeight: '800' },
  sendBtnSub: { color: '#0A0E1A', fontSize: 12, opacity: 0.6 },
  toolCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D1525', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1A2040',
  },
  toolIcon: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: '#1A2040', alignItems: 'center', justifyContent: 'center',
  },
  toolTitle: { color: '#E8EDF5', fontSize: 14, fontWeight: '600' },
  toolSub: { color: '#4A5578', fontSize: 11, marginTop: 2 },
  toolArrow: { color: '#4A5578', fontSize: 24 },
});