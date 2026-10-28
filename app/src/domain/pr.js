/**
 * PR（个人纪录）检测（纯函数）
 * 对应需求 FR-LOG-05：当某动作的重量或单次容量超过历史最佳时触发「新纪录」提示。
 */

import { setVolume } from './volume';

/**
 * 判断一组数据是否打破历史纪录
 * 规则：该组容量（weight × reps）大于历史所有组的最大容量即为 PR；
 * 重量本身创新高（哪怕容量没超）也算 PR——大重量低次数同样是进步。
 * @param {{ weight: number, reps: number }} set        刚完成的组
 * @param {Array<{ weight: number, reps: number }>} historySets 该动作历史所有组（不含本次）
 * @returns {boolean}
 */
export function isNewPR(set, historySets) {
  const v = setVolume(set);
  if (v <= 0) return false;
  const history = historySets ?? [];
  // 没有任何历史有效组时不算 PR：首次训练缺乏比较基准，每组都报 PR 会淹没提示
  if (history.length === 0) return false;
  const bestVol = history.reduce((m, s) => Math.max(m, setVolume(s)), 0);
  const bestWeight = history.reduce((m, s) => Math.max(m, s.weight || 0), 0);
  return v > bestVol || set.weight > bestWeight;
}

/**
 * 在一次训练内做 PR 检测：同一动作只提示一次（对应「同一次训练内同一动作只提示一次」）
 * @param {string} exerciseName
 * @param {string[]} alreadyNotified  本次训练已提示过的动作名
 * @returns {boolean} 是否需要弹出提示
 */
export const shouldNotifyPR = (exerciseName, alreadyNotified) =>
  !(alreadyNotified ?? []).includes(exerciseName);
