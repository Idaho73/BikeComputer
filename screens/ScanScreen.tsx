import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, PermissionsAndroid,
  StatusBar, Animated,
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

const bleManager = new BleManager();

interface ScannedDevice {
  device: Device;
  rssi: number;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export default function ScanScreen({ navigation }: Props) {
  const [isScanning, setIsScanning]   = useState(false);
  const [devices, setDevices]         = useState<Map<string, ScannedDevice>>(new Map());
  const [bleState, setBleState]       = useState<State>(State.Unknown);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const sub = bleManager.onStateChange((state) => {
      setBleState(state);
      if (state === State.PoweredOff) {
        Alert.alert('Bluetooth kikapcsolva', 'Kérlek kapcsold be a Bluetooth-t!');
      }
    }, true);
    return () => { sub.remove(); bleManager.stopDeviceScan(); };
  }, []);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const api = Platform.Version as number;
    if (api >= 31) {
      const r = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(r).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  };

  const startScan = async () => {
    if (bleState !== State.PoweredOn) {
      Alert.alert('Bluetooth nem elérhető', 'Kapcsold be a Bluetooth-t!');
      return;
    }
    const ok = await requestPermissions();
    if (!ok) { Alert.alert('Engedély megtagadva'); return; }

    setDevices(new Map());
    setIsScanning(true);
    startPulse();

    bleManager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) { setIsScanning(false); stopPulse(); return; }
      if (device?.name) {
        setDevices(prev => {
          const m = new Map(prev);
          m.set(device.id, { device, rssi: device.rssi ?? -100 });
          return m;
        });
      }
    });

    setTimeout(() => { bleManager.stopDeviceScan(); setIsScanning(false); stopPulse(); }, 15000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
    stopPulse();
  };

  const connectToDevice = async (device: Device) => {
    setConnectingId(device.id);
    stopScan();
    try {
      // Reconnect logika: ha már csatlakozva van, disconnect először
      try { await bleManager.cancelDeviceConnection(device.id); } catch {}
      const connected = await device.connect({ autoConnect: false });
      await connected.discoverAllServicesAndCharacteristics();
      navigation.navigate('Dashboard', { deviceId: device.id, deviceName: device.name ?? 'ESP32' });
    } catch (e: any) {
      Alert.alert('Hiba', `Nem sikerült csatlakozni: ${e?.message ?? 'Ismeretlen hiba'}`);
    } finally {
      setConnectingId(null);
    }
  };

  const getRssiBar = (rssi: number) => {
    if (rssi >= -60) return '████';
    if (rssi >= -75) return '███░';
    if (rssi >= -85) return '██░░';
    return '█░░░';
  };

  const sorted = [...devices.values()].sort((a, b) => b.rssi - a.rssi);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BIKE COMPUTER</Text>
          <Text style={styles.headerSub}>ESP32 Bluetooth kapcsolat</Text>
        </View>
        {/* History + Settings gombok */}
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.headerIconBtnText}>📋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BLE állapot */}
      <View style={styles.bleStatus}>
        <View style={[styles.bleDot, { backgroundColor: bleState === State.PoweredOn ? '#00FF88' : '#E24B4A' }]} />
        <Text style={styles.bleStatusText}>
          {bleState === State.PoweredOn ? 'Bluetooth aktív' : 'Bluetooth inaktív'}
        </Text>
      </View>

      {/* Scan gomb */}
      <View style={styles.scanSection}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.scanBtn, isScanning && styles.scanBtnActive]}
            onPress={isScanning ? stopScan : startScan}
          >
            <Text style={styles.scanBtnIcon}>{isScanning ? '⏹' : '🔍'}</Text>
            <Text style={[styles.scanBtnText, isScanning && styles.scanBtnTextActive]}>
              {isScanning ? 'Szkennelés leállítása' : 'Eszközök keresése'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
        {isScanning && (
          <View style={styles.scanningRow}>
            <ActivityIndicator size="small" color="#00E5FF" />
            <Text style={styles.scanningText}>Keresés folyamatban...</Text>
          </View>
        )}
      </View>

      {/* Eszközlista */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>TALÁLT ESZKÖZÖK</Text>
          <Text style={styles.listCount}>{devices.size} db</Text>
        </View>

        {devices.size === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyText}>
              {isScanning ? 'Keresés...' : 'Nyomd meg a keresés gombot'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={item => item.device.id}
            renderItem={({ item }) => {
              const isBike = !!item.device.name?.toLowerCase().match(/esp|bike|km|tracker/);
              const isConn = connectingId === item.device.id;
              return (
                <TouchableOpacity
                  style={[styles.deviceCard, isBike && styles.deviceCardHL]}
                  onPress={() => connectToDevice(item.device)}
                  disabled={!!connectingId}
                  activeOpacity={0.7}
                >
                  <View style={styles.deviceLeft}>
                    <View style={[styles.deviceIcon, isBike && styles.deviceIconHL]}>
                      <Text style={{ fontSize: 22 }}>{isBike ? '🚴' : '📡'}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.deviceName}>{item.device.name}</Text>
                      <Text style={styles.deviceId}>{item.device.id.slice(0, 17)}</Text>
                      {isBike && (
                        <View style={styles.espBadge}>
                          <Text style={styles.espBadgeText}>ESP32</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.deviceRight}>
                    <Text style={styles.rssiBar}>{getRssiBar(item.rssi)}</Text>
                    <Text style={styles.rssiVal}>{item.rssi} dBm</Text>
                    {isConn
                      ? <ActivityIndicator size="small" color="#00E5FF" />
                      : <Text style={styles.arrow}>›</Text>
                    }
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
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
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#00E5FF', letterSpacing: 3 },
  headerSub: { fontSize: 12, color: '#4A5578', letterSpacing: 1, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#0D1525', borderWidth: 1, borderColor: '#1A2040',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconBtnText: { fontSize: 20 },
  bleStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10, gap: 8 },
  bleDot: { width: 8, height: 8, borderRadius: 4 },
  bleStatusText: { color: '#6B7A99', fontSize: 13 },
  scanSection: { paddingHorizontal: 24, paddingBottom: 16, gap: 10 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D1525', borderWidth: 1.5, borderColor: '#00E5FF',
    borderRadius: 12, paddingVertical: 16, gap: 10,
  },
  scanBtnActive: { borderColor: '#FF6B35', backgroundColor: '#1A0E05' },
  scanBtnIcon: { fontSize: 20 },
  scanBtnText: { color: '#00E5FF', fontSize: 15, fontWeight: '700' },
  scanBtnTextActive: { color: '#FF6B35' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scanningText: { color: '#4A5578', fontSize: 13 },
  listSection: { flex: 1, paddingHorizontal: 24 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listTitle: { color: '#4A5578', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  listCount: { color: '#00E5FF', fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 48, opacity: 0.3 },
  emptyText: { color: '#3A4560', fontSize: 14, textAlign: 'center' },
  deviceCard: {
    backgroundColor: '#0D1525', borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#1A2040',
  },
  deviceCardHL: { borderColor: '#00E5FF', backgroundColor: '#061828' },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceIcon: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#1A2040', alignItems: 'center', justifyContent: 'center',
  },
  deviceIconHL: { backgroundColor: '#001A22' },
  deviceName: { color: '#E8EDF5', fontSize: 15, fontWeight: '600' },
  deviceId: { color: '#3A4560', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  espBadge: {
    backgroundColor: '#00E5FF22', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2,
  },
  espBadgeText: { color: '#00E5FF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  deviceRight: { alignItems: 'flex-end', gap: 4 },
  rssiBar: { color: '#00E5FF', fontSize: 10, letterSpacing: 1 },
  rssiVal: { color: '#4A5578', fontSize: 11 },
  arrow: { color: '#00E5FF', fontSize: 24 },
});