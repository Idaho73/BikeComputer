import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Animated, ScrollView,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { atob } from 'react-native-quick-base64';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

const bleManager = new BleManager();
const SERVICE_UUID     = '12345678-1234-1234-1234-1234567890ab';
const NOTIFY_CHAR_UUID = 'abcdefab-1234-1234-1234-abcdefabcdef';

type Props = NativeStackScreenProps<RootStackParamList, 'SensorTest'>;

const MAX_HISTORY = 20;

export default function SensorTestScreen({ navigation, route }: Props) {
  const { deviceId, circumference } = route.params;

  const [pulseCount, setPulseCount]     = useState(0);
  const [lastInterval, setLastInterval] = useState<number | null>(null);
  const [testSpeed, setTestSpeed]       = useState<number | null>(null);
  const [history, setHistory]           = useState<number[]>([]); // interval history ms
  const [active, setActive]             = useState(false);

  const flashAnim   = useRef(new Animated.Value(0)).current;
  const lastTimeRef = useRef<number | null>(null);
  const prevPulsesRef = useRef(0);

  useEffect(() => {
    const sub = bleManager.monitorCharacteristicForDevice(
      deviceId, SERVICE_UUID, NOTIFY_CHAR_UUID,
      (error, char) => {
        if (error || !char?.value) return;
        const raw = atob(char.value);
        const parts = raw.split(',');
        if (parts.length !== 3) return;

        const pls = parseInt(parts[2], 10);
        if (isNaN(pls)) return;

        // Csak ha nőtt a pulzusszám (új jel érkezett)
        if (pls > prevPulsesRef.current) {
          prevPulsesRef.current = pls;
          const now = Date.now();

          if (lastTimeRef.current !== null) {
            const intervalMs = now - lastTimeRef.current;
            const spd = (circumference / (intervalMs / 1000)) * 3.6;

            setLastInterval(intervalMs);
            setTestSpeed(spd);
            setHistory(prev => {
              const updated = [...prev, intervalMs];
              return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
            });
          }

          lastTimeRef.current = now;
          setPulseCount(pls);

          // Villogás animáció
          setActive(true);
          Animated.sequence([
            Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
            Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start(() => setActive(false));
        }
      }
    );

    return () => sub.remove();
  }, []);

  const handleReset = () => {
    setPulseCount(0);
    setLastInterval(null);
    setTestSpeed(null);
    setHistory([]);
    lastTimeRef.current = null;
    prevPulsesRef.current = 0;
  };

  const flashColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#1A2040', '#00FF88'],
  });

  const avgInterval = history.length > 1
    ? history.reduce((a, b) => a + b, 0) / history.length
    : null;

  const consistency = history.length > 2
    ? (() => {
        const avg = history.reduce((a, b) => a + b, 0) / history.length;
        const variance = history.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / history.length;
        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / avg) * 100; // variációs koefficiens
        if (cv < 5)  return { label: 'Kiváló', color: '#00FF88' };
        if (cv < 15) return { label: 'Megfelelő', color: '#FFD600' };
        return { label: 'Gyenge', color: '#E24B4A' };
      })()
    : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SZENZOR TESZT</Text>
        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Élő jel kijelző */}
        <View style={styles.signalSection}>
          <Text style={styles.sectionLabel}>ÉLŐJEL KIJELZŐ</Text>
          <Text style={styles.signalHint}>
            Forgasd a kereket – minden mágnes áthaladásnál felvillan
          </Text>
          <Animated.View style={[styles.signalBulb, { backgroundColor: flashColor }]}>
            <Text style={[styles.signalIcon, active && styles.signalIconActive]}>
              {active ? '●' : '○'}
            </Text>
          </Animated.View>
          <Text style={styles.signalStatus}>
            {active ? 'JELET ÉRZÉKEL' : 'Várakozás...'}
          </Text>
        </View>

        {/* Stat sor */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{pulseCount}</Text>
            <Text style={styles.statLbl}>JELSZÁMLÁLÓ</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#00E5FF' }]}>
              {lastInterval !== null ? `${lastInterval} ms` : '–'}
            </Text>
            <Text style={styles.statLbl}>UTOLSÓ IDŐKÖZ</Text>
          </View>
        </View>

        {/* Teszt sebesség */}
        <View style={styles.speedCard}>
          <Text style={styles.sectionLabel}>TESZT SEBESSÉG</Text>
          <Text style={styles.speedHint}>
            Kerékkerület: {circumference.toFixed(3)}m alapján
          </Text>
          <View style={styles.speedRow}>
            <Text style={styles.speedVal}>
              {testSpeed !== null ? testSpeed.toFixed(1) : '–'}
            </Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
          {avgInterval !== null && (
            <Text style={styles.avgText}>
              Átl. időköz: {Math.round(avgInterval)} ms
            </Text>
          )}
        </View>

        {/* Jelminőség */}
        {consistency && (
          <View style={styles.qualityCard}>
            <Text style={styles.sectionLabel}>JELMINŐSÉG</Text>
            <View style={styles.qualityRow}>
              <View style={[styles.qualityDot, { backgroundColor: consistency.color }]} />
              <Text style={[styles.qualityLabel, { color: consistency.color }]}>
                {consistency.label}
              </Text>
            </View>
            <Text style={styles.qualityHint}>
              {consistency.label === 'Kiváló'
                ? 'A mágnes pozíciója tökéletes, stabil jelek érkeznek.'
                : consistency.label === 'Megfelelő'
                ? 'A mágnes kicsit közelebb lehet a szenzorhoz.'
                : 'Ellenőrizd a mágnes és szenzor távolságát – túl messze vagy túl közel lehet.'}
            </Text>
          </View>
        )}

        {/* Jelhistória vizualizáció */}
        {history.length > 1 && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionLabel}>JELHISTÓRIA  (utolsó {history.length})</Text>
            <View style={styles.historyBars}>
              {history.map((ms, i) => {
                const maxMs = Math.max(...history);
                const h = Math.max(4, (ms / maxMs) * 60);
                return (
                  <View key={i} style={styles.barWrap}>
                    <View style={[styles.bar, { height: h }]} />
                  </View>
                );
              })}
            </View>
            <View style={styles.historyLabels}>
              <Text style={styles.historyLabel}>régebbi</Text>
              <Text style={styles.historyLabel}>újabb →</Text>
            </View>
            <Text style={styles.historyHint}>
              Egyforma magasságú sávok = egyenletes forgás = helyes elhelyezés
            </Text>
          </View>
        )}

        {/* Tippek */}
        <View style={styles.tipsCard}>
          <Text style={styles.sectionLabel}>ELHELYEZÉSI TIPPEK</Text>
          {[
            { icon: '📏', text: 'A mágnes és szenzor távolsága ideálisan 3–8mm.' },
            { icon: '🔄', text: 'A mágnes legyen a küllőn, a szenzor a villán – ne mozogjon egymáshoz képest.' },
            { icon: '⚡', text: 'Ha nem érzékel: hozd közelebb a mágnest. Ha kétszeres jeleket kapsz: vidd távolabb.' },
            { icon: '✅', text: 'Ha a jelminőség "Kiváló", készen állsz a mérésre!' },
          ].map((tip, i) => (
            <View key={i} style={styles.tip}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

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
  backBtn: { width: 60 },
  backBtnText: { color: '#00E5FF', fontSize: 32, lineHeight: 32 },
  headerTitle: { color: '#00E5FF', fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  resetBtn: { width: 60, alignItems: 'flex-end' },
  resetBtnText: { color: '#4A5578', fontSize: 14 },

  scroll: { padding: 20, gap: 14, paddingBottom: 40 },

  sectionLabel: {
    color: '#4A5578', fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 6,
  },

  signalSection: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A2040',
    gap: 12,
  },
  signalHint: { color: '#3A4560', fontSize: 12, textAlign: 'center' },
  signalBulb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1A2040',
  },
  signalIcon: { fontSize: 40, color: '#2A3050' },
  signalIconActive: { color: '#0A0E1A' },
  signalStatus: {
    color: '#4A5578', fontSize: 11, letterSpacing: 2, fontWeight: '700',
  },

  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: '#0D1525',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2040',
    gap: 4,
  },
  statVal: { color: '#00FF88', fontSize: 22, fontWeight: '800' },
  statLbl: { color: '#3A4560', fontSize: 9, letterSpacing: 1.5 },

  speedCard: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 20,
    borderTopWidth: 2,
    borderTopColor: '#E24B4A',
    borderWidth: 1,
    borderColor: '#1A2040',
    gap: 4,
  },
  speedHint: { color: '#3A4560', fontSize: 11, marginBottom: 4 },
  speedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  speedVal: { color: '#E24B4A', fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  speedUnit: { color: '#4A5578', fontSize: 16 },
  avgText: { color: '#3A4560', fontSize: 11, marginTop: 4 },

  qualityCard: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2040',
    gap: 8,
  },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qualityDot: { width: 12, height: 12, borderRadius: 6 },
  qualityLabel: { fontSize: 18, fontWeight: '700' },
  qualityHint: { color: '#4A5578', fontSize: 12, lineHeight: 18 },

  historyCard: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2040',
    gap: 8,
  },
  historyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 68,
    gap: 3,
  },
  barWrap: { flex: 1, justifyContent: 'flex-end' },
  bar: {
    backgroundColor: '#378ADD',
    borderRadius: 2,
    minHeight: 4,
  },
  historyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyLabel: { color: '#2A3050', fontSize: 9 },
  historyHint: { color: '#3A4560', fontSize: 11, lineHeight: 16 },

  tipsCard: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2040',
    gap: 12,
  },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipIcon: { fontSize: 16, width: 24 },
  tipText: { color: '#4A5578', fontSize: 12, lineHeight: 18, flex: 1 },
});