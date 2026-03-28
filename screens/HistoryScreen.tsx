import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  FlatList, Dimensions, Alert, RefreshControl, PanResponder,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { AreaChart, Grid } from 'react-native-svg-charts';
import { Path, Defs, LinearGradient, Stop, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import * as shape from 'd3-shape';
import { SessionDB, SavedSession } from '../db/sessionDB';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

function getDims() {
  const { width, height } = Dimensions.get('window');
  return { width, height, isLandscape: width > height };
}

// ─── Tooltip overlay (SVG decorator) ─────────────────────────────────────────
const TooltipLine = ({ x, y, data, activeIdx }: any) => {
  if (activeIdx === null || activeIdx === undefined || !data[activeIdx]) return null;
  const cx = x(activeIdx);
  const cy = y(data[activeIdx].spd);
  const val = data[activeIdx].spd.toFixed(1);
  const labelX = cx > 200 ? cx - 60 : cx + 8;
  return (
    <>
      <Line x1={cx} x2={cx} y1={0} y2={1000} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={5} fill="#E24B4A" stroke="#0D1525" strokeWidth={2} />
      <Rect x={labelX} y={cy - 22} width={52} height={20} rx={4} fill="rgba(10,14,26,0.9)" />
      <SvgText x={labelX + 26} y={cy - 8} fontSize={11} fill="#E24B4A" textAnchor="middle" fontWeight="bold">
        {val} km/h
      </SvgText>
    </>
  );
};

// ─── Gradient fill ────────────────────────────────────────────────────────────
const GradientFill = () => (
  <Defs>
    <LinearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#E24B4A" stopOpacity={0.35} />
      <Stop offset="1" stopColor="#E24B4A" stopOpacity={0} />
    </LinearGradient>
  </Defs>
);

// ─── Interactive chart ────────────────────────────────────────────────────────
function SpeedChart({ points, width, height }: {
  points: { t: number; spd: number }[];
  width: number;
  height: number;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const chartRef = useRef<View>(null);
  const chartLeft = useRef(0);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const idx = Math.round((x / width) * (points.length - 1));
      setActiveIdx(Math.max(0, Math.min(points.length - 1, idx)));
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const idx = Math.round((x / width) * (points.length - 1));
      setActiveIdx(Math.max(0, Math.min(points.length - 1, idx)));
    },
    onPanResponderRelease: () => setActiveIdx(null),
    onPanResponderTerminate: () => setActiveIdx(null),
  }), [points.length, width]);

  const data = points.map(p => p.spd);
  const maxY  = Math.ceil(Math.max(...data) * 1.15) || 10;

  return (
    <View {...panResponder.panHandlers} style={{ width, height }}>
      <AreaChart
        style={{ width, height }}
        data={points}
        yAccessor={({ item }) => item.spd}
        xAccessor={({ index }) => index}
        yMin={0}
        yMax={maxY}
        curve={shape.curveCatmullRom}
        svg={{ stroke: '#E24B4A', strokeWidth: 2, fill: 'url(#speedGrad)' }}
        contentInset={{ top: 16, bottom: 8 }}
      >
        <GradientFill />
        <Grid svg={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }} />
        <TooltipLine data={points} activeIdx={activeIdx} />
      </AreaChart>
    </View>
  );
}

// ─── Main list screen ─────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }: Props) {
  const [sessions, setSessions]     = useState<SavedSession[]>([]);
  const [selected, setSelected]     = useState<SavedSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setSessions(await SessionDB.getAll());
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete session', 'Are you sure you want to delete this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await SessionDB.delete(id);
          if (selected?.id === id) setSelected(null);
          await load();
        },
      },
    ]);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  const formatTimeOfDay = (iso: string) =>
    new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (selected) {
    return (
      <DetailView
        session={selected}
        onBack={() => setSelected(null)}
        onDelete={() => handleDelete(selected.id)}
        formatDate={formatDate}
        formatDuration={formatDuration}
        formatTimeOfDay={formatTimeOfDay}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SESSION HISTORY</Text>
        <View style={{ width: 40 }} />
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚴</Text>
          <Text style={styles.emptyTitle}>No saved sessions yet</Text>
          <Text style={styles.emptyText}>Start a session – it will be saved automatically when you stop.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />}
          ListHeaderComponent={<Text style={styles.listCount}>{sessions.length} saved sessions</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.7}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.cardTime}>{formatTimeOfDay(item.date)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardStats}>
                <MiniStat label="Distance"  value={`${item.distance.toFixed(2)} km`}  accent="#00E5FF" />
                <MiniStat label="Max speed" value={`${item.maxSpeed.toFixed(1)} km/h`} accent="#E24B4A" />
                <MiniStat label="Avg speed" value={`${item.avgSpeed.toFixed(1)} km/h`} accent="#378ADD" />
                <MiniStat label="Duration"  value={formatDuration(item.duration)}       accent="#00FF88" />
              </View>
              <View style={styles.cardFooter}>
                {(item.gpsTrack?.length ?? 0) > 0 && (
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsBadgeText}>📍 GPS route</Text>
                  </View>
                )}
                <Text style={styles.cardArrow}>Details →</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────
function DetailView({ session, onBack, onDelete, formatDate, formatDuration, formatTimeOfDay }: {
  session: SavedSession;
  onBack: () => void;
  onDelete: () => void;
  formatDate: (s: string) => string;
  formatDuration: (n: number) => string;
  formatTimeOfDay: (s: string) => string;
}) {
  const [activeTab, setActiveTab] = useState<'chart' | 'map'>('chart');
  const [dims, setDims]           = useState(getDims());

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => setDims(getDims()));
    return () => sub.remove();
  }, []);

  const { width: screenW, height: screenH, isLandscape } = dims;
  const hasGps = (session.gpsTrack?.length ?? 0) >= 2;

  // Downsample: max 200 pont a chart-hoz
  const chartPoints = useMemo(() => {
    if (session.points.length === 0) return [];
    const step = Math.max(1, Math.floor(session.points.length / 200));
    return session.points.filter((_, i) => i % step === 0);
  }, [session.points]);

  const mapRegion = useMemo(() => {
    if (!hasGps) return null;
    const lats = session.gpsTrack.map(p => p.lat);
    const lngs = session.gpsTrack.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude:      (minLat + maxLat) / 2,
      longitude:     (minLng + maxLng) / 2,
      latitudeDelta:  Math.max(maxLat - minLat + 0.002, 0.005),
      longitudeDelta: Math.max(maxLng - minLng + 0.002, 0.005),
    };
  }, [session.gpsTrack]);

  const coordinates = session.gpsTrack?.map(p => ({ latitude: p.lat, longitude: p.lng })) ?? [];

  // LANDSCAPE – full screen chart
  if (isLandscape) {
    return (
      <View style={styles.landscapeContainer}>
        <StatusBar hidden />
        <View style={styles.landscapeSide}>
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 16 }}>
            <Text style={styles.landscapeBack}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.lsVal, { color: '#E24B4A' }]}>{session.maxSpeed.toFixed(1)}</Text>
          <Text style={styles.lsLbl}>max km/h</Text>
          <Text style={[styles.lsVal, { color: '#378ADD' }]}>{session.avgSpeed.toFixed(1)}</Text>
          <Text style={styles.lsLbl}>avg km/h</Text>
          <View style={styles.divider} />
          <Text style={[styles.lsVal, { color: '#00E5FF' }]}>{session.distance.toFixed(2)}</Text>
          <Text style={styles.lsLbl}>km</Text>
          <Text style={styles.lsVal}>{formatDuration(session.duration)}</Text>
          <Text style={styles.lsLbl}>duration</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', paddingRight: 8 }}>
          {chartPoints.length >= 2 ? (
            <SpeedChart
              points={chartPoints}
              width={screenW - 90}
              height={screenH - 32}
            />
          ) : (
            <View style={styles.noData}><Text style={styles.noDataText}>No data</Text></View>
          )}
        </View>
      </View>
    );
  }

  // PORTRAIT
  const chartW = screenW - 48;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{formatDate(session.date)}</Text>
          <Text style={styles.headerSub}>{formatTimeOfDay(session.date)}</Text>
        </View>
        <TouchableOpacity onPress={onDelete}>
          <Text style={styles.deleteHeaderText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {(['chart', 'map'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'chart' ? '📊 Chart' : '🗺 Route'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'chart' && (
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={styles.detailScroll}
          ListHeaderComponent={
            <>
              {/* Summary bar */}
              <View style={styles.summaryBar}>
                <SummaryItem label="max" value={session.maxSpeed.toFixed(1)} unit="km/h" accent="#E24B4A" />
                <SummaryItem label="avg" value={session.avgSpeed.toFixed(1)} unit="km/h" accent="#378ADD" />
                <SummaryItem label="distance" value={session.distance.toFixed(2)} unit="km" accent="#00E5FF" />
                <SummaryItem label="duration" value={formatDuration(session.duration)} unit="" accent="#00FF88" />
              </View>

              <Text style={styles.chartHint}>Touch and drag to inspect · rotate for full screen</Text>

              <View style={styles.chartCard}>
                {chartPoints.length >= 2 ? (
                  <SpeedChart points={chartPoints} width={chartW} height={200} />
                ) : (
                  <View style={styles.noData}><Text style={styles.noDataText}>Not enough data</Text></View>
                )}
              </View>

              <View style={styles.statsGrid}>
                <StatCard label="DISTANCE"   value={session.distance.toFixed(2)}  unit="km"   accent="#00E5FF" />
                <StatCard label="MAX SPEED"  value={session.maxSpeed.toFixed(1)}  unit="km/h" accent="#E24B4A" />
                <StatCard label="AVG SPEED"  value={session.avgSpeed.toFixed(1)}  unit="km/h" accent="#378ADD" />
                <StatCard label="DURATION"   value={formatDuration(session.duration)} unit=""  accent="#00FF88" />
                <StatCard label="PULSES"     value={`${session.totalPulses}`}      unit="pcs"  accent="#FFD600" />
                <StatCard label="GPS POINTS" value={`${session.gpsTrack?.length ?? 0}`} unit="pcs" accent="#B5D4F4" />
              </View>
            </>
          }
        />
      )}

      {activeTab === 'map' && (
        <View style={{ flex: 1 }}>
          {!hasGps ? (
            <View style={styles.noGps}>
              <Text style={styles.noGpsIcon}>📍</Text>
              <Text style={styles.noGpsTitle}>No GPS data</Text>
              <Text style={styles.noGpsText}>No GPS route was recorded for this session.</Text>
            </View>
          ) : (
            <>
              <MapView style={{ flex: 1 }} region={mapRegion!} mapType="standard">
                <Polyline coordinates={coordinates} strokeColor="#E24B4A" strokeWidth={3} />
                <Marker coordinate={coordinates[0]} title="Start" pinColor="green" />
                <Marker coordinate={coordinates[coordinates.length - 1]} title="Finish" pinColor="red" />
              </MapView>
              <View style={styles.mapInfo}>
                <View style={styles.mapInfoItem}>
                  <View style={[styles.mapDot, { backgroundColor: '#00FF88' }]} />
                  <Text style={styles.mapInfoText}>Start</Text>
                </View>
                <Text style={styles.mapInfoDist}>{session.distance.toFixed(2)} km · {session.gpsTrack.length} pts</Text>
                <View style={styles.mapInfoItem}>
                  <View style={[styles.mapDot, { backgroundColor: '#E24B4A' }]} />
                  <Text style={styles.mapInfoText}>Finish</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function SummaryItem({ label, value, unit, accent }: { label: string; value: string; unit: string; accent: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryVal, { color: accent }]}>{value}</Text>
      {unit ? <Text style={styles.summaryUnit}>{unit}</Text> : null}
      <Text style={styles.summaryLbl}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatVal, { color: accent }]}>{value}</Text>
      <Text style={styles.miniStatLbl}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1A2040',
  },
  backBtn: { width: 40 },
  backBtnText: { color: '#00E5FF', fontSize: 32, lineHeight: 32 },
  headerTitle: { color: '#00E5FF', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  headerCenter: { alignItems: 'center' },
  headerSub: { color: '#4A5578', fontSize: 12, marginTop: 2 },
  deleteHeaderText: { color: '#E24B4A', fontSize: 13, width: 50, textAlign: 'right' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { fontSize: 48, opacity: 0.3 },
  emptyTitle: { color: '#E8EDF5', fontSize: 16, fontWeight: '600' },
  emptyText: { color: '#3A4560', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  listCount: { color: '#3A4560', fontSize: 11, marginBottom: 4, letterSpacing: 1 },
  card: {
    backgroundColor: '#0D1525', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1A2040', gap: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardDate: { color: '#E8EDF5', fontSize: 15, fontWeight: '600' },
  cardTime: { color: '#4A5578', fontSize: 12, marginTop: 2 },
  deleteBtnText: { color: '#3A4560', fontSize: 14, padding: 4 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gpsBadge: { backgroundColor: '#00FF8820', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  gpsBadgeText: { color: '#00FF88', fontSize: 10, fontWeight: '600' },
  cardArrow: { color: '#2A3050', fontSize: 11 },
  miniStat: { alignItems: 'center', gap: 2 },
  miniStatVal: { fontSize: 14, fontWeight: '700' },
  miniStatLbl: { color: '#3A4560', fontSize: 9, letterSpacing: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1A2040' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#00E5FF' },
  tabText: { color: '#4A5578', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#00E5FF' },
  detailScroll: { padding: 16, gap: 14, paddingBottom: 40 },
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#0D1525', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1A2040',
  },
  summaryItem: { alignItems: 'center', gap: 1 },
  summaryVal: { color: '#E8EDF5', fontSize: 19, fontWeight: '800' },
  summaryUnit: { color: '#4A5578', fontSize: 10 },
  summaryLbl: { color: '#3A4560', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  chartHint: { color: '#2A3050', fontSize: 10, textAlign: 'center', marginTop: -4 },
  chartCard: {
    backgroundColor: '#0D1525', borderRadius: 14,
    borderWidth: 1, borderColor: '#1A2040', overflow: 'hidden',
  },
  noData: { height: 200, alignItems: 'center', justifyContent: 'center' },
  noDataText: { color: '#2A3050', fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '30%', backgroundColor: '#0D1525',
    borderRadius: 12, padding: 14, borderTopWidth: 2, gap: 1,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statUnit: { color: '#4A5578', fontSize: 11 },
  statLabel: { color: '#3A4560', fontSize: 9, letterSpacing: 1.5, marginTop: 4 },
  mapInfo: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(10,14,26,0.85)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#1A2040',
  },
  mapInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapDot: { width: 10, height: 10, borderRadius: 5 },
  mapInfoText: { color: '#E8EDF5', fontSize: 12, fontWeight: '600' },
  mapInfoDist: { color: '#4A5578', fontSize: 11 },
  noGps: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  noGpsIcon: { fontSize: 48, opacity: 0.3 },
  noGpsTitle: { color: '#E8EDF5', fontSize: 16, fontWeight: '600' },
  noGpsText: { color: '#3A4560', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  landscapeContainer: {
    flex: 1, flexDirection: 'row', backgroundColor: '#0A0E1A',
    paddingHorizontal: 8, paddingVertical: 8,
  },
  landscapeSide: { width: 80, alignItems: 'center', justifyContent: 'center', gap: 2 },
  landscapeBack: { color: '#00E5FF', fontSize: 28 },
  lsVal: { color: '#E8EDF5', fontSize: 15, fontWeight: '700' },
  lsLbl: { color: '#3A4560', fontSize: 9, letterSpacing: 1 },
  divider: { width: 40, height: 1, backgroundColor: '#1A2040', marginVertical: 8 },
});