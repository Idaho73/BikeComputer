import { create } from 'zustand';
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import { SessionDB, SavedSession, GpsPoint } from './db/sessionDB';

export interface SessionPoint {
  t: number;
  spd: number;
}

interface SessionState {
  running: boolean;
  startTime: number | null;
  elapsed: number;
  points: SessionPoint[];
  gpsTrack: GpsPoint[];
  currentSpeed: number;
  maxSpeed: number;
  sessionDistance: number;
  sessionPulses: number;
  absDistance: number;
  absPulses: number;
  offsetDistance: number;
  offsetPulses: number;
  lastSavedId: string | null;
  gpsWatchId: number | null;

  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  tick: () => void;
  onSpeedData: (spd: number, dst: number, pls: number) => void;
  reset: () => void;
}

const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const useSessionStore = create<SessionState>()((set, get) => ({
  running: false,
  startTime: null,
  elapsed: 0,
  points: [],
  gpsTrack: [],
  currentSpeed: 0,
  maxSpeed: 0,
  sessionDistance: 0,
  sessionPulses: 0,
  absDistance: 0,
  absPulses: 0,
  offsetDistance: 0,
  offsetPulses: 0,
  lastSavedId: null,
  gpsWatchId: null,

  startSession: async () => {
    const { absDistance, absPulses } = get();
    const startTime = Date.now();

    set({
      running: true,
      startTime,
      elapsed: 0,
      points: [],
      gpsTrack: [],
      maxSpeed: 0,
      sessionDistance: 0,
      sessionPulses: 0,
      offsetDistance: absDistance,
      offsetPulses: absPulses,
      lastSavedId: null,
    });

    // GPS indítása
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    Geolocation.setRNConfiguration({ skipPermissionRequests: true });

    const watchId = Geolocation.watchPosition(
      (position) => {
        const { running, gpsTrack, startTime: st } = get();
        if (!running || !st) return;

        const t = Math.floor((Date.now() - st) / 1000);
        const newPoint: GpsPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          t,
        };

        // GPS pont csak ha legalább ~5 méter eltelt (szűrés)
        const last = gpsTrack[gpsTrack.length - 1];
        if (last) {
          const dLat = Math.abs(newPoint.lat - last.lat);
          const dLng = Math.abs(newPoint.lng - last.lng);
          // ~5 méter ~= 0.000045 fok
          if (dLat < 0.000045 && dLng < 0.000045) return;
        }

        set({ gpsTrack: [...gpsTrack, newPoint] });
      },
      (error) => console.warn('GPS hiba:', error.message),
      {
        enableHighAccuracy: true,
        distanceFilter: 5,       // minimum 5 méter elmozdulás
        interval: 3000,          // min 3 mp
        fastestInterval: 2000,
      }
    );

    set({ gpsWatchId: watchId });
  },

  stopSession: async () => {
    const {
      startTime, elapsed, points, gpsTrack, maxSpeed,
      sessionDistance, sessionPulses, gpsWatchId,
    } = get();

    // GPS leállítása
    if (gpsWatchId !== null) {
      Geolocation.clearWatch(gpsWatchId);
    }

    set({ running: false, gpsWatchId: null });
    if (!startTime || elapsed < 5) return;

    const movingPoints = points.filter(p => p.spd > 0);
    const avgSpeed = movingPoints.length > 0
      ? movingPoints.reduce((a, b) => a + b.spd, 0) / movingPoints.length : 0;

    const session: SavedSession = {
      id: `session_${Date.now()}`,
      date: new Date(startTime).toISOString(),
      duration: elapsed,
      distance: sessionDistance,
      maxSpeed,
      avgSpeed,
      totalPulses: sessionPulses,
      points,
      gpsTrack,
    };

    await SessionDB.save(session);
    set({ lastSavedId: session.id });
  },

  tick: () => {
    const { running, startTime, points, currentSpeed } = get();
    if (!running || !startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const newPoint: SessionPoint = { t: elapsed, spd: currentSpeed };
    const updated = [...points, newPoint];
    const trimmed = updated.length > 300 ? updated.slice(updated.length - 300) : updated;
    set({ elapsed, points: trimmed });
  },

  onSpeedData: (spd, dst, pls) => {
    const { maxSpeed, running, offsetDistance, offsetPulses } = get();
    const sessionDistance = Math.max(0, dst - offsetDistance);
    const sessionPulses   = Math.max(0, pls - offsetPulses);
    set({
      currentSpeed: spd,
      maxSpeed: running ? Math.max(maxSpeed, spd) : maxSpeed,
      absDistance: dst,
      absPulses: pls,
      ...(running ? { sessionDistance, sessionPulses } : {}),
    });
  },

  reset: () => {
    const { gpsWatchId } = get();
    if (gpsWatchId !== null) Geolocation.clearWatch(gpsWatchId);
    set({
      running: false,
      startTime: null,
      elapsed: 0,
      points: [],
      gpsTrack: [],
      currentSpeed: 0,
      maxSpeed: 0,
      sessionDistance: 0,
      sessionPulses: 0,
      absDistance: 0,
      absPulses: 0,
      offsetDistance: 0,
      offsetPulses: 0,
      lastSavedId: null,
      gpsWatchId: null,
    });
  },
}));