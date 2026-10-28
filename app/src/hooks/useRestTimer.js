/**
 * 组间休息计时器 Hook（技术方案 5.3，阶段三加固）
 * 状态机：idle → running → done。
 * 读秒循环优先跑在 Web Worker 里（后台标签页中 Worker 节流比主线程宽松），
 * 剩余时间始终按 endAt 与 Date.now() 的差值计算，页面冻结再恢复读秒仍准确。
 * Worker 不可用的环境（如测试）自动降级为主线程 setInterval。
 * 结束时震动 + 闪屏提醒（FR-LOG-04）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {number} defaultSeconds 默认休息秒数（来自设置项，15–900）
 */
export function useRestTimer(defaultSeconds = 90) {
  const [left, setLeft] = useState(0); // 剩余秒数，0 = idle
  const [flash, setFlash] = useState(false); // 到时闪屏标记
  const endAtRef = useRef(0); // 结束时刻（epoch ms），降级模式读秒靠它
  const workerRef = useRef(null); // Worker 实例，null 表示降级主线程
  const alertedRef = useRef(false); // 到时提醒只触发一次

  // 组件挂载时创建 Worker；创建失败（不支持/测试环境）则保持 null 走降级
  useEffect(() => {
    try {
      const w = new Worker(new URL('../workers/restTimer.worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => setLeft(e.data.left);
      workerRef.current = w;
      return () => {
        w.terminate();
        workerRef.current = null;
      };
    } catch {
      return undefined; // 降级模式无需清理
    }
  }, []);

  // 到时提醒：震动（支持的设备）+ 闪屏
  useEffect(() => {
    if (left === 0 && endAtRef.current > 0 && !alertedRef.current && Date.now() >= endAtRef.current) {
      alertedRef.current = true;
      try {
        navigator.vibrate?.(200);
      } catch {
        /* 不支持震动的环境静默降级 */
      }
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 600);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [left]);

  // 降级模式：主线程 setInterval 读秒（250ms 校准，后台恢复后立即补齐）
  useEffect(() => {
    if (workerRef.current || left <= 0) return undefined;
    const tick = window.setInterval(() => {
      // 与 Worker 一致用 ceil：left 首次归零即真正到点，保证上面的到时提醒一定执行
      const l = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) window.clearInterval(tick); // 到点即停
    }, 250);
    return () => window.clearInterval(tick);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- 仅在启动/停止时重建

  /** 启动（或重置）计时器 @param {number} [seconds] */
  const start = useCallback(
    (seconds) => {
      const s = seconds ?? defaultSeconds;
      endAtRef.current = Date.now() + s * 1000;
      alertedRef.current = false;
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'start', endAt: endAtRef.current });
      }
      setLeft(s);
    },
    [defaultSeconds]
  );

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: 'stop' });
    setLeft(0);
  }, []);

  return { left, running: left > 0, flash, start, stop };
}
