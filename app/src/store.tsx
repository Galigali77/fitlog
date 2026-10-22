import { createContext, useContext, useState, type ReactNode } from 'react';
import type { BodyPhoto, Workout } from '@/types';
import { SAMPLE_BODY_PHOTOS, SAMPLE_WORKOUTS } from '@/data/history';

interface Store {
  workouts: Workout[];
  addWorkout: (w: Workout) => void;
  bodyPhotos: BodyPhoto[];
  addBodyPhotos: (p: BodyPhoto) => void;
}

const Ctx = createContext<Store>({
  workouts: [],
  addWorkout: () => {},
  bodyPhotos: [],
  addBodyPhotos: () => {},
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>(SAMPLE_WORKOUTS);
  const [bodyPhotos, setBodyPhotos] = useState<BodyPhoto[]>(SAMPLE_BODY_PHOTOS);
  const addWorkout = (w: Workout) => setWorkouts((prev) => [w, ...prev]);
  const addBodyPhotos = (p: BodyPhoto) => setBodyPhotos((prev) => [p, ...prev]);
  return <Ctx.Provider value={{ workouts, addWorkout, bodyPhotos, addBodyPhotos }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
