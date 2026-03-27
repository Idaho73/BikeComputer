import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { atob } from 'react-native-quick-base64';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useSessionStore } from '../sessionStore';

const bleManager = new BleManager();
const SERVICE_UUID     = '12345678-1234-1234-1234-1234567890ab';
const NOTIFY_CHAR_UUID = 'abcdefab-1234-1234-1234-abcdefabcdef';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation, route }: Props) {
  const { deviceId, deviceName } = route.params;
  const [clock, setClock]       = useState(new Date());
  const [connected, setConnected] = useState(true);
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef(false);

  const currentSpeed    = useSessionStore(s => s.currentSpeed);
  const running         = useSessionStore(s => s.running);
  const elapsed         = useSessionStore(s => s.elapsed);
  const sessionDistance = useSessionStore(s => s.sessionDistance);
  const onSpeedData     = useSessionStore(s => s.onSpeedData);
  const startSession    = useSessionStore(s => s.startSession);
  const stopSession     = useSessionStore(s => s.stopSession);
  const tick            = useSessionStore(s => s.tick);
  const reset           = useSessionStore(s => s.reset);

  useEffect(() => {
    setupBLE();
    clockRef.current = setInterval(() => setClock(new Date()), 1000);

    const disconnectSub = bleManager.onDeviceDisconnected(deviceId, () => {
      setConnected(false);
      if (reconnectRef.current) return;
      reconnectRef.current = true;

      // Automatikus újracsatlakozás 3 kísérlet
      let attempts = 0;
      const tryReconnect = async () => {
        if (attempts >= 3) {
          Alert.alert('Kapcsolat megszakadt', 'Nem sikerült újracsatlakozni.', [
            { text: 'Vissza', onPress: () => { reset(); navigation.goBack(); } },
          ]);
          reconnectRef.current = false;
          return;
        }
        attempts++;
        try {
          const dev = await bleManager.connectToDevice(deviceId);
          await dev.discoverAllServicesAndCharacteristics();
          setConnected(true);
          reconnectRef.current = false;
          setupBLE();
        } catch {
          setTimeout(tryReconnect, 2000);
        }
      };
      setTimeout(tryReconnect, 1500);
    });

    return () => {
      reconnectRef.current = true; // Ne próbáljon reconnect-et unmount-kor
      disconnectSub.remove();
      bleManager.cancelDeviceConnection(deviceId).catch(() => {});
      if (tickRef.current) clearInterval(tickRef.current);
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => tick(), 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running]);

  const setupBLE = () => {
    bleManager.monitorCharacteristicForDevice(
      deviceId, SERVICE_UUID, NOTIFY_CHAR_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const raw = atob(characteristic.value);
        const parts = raw.split(',');
        if (parts.length === 3) {
          const spd = parseFloat(parts[0]);
          const dst = parseFloat(parts[1]);
          const pls = parseInt(parts[2], 10);
          if (!isNaN(spd) && !isNaN(dst) && !isNaN(pls)) {
            onSpeedData(spd, dst, pls);
          }
        }
      }
    );
  };

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const clockStr = clock.toLocaleTimeString('hu-HU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { reset(); navigation.goBack(); }}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.deviceName}>{deviceName}</Text>
          <View style={styles.connRow}>
            <View style={[styles.connDot, { backgroundColor: connected ? '#00FF88' : '#E24B4A' }]} />
            <Text style={styles.connText}>{connected ? 'Csatlakozva' : 'Újracsatlakozás...'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.iconBtnText}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Settings', { deviceId, currentCircumference: 2.19 })}
          >
            <Text style={styles.iconBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Óra */}
      <View style={styles.clockRow}>
        <Text style={styles.clockText}>{clockStr}</Text>
      </View>

      {/* Sebesség */}
      <View style={styles.speedSection}>
        <Text style={styles.speedLabel}>SEBESSÉG</Text>
        <View style={styles.speedRow}>
          <Text style={styles.speedValue}>{currentSpeed.toFixed(1)}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
        {running && (
          <View style={styles.distanceRow}>
            <Text style={styles.distanceVal}>{sessionDistance.toFixed(2)}</Text>
            <Text style={styles.distanceUnit}>km</Text>
          </View>
        )}
      </View>

      {/* Session státusz */}
      <View style={styles.sessionStatus}>
        {running ? (
          <View style={styles.runningBadge}>
            <View style={styles.runningDot} />
            <Text style={styles.runningText}>Session fut · {formatElapsed(elapsed)}</Text>
          </View>
        ) : (
          <Text style={styles.noSessionText}>Nincs aktív session</Text>
        )}
      </View>

      {/* Gombok */}
      <View style={styles.btnGroup}>
        {!running ? (
          <TouchableOpacity style={styles.startBtn} onPress={startSession}>
            <Text style={styles.startBtnText}>▶  Session indítása</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('Session')}
            >
              <Text style={styles.detailBtnText}>Részletes nézet  →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => stopSession()}
            >
              <Text style={styles.stopBtnText}>⏹  Session leállítása</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
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
  backBtn: { width: 36 },
  backBtnText: { color: '#00E5FF', fontSize: 32, lineHeight: 32 },
  headerCenter: { alignItems: 'center' },
  deviceName: { color: '#E8EDF5', fontSize: 16, fontWeight: '700' },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  connDot: { width: 7, height: 7, borderRadius: 4 },
  connText: { color: '#4A5578', fontSize: 12 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#0D1525', borderWidth: 1, borderColor: '#1A2040',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18 },
  clockRow: { alignItems: 'center', paddingTop: 10 },
  clockText: { color: '#4A5578', fontSize: 16, letterSpacing: 2 },
  speedSection: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  speedLabel: { color: '#4A5578', fontSize: 11, letterSpacing: 3, fontWeight: '700' },
  speedRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  speedValue: {
    fontSize: 108, fontWeight: '900', color: '#FFFFFF',
    lineHeight: 108, letterSpacing: -5,
  },
  speedUnit: { fontSize: 22, color: '#4A5578', marginBottom: 12 },
  distanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  distanceVal: { color: '#00E5FF', fontSize: 24, fontWeight: '700' },
  distanceUnit: { color: '#4A5578', fontSize: 14 },
  sessionStatus: { alignItems: 'center', paddingBottom: 16 },
  runningBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#061828', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#00E5FF44',
  },
  runningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FF88' },
  runningText: { color: '#00E5FF', fontSize: 14, fontWeight: '600' },
  noSessionText: { color: '#2A3050', fontSize: 13 },
  btnGroup: { padding: 24, gap: 12 },
  startBtn: {
    backgroundColor: '#00E5FF', borderRadius: 14, padding: 18, alignItems: 'center',
  },
  startBtnText: { color: '#0A0E1A', fontSize: 16, fontWeight: '800' },
  detailBtn: {
    backgroundColor: '#0D1525', borderRadius: 14, padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#00E5FF',
  },
  detailBtnText: { color: '#00E5FF', fontSize: 15, fontWeight: '700' },
  stopBtn: {
    backgroundColor: '#0D1525', borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#E24B4A',
  },
  stopBtnText: { color: '#E24B4A', fontSize: 14, fontWeight: '600' },
});