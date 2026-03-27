import { create } from 'zustand';
import { SavedSession, SessionDB } from './db/sessionDB';

export interface SessionPoint {
  t: number;
  spd: number;
}

interface SessionState {
  running: boolean;
  startTime: number | null;
  elapsed: number;
  points: SessionPoint[];
  currentSpeed: number;
  maxSpeed: number;
  // Távolság és pulzus: session-relatív (nullázódik session indításkor)
  sessionDistance: number;
  sessionPulses: number;
  // ESP által küldött abszolút értékek
  absDistance: number;
  absPulses: number;
  // Abszolút értékek session indításakor (offset)
  offsetDistance: number;
  offsetPulses: number;
  lastSavedId: string | null;

  startSession: () => void;
  stopSession: () => Promise<void>;
  tick: () => void;
  onSpeedData: (spd: number, dst: number, pls: number) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  running: false,
  startTime: null,
  elapsed: 0,
  points: [],
  currentSpeed: 0,
  maxSpeed: 0,
  sessionDistance: 0,
  sessionPulses: 0,
  absDistance: 0,
  absPulses: 0,
  offsetDistance: 0,
  offsetPulses: 0,
  lastSavedId: null,

  startSession: () => {
    const { absDistance, absPulses } = get();
    set({
      running: true,
      startTime: Date.now(),
      elapsed: 0,
      points: [],
      maxSpeed: 0,
      sessionDistance: 0,
      sessionPulses: 0,
      // Eltároljuk az aktuális abszolút értékeket offsetként
      offsetDistance: absDistance,
      offsetPulses: absPulses,
      lastSavedId: null,
    });
  },

  stopSession: async () => {
    const { startTime, elapsed, points, maxSpeed, sessionDistance, sessionPulses } = get();
    set({ running: false });
    if (!startTime || elapsed < 5) return;

    const movingPoints = points.filter(p => p.spd > 0);
    const avgSpeed = movingPoints.length > 0
      ? movingPoints.reduce((a, b) => a + b.spd, 0) / movingPoints.length
      : 0;

    const session: SavedSession = {
      id: `session_${Date.now()}`,
      date: new Date(startTime).toISOString(),
      duration: elapsed,
      distance: sessionDistance,
      maxSpeed,
      avgSpeed,
      totalPulses: sessionPulses,
      points,
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

  reset: () => set({
    running: false,
    startTime: null,
    elapsed: 0,
    points: [],
    currentSpeed: 0,
    maxSpeed: 0,
    sessionDistance: 0,
    sessionPulses: 0,
    absDistance: 0,
    absPulses: 0,
    offsetDistance: 0,
    offsetPulses: 0,
    lastSavedId: null,
  }),
}));