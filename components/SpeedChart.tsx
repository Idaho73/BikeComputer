import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_POINTS = 300;      // 5 perc × 60 másodperc = 300 pont
const INTERVAL_MS = 1000;    // 1 másodpercenként egy pont

interface SpeedChartProps {
  currentSpeed: number;
}

export default function SpeedChart({ currentSpeed }: SpeedChartProps) {
  const [history, setHistory] = useState<number[]>(Array(MAX_POINTS).fill(0));
  const maxSpeed = Math.max(...history);
  const avgSpeed = history.filter(v => v > 0).length > 0
    ? history.filter(v => v > 0).reduce((a, b) => a + b, 0) / history.filter(v => v > 0).length
    : 0;

  useEffect(() => {
    setHistory(prev => {
      const updated = [...prev, currentSpeed];
      if (updated.length > MAX_POINTS) updated.shift();
      return updated;
    });
  }, [currentSpeed]);

  // Chart csak minden 10. pontot mutat labelként (memória és teljesítmény)
  const visibleLabels = history.map((_, i) => {
    const secsAgo = MAX_POINTS - i;
    if (secsAgo === MAX_POINTS) return '-5:00';
    if (secsAgo === 240)        return '-4:00';
    if (secsAgo === 180)        return '-3:00';
    if (secsAgo === 120)        return '-2:00';
    if (secsAgo === 60)         return '-1:00';
    if (secsAgo === 1)          return 'most';
    return '';
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionLabel}>SEBESSÉG · UTOLSÓ 5 PERC</Text>
          <View style={styles.currentRow}>
            <Text style={styles.currentValue}>{currentSpeed.toFixed(1)}</Text>
            <Text style={styles.currentUnit}>km/h</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>MAX</Text>
            <Text style={[styles.statValue, { color: '#E24B4A' }]}>{maxSpeed.toFixed(1)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>ÁTL.</Text>
            <Text style={[styles.statValue, { color: '#378ADD' }]}>{avgSpeed.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      {/* Grafikon */}
      <LineChart
        data={{
          labels: visibleLabels,
          datasets: [{ data: history.length > 0 ? history : [0] }],
        }}
        width={SCREEN_WIDTH - 32}
        height={160}
        withDots={false}
        withInnerLines={true}
        withOuterLines={false}
        withHorizontalLabels={true}
        withVerticalLabels={true}
        withShadow={true}
        chartConfig={{
          backgroundColor: '#0D1525',
          backgroundGradientFrom: '#0D1525',
          backgroundGradientTo: '#0D1525',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(226, 75, 74, ${opacity})`,
          labelColor: () => 'rgba(74, 85, 120, 0.8)',
          style: { borderRadius: 12 },
          propsForDots: { r: '0' },
          propsForBackgroundLines: {
            stroke: 'rgba(255,255,255,0.05)',
            strokeDasharray: '',
          },
          strokeWidth: 2,
          fillShadowGradientFrom: '#E24B4A',
          fillShadowGradientTo: '#0D1525',
          fillShadowGradientFromOpacity: 0.35,
          fillShadowGradientToOpacity: 0,
        }}
        bezier
        style={styles.chart}
        yAxisSuffix=""
        yAxisInterval={20}
        segments={3}
        fromZero
      />

      {/* Idő tengelye */}
      <View style={styles.timeAxis}>
        <Text style={styles.timeLabel}>–5:00</Text>
        <Text style={styles.timeLabel}>–4:00</Text>
        <Text style={styles.timeLabel}>–3:00</Text>
        <Text style={styles.timeLabel}>–2:00</Text>
        <Text style={styles.timeLabel}>–1:00</Text>
        <Text style={styles.timeLabel}>most</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D1525',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1A2040',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#4A5578',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  currentValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  currentUnit: {
    color: '#4A5578',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
  },
  stat: {
    alignItems: 'flex-end',
  },
  statLabel: {
    color: '#4A5578',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  chart: {
    marginHorizontal: -8,
    borderRadius: 8,
  },
  timeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  timeLabel: {
    color: '#2A3050',
    fontSize: 9,
  },
});