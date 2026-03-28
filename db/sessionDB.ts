import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionPoint } from '../sessionStore';

export interface GpsPoint {
  lat: number;
  lng: number;
  t: number; // másodperc a session kezdetétől
}

export interface SavedSession {
  id: string;
  date: string;
  duration: number;
  distance: number;
  maxSpeed: number;
  avgSpeed: number;
  totalPulses: number;
  points: SessionPoint[];
  gpsTrack: GpsPoint[];
}

const STORAGE_KEY = 'bike_sessions';

export const SessionDB = {
  getAll: async (): Promise<SavedSession[]> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const sessions: SavedSession[] = JSON.parse(raw);
      return sessions.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch { return []; }
  },

  save: async (session: SavedSession): Promise<void> => {
    try {
      const existing = await SessionDB.getAll();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...existing]));
    } catch (e) { console.error('Session mentési hiba:', e); }
  },

  delete: async (id: string): Promise<void> => {
    try {
      const existing = await SessionDB.getAll();
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(existing.filter(s => s.id !== id))
      );
    } catch (e) { console.error('Session törlési hiba:', e); }
  },

  deleteAll: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};