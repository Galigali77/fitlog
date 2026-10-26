/**
 * 容量与 e1RM 计算（纯函数，domain 层，无 UI 依赖）
 * 对应需求 FR-ANA / 技术方案 5.x；是 Vitest 的重点覆盖对象。
 */

/**
 * 单组容量 = 重量 × 次数（自重动作为 0，符合直觉：不计入负重容量）
 * @param {{ weight: number, reps: number }} set
 * @returns {number}
 */
export const setVolume = (set) => (set.weight || 0) * (set.reps || 0);

/**
 * 一次训练的总容量
 * @param {Array<{ sets: Array<{ weight: number, reps: number, done?: boolean }> }>} exercises
 * @param {{ onlyDone?: boolean }} [opts] 只统计已完成组（记录页实时显示用）
 * @returns {number}
 */
export function workoutVolume(exercises, { onlyDone = false } = {}) {
  return (exercises ?? []).reduce(
    (sum, ex) => sum + (ex.sets ?? []).reduce((s, x) => s + (!onlyDone || x.done ? setVolume(x) : 0), 0),
    0
  );
}

/**
 * 估算单次最大重量（Epley 公式：重量 × (1 + 次数/30)）
 * @param {number} weight
 * @param {number} reps
 * @returns {number}
 */
export const e1rm = (weight, reps) => (reps > 1 ? weight * (1 + reps / 30) : weight);

/**
 * 一组历史组数据中的最佳 e1RM
 * @param {Array<{ weight: number, reps: number }>} sets
 * @returns {number}
 */
export function bestE1rm(sets) {
  return (sets ?? []).reduce((best, s) => Math.max(best, e1rm(s.weight || 0, s.reps || 0)), 0);
}
