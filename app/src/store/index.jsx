/**
 * 全局 Store：React Context + Dexie useLiveQuery（阶段一第 2 项）
 * 数据变更自动驱动 UI 重渲染；页面不直接操作 IndexedDB。
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  addBodyPhotos as repoAddBodyPhotos,
  DEFAULT_SETTINGS,
  getAllSettings,
  listBodyPhotos,
  listRoutines,
  listWorkouts,
  saveWorkout as repoSaveWorkout,
  setSetting,
} from '@/db/repository';
import { seedIfEmpty } from '@/db/seed';

const Ctx = createContext(null);

/** 稳定的空数组引用（useLiveQuery 加载中的占位，防止下游 useMemo 反复失效） */
const EMPTY_LIST = [];

/** @param {{ children: import('react').ReactNode }} props */
export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);

  // 首次启动写入种子计划（幂等）
  useEffect(() => {
    seedIfEmpty(import.meta.env.BASE_URL).finally(() => setReady(true));
  }, []);

  // useLiveQuery：订阅 Dexie 表，数据变更自动刷新（undefined = 加载中）
  // 空数组用模块级常量，避免每次渲染产生新引用导致下游 useMemo 失效
  const workouts = useLiveQuery(() => listWorkouts(), []) ?? EMPTY_LIST;
  const routines = useLiveQuery(() => listRoutines(), []) ?? EMPTY_LIST;
  const bodyPhotos = useLiveQuery(() => listBodyPhotos(), []) ?? EMPTY_LIST;
  const settings = useLiveQuery(() => getAllSettings(), []) ?? DEFAULT_SETTINGS;

  const value = useMemo(
    () => ({
      ready,
      workouts,
      routines,
      bodyPhotos,
      settings,
      /** 保存一次完成的训练；按计划完成的轮换训练推进全局轮换游标（FR-PLAN-03） */
      saveWorkout: async (payload) => {
        const id = await repoSaveWorkout(payload);
        if (payload.routineId) {
          const r = routines.find((x) => x.id === payload.routineId);
          if (r?.mode === 'rotation') {
            const cursor = Number(settings.rotationCursor ?? 0);
            await setSetting('rotationCursor', cursor + 1);
          }
        }
        return id;
      },
      /** 保存一组身材记录（Blob 直存 IndexedDB） */
      addBodyPhotos: repoAddBodyPhotos,
      /** 更新设置项 */
      updateSetting: setSetting,
    }),
    [ready, workouts, routines, bodyPhotos, settings]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

// 供仓库层以外的只读场景直接订阅（如动作库页合并自定义动作）
export { db };
