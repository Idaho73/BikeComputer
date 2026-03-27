import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  FlatList, Dimensions, Alert, RefreshControl,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SessionDB, SavedSession } from '../db/sessionDB';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

const SCREEN_WIDTH = Dimensions.get('window').width;
type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const [sessions, setSessions]     = useState<SavedSession[]>([]);
  const [selected, setSelected]     = useState<SavedSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await SessionDB.getAll();
    setSessions(data);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Session törlése', 'Biztosan törlöd ezt a sessiont?', [
      { text: 'Mégse', style: 'cancel' },
      {
        text: 'Törlés', style: 'destructive',
        onPress: async () => {
          await SessionDB.delete(id);
          if (selected?.id === id) setSelected(null);
          await load();
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('hu-HU', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatTimeOfDay = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  // Detail nézet
  if (selected) {
    return (
      <DetailView
        session={selected}
        onBack={() => setSelected(null)}
        onDelete={() => handleDelete(selected.id)}
        formatDate={formatDate}
        formatTime={formatTime}
        formatTimeOfDay={formatTimeOfDay}
      />
    );
  }

  // Lista nézet
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SESSION ELŐZMÉNYEK</Text>
        <View style={{ width: 40 }} />
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚴</Text>
          <Text style={styles.emptyTitle}>Még nincs mentett session</Text>
          <Text style={styles.emptyText}>
            Indíts el egy sessiont és leállítás után automatikusan mentődik.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
          }
          ListHeaderComponent={
            <Text style={styles.listCount}>{sessions.length} mentett session</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.cardTime}>{formatTimeOfDay(item.date)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardStats}>
                <MiniStat label="Távolság"  value={`${item.distance.toFixed(2)} km`}  accent="#00E5FF" />
                <MiniStat label="Max seb."  value={`${item.maxSpeed.toFixed(1)} km/h`} accent="#E24B4A" />
                <MiniStat label="Átl. seb." value={`${item.avgSpeed.toFixed(1)} km/h`} accent="#378ADD" />
                <MiniStat label="Idő"       value={formatTime(item.duration)}           accent="#00FF88" />
              </View>

              <View style={styles.cardArrow}>
                <Text style={styles.cardArrowText}>Részletek →</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// Detail komponens
function DetailView({ session, onBack, onDelete, formatDate, formatTime, formatTimeOfDay }: {
  session: SavedSession;
  onBack: () => void;
  onDelete: () => void;
  formatDate: (s: string) => string;
  formatTime: (n: number) => string;
  formatTimeOfDay: (s: string) => string;
}) {
  // Figyeljük a képernyő méretét/orientációját
  const [dims, setDims] = useState(Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => sub.remove();
  }, []);

  const isLandscape = dims.width > dims.height;

  const chartData = useMemo(() => {
    if (session.points.length < 2) return null;
    const data = session.points.map(p => parseFloat(p.spd.toFixed(1)));
    const step = Math.max(1, Math.floor(session.points.length / 5));
    const labels = session.points.map((p, i) => {
      if (i % step !== 0 && i !== session.points.length - 1) return '';
      const m = Math.floor(p.t / 60);
      const s = p.t % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    });
    return { labels, datasets: [{ data }] };
  }, [session, isLandscape]);

  // FULLSCREEN LANDSCAPE GRAFIKON
  if (isLandscape) {
    return (
      <View style={styles.landscapeChartContainer}>
        <StatusBar hidden />
        <View style={styles.landscapeChartHeader}>
          <Text style={styles.landscapeChartTitle}>{formatDate(session.date)} - Sebesség profil</Text>
          <TouchableOpacity onPress={() => Alert.alert("Tipp", "Forrasd vissza a telefont a statisztikákhoz!")}>
             <Text style={{color: '#4A5578', fontSize: 12}}>Visszafordításhoz forgasd el ↻</Text>
          </TouchableOpacity>
        </View>
        
        {chartData && (
          <LineChart
            data={chartData}
            width={dims.width - 20}
            height={dims.height - 80}
            withDots={false}
            withInnerLines={true}
            chartConfig={chartConfigLandscape}
            bezier
            style={{ borderRadius: 16 }}
            fromZero
          />
        )}
      </View>
    );
  }
  

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
        <TouchableOpacity onPress={onDelete} style={styles.deleteHeaderBtn}>
          <Text style={styles.deleteHeaderText}>Töröl</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={styles.detailScroll}
        ListHeaderComponent={
          <>
            {/* Chart */}
            {chartData ? (
              <View style={styles.chartCard}>
                <Text style={styles.sectionLabel}>SEBESSÉG GRAFIKON</Text>
                <LineChart
                  data={chartData}
                  width={SCREEN_WIDTH - 64}
                  height={180}
                  withDots={false}
                  withInnerLines={true}
                  withOuterLines={false}
                  withShadow={true}
                  chartConfig={{
                    backgroundColor: '#0D1525',
                    backgroundGradientFrom: '#0D1525',
                    backgroundGradientTo: '#0D1525',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(226, 75, 74, ${opacity})`,
                    labelColor: () => 'rgba(74, 85, 120, 0.9)',
                    propsForDots: { r: '0' },
                    propsForBackgroundLines: {
                      stroke: 'rgba(255,255,255,0.05)',
                      strokeDasharray: '',
                    },
                    strokeWidth: 2,
                    fillShadowGradientFrom: '#E24B4A',
                    fillShadowGradientTo: '#0D1525',
                    fillShadowGradientFromOpacity: 0.3,
                    fillShadowGradientToOpacity: 0,
                  }}
                  bezier
                  style={{ marginHorizontal: -8, borderRadius: 8 }}
                  fromZero
                  segments={3}
                />
              </View>
            ) : (
              <View style={styles.noChart}>
                <Text style={styles.noChartText}>Nincs elegendő adat a grafikonhoz</Text>
              </View>
            )}

            {/* Stat rácsok */}
            <View style={styles.statsGrid}>
              <StatCard label="TÁVOLSÁG"     value={`${session.distance.toFixed(2)}`}  unit="km"   accent="#00E5FF" />
              <StatCard label="MAX SEBESSÉG" value={`${session.maxSpeed.toFixed(1)}`}  unit="km/h" accent="#E24B4A" />
              <StatCard label="ÁTL. SEBESSÉG" value={`${session.avgSpeed.toFixed(1)}`} unit="km/h" accent="#378ADD" />
              <StatCard label="IDŐTARTAM"    value={formatTime(session.duration)}       unit=""     accent="#00FF88" />
              <StatCard label="FORDULATOK"   value={`${session.totalPulses}`}           unit="db"   accent="#FFD600" />
              <StatCard label="ADATPONTOK"   value={`${session.points.length}`}         unit="mp"   accent="#B5D4F4" />
            </View>
          </>
        }
      />
    </View>
  );
}
const chartConfigSmall = {
  backgroundColor: '#0D1525',
  backgroundGradientFrom: '#0D1525',
  backgroundGradientTo: '#161B33', // Enyhe átmenet a mélységért
  decimalPlaces: 1, 
  color: (opacity = 1) => `rgba(226, 75, 74, ${opacity})`, // Fő vonal színe (pirosas)
  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`, // Slate-szürke feliratok
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: "0",
  },
  propsForBackgroundLines: {
    stroke: "#1E293B", // Sötétebb, elegánsabb rácsvonalak
    strokeDasharray: "5", // Szaggatott vonal a modernebb hatásért
    strokeWidth: 1,
  },
  strokeWidth: 3, // Vastagabb, határozottabb görbe
  fillShadowGradientFrom: '#E24B4A',
  fillShadowGradientTo: '#0D1525',
  fillShadowGradientFromOpacity: 0.35, // Erősebb kitöltés az elején
  fillShadowGradientToOpacity: 0,
  useShadowColorFromDataset: false,
};

const chartConfigLandscape = {
  ...chartConfigSmall,
  backgroundGradientFrom: '#0A0E1A',
  backgroundGradientTo: '#1A1F35',
  propsForBackgroundLines: {
    stroke: "rgba(255, 255, 255, 0.08)", // Fekvő módban kicsit világosabb rács
    strokeDasharray: "", // Itt lehet folytonos a precízebb leolvasáshoz
  },
  // Landscape módban több hely van, több segédvonalat bír el
  count: 5, 
};

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatVal, { color: accent }]}>{value}</Text>
      <Text style={styles.miniStatLbl}>{label}</Text>
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
  headerTitle: { color: '#00E5FF', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  headerCenter: { alignItems: 'center' },
  headerSub: { color: '#4A5578', fontSize: 12, marginTop: 2 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12,
  },
  emptyIcon: { fontSize: 48, opacity: 0.3 },
  emptyTitle: { color: '#E8EDF5', fontSize: 16, fontWeight: '600' },
  emptyText: { color: '#3A4560', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16, gap: 12, paddingBottom: 40 },
  listCount: { color: '#3A4560', fontSize: 11, marginBottom: 4, letterSpacing: 1 },

  card: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2040',
    gap: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardDate: { color: '#E8EDF5', fontSize: 15, fontWeight: '600' },
  cardTime: { color: '#4A5578', fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: '#3A4560', fontSize: 14 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  cardArrow: { alignItems: 'flex-end' },
  cardArrowText: { color: '#2A3050', fontSize: 11 },

  miniStat: { alignItems: 'center', gap: 2 },
  miniStatVal: { fontSize: 14, fontWeight: '700' },
  miniStatLbl: { color: '#3A4560', fontSize: 9, letterSpacing: 1 },

  detailScroll: { padding: 20, gap: 14, paddingBottom: 40 },
  sectionLabel: { color: '#4A5578', fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 10 },

  chartCard: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2040',
    overflow: 'hidden',
  },
  noChart: {
    backgroundColor: '#0D1525',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A2040',
  },
  noChartText: { color: '#3A4560', fontSize: 13 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '30%',
    backgroundColor: '#0D1525',
    borderRadius: 12, padding: 14,
    borderTopWidth: 2, gap: 1,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statUnit: { color: '#4A5578', fontSize: 11 },
  statLabel: { color: '#3A4560', fontSize: 9, letterSpacing: 1.5, marginTop: 4 },

  deleteHeaderBtn: { width: 60, alignItems: 'flex-end' },
  deleteHeaderText: { color: '#E24B4A', fontSize: 13 },

  landscapeChartContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeChartHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  landscapeChartTitle: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '800',
  },
});