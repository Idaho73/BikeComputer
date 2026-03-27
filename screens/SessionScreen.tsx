import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useSessionStore } from '../sessionStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

function getOrientation() {
  const { width, height } = Dimensions.get('window');
  return width > height ? 'landscape' : 'portrait';
}

export default function SessionScreen({ navigation }: Props) {
  const [orientation, setOrientation] = useState(getOrientation());
  const [clock, setClock] = useState(new Date());

  const points          = useSessionStore(s => s.points);
  const elapsed         = useSessionStore(s => s.elapsed);
  const currentSpeed    = useSessionStore(s => s.currentSpeed);
  const maxSpeed        = useSessionStore(s => s.maxSpeed);
  const sessionDistance = useSessionStore(s => s.sessionDistance);
  const running         = useSessionStore(s => s.running);
  const stopSession     = useSessionStore(s => s.stopSession);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => setOrientation(getOrientation()));
    const cl  = setInterval(() => setClock(new Date()), 1000);
    return () => { sub.remove(); clearInterval(cl); };
  }, []);

  const movingPoints = points.filter(p => p.spd > 0);
  const avgSpeed = movingPoints.length > 0
    ? movingPoints.reduce((a, b) => a + b.spd, 0) / movingPoints.length : 0;
  const movingTime = movingPoints.length;

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const isLandscape = orientation === 'landscape';
  const chartWidth  = isLandscape ? screenW - 120 : screenW - 64;
  const chartHeight = isLandscape ? screenH - 60  : 180;

  const chartData = useMemo(() => {
    if (points.length < 2) return null;
    const data  = points.map(p => parseFloat(p.spd.toFixed(1)));
    const step  = Math.max(1, Math.floor(points.length / 5));
    const labels = points.map((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return '';
      const m = Math.floor(p.t / 60);
      const s = p.t % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    });
    return { labels, datasets: [{ data }] };
  }, [points]);

  // Napsütésre optimalizált grafikon beállítások
  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Fekete vonal
    labelColor: () => '#000000', // Fekete számok
    propsForDots: { r: '0' },
    propsForBackgroundLines: { stroke: '#E0E0E0', strokeDasharray: '' },
    strokeWidth: 3,
    fillShadowGradientFrom: '#007AFF',
    fillShadowGradientTo: '#FFFFFF',
    fillShadowGradientFromOpacity: 0.1,
    fillShadowGradientToOpacity: 0,
  };

  const formatTime = (secs: number) => {
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

  if (isLandscape) {
    return (
      <View style={styles.landscapeContainer}>
        <StatusBar hidden />
        <View style={styles.landscapeSide}>
          <Text style={styles.landscapeSpeed}>{currentSpeed.toFixed(1)}</Text>
          <Text style={styles.landscapeUnit}>km/h</Text>
          <View style={styles.divider} />
          <Text style={[styles.landscapeStatVal, { color: '#D32F2F' }]}>{maxSpeed.toFixed(1)}</Text>
          <Text style={styles.landscapeStatLbl}>MAX</Text>
          <Text style={[styles.landscapeStatVal, { color: '#1976D2' }]}>{avgSpeed.toFixed(1)}</Text>
          <Text style={styles.landscapeStatLbl}>ÁTL.</Text>
          <Text style={[styles.landscapeStatVal, { color: '#00897B' }]}>{sessionDistance.toFixed(2)}</Text>
          <Text style={styles.landscapeStatLbl}>KM</Text>
          <Text style={styles.landscapeClock}>{clockStr}</Text>
        </View>
        <View style={styles.landscapeChart}>
          {!chartData ? (
            <View style={styles.noData}><Text style={styles.noDataText}>Adatok...</Text></View>
          ) : (
            <LineChart
              data={chartData} width={chartWidth} height={chartHeight}
              withDots={false} withInnerLines={true} withOuterLines={false}
              chartConfig={chartConfig} style={{ borderRadius: 8 }} fromZero
            />
          )}
        </View>
        <TouchableOpacity style={styles.landscapeBack} onPress={() => navigation.goBack()}>
          <Text style={styles.landscapeBackText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>SESSION</Text>
          <Text style={styles.headerClock}>{clockStr}</Text>
        </View>
        <View style={styles.headerRight}>
          {running && <View style={styles.liveDot} />}
          <Text style={styles.elapsed}>{formatTime(elapsed)}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartLabel}>SEBESSÉG PROFIL</Text>
            <View style={styles.chartCurRow}>
              <Text style={styles.chartCurVal}>{currentSpeed.toFixed(1)}</Text>
              <Text style={styles.chartCurUnit}>km/h</Text>
            </View>
          </View>
          {!chartData ? (
            <View style={styles.noData}><Text style={styles.noDataText}>Várakozás adatokra...</Text></View>
          ) : (
            <LineChart
              data={chartData} width={chartWidth} height={chartHeight}
              withDots={false} withInnerLines={true} withOuterLines={false}
              chartConfig={chartConfig} bezier style={styles.chart} fromZero
            />
          )}
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="SEBESSÉG" value={currentSpeed.toFixed(1)} unit="km/h" accent="#000000" />
          <StatCard label="MAXIMUM" value={maxSpeed.toFixed(1)} unit="km/h" accent="#D32F2F" />
          <StatCard label="ÁTLAG" value={avgSpeed.toFixed(1)} unit="km/h" accent="#1976D2" />
          <StatCard label="TÁVOLSÁG" value={sessionDistance.toFixed(2)} unit="km" accent="#2E7D32" />
          <StatCard label="MOZGÁS" value={formatTime(movingTime)} unit="idő" accent="#F57F17" />
          <StatCard label="ÖSSZESEN" value={formatTime(elapsed)} unit="idő" accent="#455A64" />
        </View>

        {running ? (
          <TouchableOpacity style={styles.stopBtn} onPress={() => stopSession()}>
            <Text style={styles.stopBtnText}>STOP SESSION</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.stoppedBadge}>
            <Text style={styles.stoppedText}>SESSION LEÁLLÍTVA</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, unit, accent }: {
  label: string; value: string; unit: string; accent: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  backBtn: { width: 40 },
  backBtnText: { color: '#000000', fontSize: 36, fontWeight: '300' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: '#000000', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  headerClock: { color: '#666666', fontSize: 12, fontWeight: '600', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D32F2F' },
  elapsed: { color: '#000000', fontSize: 20, fontWeight: '900' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  chartCard: {
    backgroundColor: '#F2F2F7', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartLabel: { color: '#000000', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  chartCurRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  chartCurVal: { color: '#000000', fontSize: 28, fontWeight: '900' },
  chartCurUnit: { color: '#666666', fontSize: 12, fontWeight: '700' },
  chart: { marginHorizontal: -10 },
  noData: { height: 180, alignItems: 'center', justifyContent: 'center' },
  noDataText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#F2F2F7',
    borderRadius: 14, padding: 15, borderTopWidth: 5,
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  statValue: { fontSize: 26, fontWeight: '900' },
  statUnit: { color: '#666666', fontSize: 12, fontWeight: '800', marginTop: -2 },
  statLabel: { color: '#000000', fontSize: 10, fontWeight: '800', marginTop: 8, opacity: 0.7 },
  stopBtn: {
    backgroundColor: '#000000', borderRadius: 16, padding: 20, alignItems: 'center',
    marginTop: 10,
  },
  stopBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  stoppedBadge: { alignItems: 'center', padding: 20, backgroundColor: '#F2F2F7', borderRadius: 16 },
  stoppedText: { color: '#000000', fontSize: 14, fontWeight: '800' },
  landscapeContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 10 },
  landscapeSide: { width: 100, alignItems: 'center', justifyContent: 'center', gap: 2 },
  landscapeSpeed: { color: '#000000', fontSize: 32, fontWeight: '900' },
  landscapeUnit: { color: '#666666', fontSize: 12, fontWeight: '800' },
  divider: { width: 60, height: 2, backgroundColor: '#000000', marginVertical: 8 },
  landscapeStatVal: { fontSize: 20, fontWeight: '900' },
  landscapeStatLbl: { color: '#000000', fontSize: 10, fontWeight: '800', marginBottom: 5 },
  landscapeClock: { color: '#666666', fontSize: 11, fontWeight: '700', marginTop: 15 },
  landscapeChart: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  landscapeBack: { width: 50, alignItems: 'center', justifyContent: 'center' },
  landscapeBackText: { color: '#000000', fontSize: 24, fontWeight: '900' },
});