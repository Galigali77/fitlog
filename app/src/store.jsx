import { createContext, useContext, useState } from 'react';
import { SAMPLE_BODY_PHOTOS, SAMPLE_WORKOUTS } from '@/data/history';

const Ctx = createContext({
  workouts: [],
  addWorkout: () => {},
  bodyPhotos: [],
  addBodyPhotos: () => {},
});

/** @param {{ children: import('react').ReactNode }} props */
export function StoreProvider({ children }) {
  const [workouts, setWorkouts] = useState(SAMPLE_WORKOUTS);
  const [bodyPhotos, setBodyPhotos] = useState(SAMPLE_BODY_PHOTOS);
  const addWorkout = (w) => setWorkouts((prev) => [w, ...prev]);
  const addBodyPhotos = (p) => setBodyPhotos((prev) => [p, ...prev]);
  return <Ctx.Provider value={{ workouts, addWorkout, bodyPhotos, addBodyPhotos }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
