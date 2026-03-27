import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionPoint } from '../sessionStore';

export interface SavedSession {
  id: string;
  date: string;           // ISO string
  duration: number;       // másodperc
  distance: number;       // km
  maxSpeed: number;       // km/h
  avgSpeed: number;       // km/h
  totalPulses: number;
  points: SessionPoint[]; // chart adatok
}

const STORAGE_KEY = 'bike_sessions';

export const SessionDB = {

  // Összes session betöltése (legújabb elöl)
  getAll: async (): Promise<SavedSession[]> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const sessions: SavedSession[] = JSON.parse(raw);
      return sessions.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch {
      return [];
    }
  },

  // Session mentése
  save: async (session: SavedSession): Promise<void> => {
    try {
      const existing = await SessionDB.getAll();
      const updated = [session, ...existing];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Session mentési hiba:', e);
    }
  },

  // Session törlése ID alapján
  delete: async (id: string): Promise<void> => {
    try {
      const existing = await SessionDB.getAll();
      const filtered = existing.filter(s => s.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Session törlési hiba:', e);
    }
  },

  // Összes törlése
  deleteAll: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};