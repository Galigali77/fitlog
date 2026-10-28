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
  // 持久存储保护状态：null=查询中，true=浏览器承诺不自动清理 IndexedDB
  const [storagePersisted, setStoragePersisted] = useState(null);

  // 首次启动写入种子计划（幂等）
  useEffect(() => {
    seedIfEmpty(import.meta.env.BASE_URL).finally(() => setReady(true));
  }, []);

  // 申请持久存储（FR-DATA-01 加固）：已持久化则直接标记；否则发起申请。
  // 浏览器可自行拒绝（如存储紧张），失败不阻断应用，仅在设置页如实展示状态。
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!navigator.storage?.persist) {
          if (alive) setStoragePersisted(false); // 老浏览器无此 API
          return;
        }
        if (await navigator.storage.persisted()) {
          if (alive) setStoragePersisted(true);
          return;
        }
        const granted = await navigator.storage.persist();
        if (alive) setStoragePersisted(Boolean(granted));
      } catch {
        if (alive) setStoragePersisted(false);
      }
    })();
    return () => {
      alive = false;
    };
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
      storagePersisted,
      /** 保存一次完成的训练；轮换游标推进已收敛进 repository.saveWorkout 的同一事务（FR-PLAN-03） */
      saveWorkout: (payload) => repoSaveWorkout(payload),
      /** 保存一组身材记录（Blob 直存 IndexedDB） */
      addBodyPhotos: repoAddBodyPhotos,
      /** 更新设置项 */
      updateSetting: setSetting,
    }),
    [ready, workouts, routines, bodyPhotos, settings, storagePersisted]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

// 供仓库层以外的只读场景直接订阅（如动作库页合并自定义动作）
export { db };
