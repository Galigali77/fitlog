/**
 * 渐进超负荷建议引擎（纯函数）
 * 对应需求 FR-ANA-03 / 技术方案 5.1：
 * - 某动作连续 N 次（默认 2）训练达到目标次数上限 → 建议加重 +X kg；
 * - 连续未达到次数下限 → 提示维持或减重。
 * 加重幅度与判定次数均可配置（存 settings，FR-PLAN-07）。
 */

/**
 * 解析目标次数区间
 * @param {string|number} targetReps 如 "8-10"、"5"、"45秒"、"力竭"
 * @returns {{ bottom: number, top: number, isTime: boolean, isAmrap: boolean }}
 */
export function parseTargetReps(targetReps) {
  const s = String(targetReps ?? '').trim();
  if (!s) return { bottom: 0, top: 0, isTime: false, isAmrap: false };
  if (s.includes('力竭')) return { bottom: 0, top: 0, isTime: false, isAmrap: true };
  const isTime = s.includes('秒');
  const m = s.match(/(\d+)\s*[-–~]\s*(\d+)/);
  if (m) {
    // 反向区间防御（如 "10-8"）：交换保证 bottom <= top
    const [a, b] = [+m[1], +m[2]];
    return { bottom: Math.min(a, b), top: Math.max(a, b), isTime, isAmrap: false };
  }
  const n = parseInt(s, 10);
  return { bottom: n || 0, top: n || 0, isTime, isAmrap: false };
}

/**
 * 取某次训练中该动作「最好的一组」（正式组里次数最多者，用于判定达标）
 * @param {Array<{ weight: number, reps: number, type?: string }>} sets
 * @returns {{ weight: number, reps: number } | null}
 */
export function topSet(sets) {
  const work = (sets ?? []).filter((s) => s.type !== 'warmup');
  if (work.length === 0) return null;
  return work.reduce((best, s) => ((s.reps || 0) > (best.reps || 0) ? s : best), work[0]);
}

/**
 * @typedef {Object} OverloadSuggestion
 * @property {'increase'|'decrease'} kind
 * @property {number} currentWeight
 * @property {number} suggestedWeight
 * @property {string} reason
 */

/**
 * 生成单个动作的超负荷建议
 * @param {Object} args
 * @param {Array<Array<{ weight: number, reps: number, type?: string }>>} args.recentSessions
 *        最近几次训练中该动作的组列表，按时间从新到旧排列
 * @param {string|number} args.targetReps   计划中的目标次数区间
 * @param {number} [args.increment]         加重幅度 kg（默认 2.5）
 * @param {number} [args.capHits]           判定次数 N（默认 2）
 * @returns {OverloadSuggestion | null}
 */
export function suggestOverload({ recentSessions, targetReps, increment = 2.5, capHits = 2 }) {
  const { bottom, top, isAmrap } = parseTargetReps(targetReps);
  if (isAmrap || top <= 0) return null;
  const recent = (recentSessions ?? []).slice(0, capHits);
  if (recent.length < capHits) return null;
  const tops = recent.map(topSet);
  if (tops.some((t) => !t)) return null;
  const currentWeight = tops[0].weight || 0;
  // 连续 N 次达到次数上限 → 加重
  if (tops.every((t) => (t.reps || 0) >= top)) {
    return {
      kind: 'increase',
      currentWeight,
      suggestedWeight: currentWeight + increment,
      reason: `连续 ${capHits} 次达到次数上限 ${top} 次`,
    };
  }
  // 连续 N 次未达次数下限 → 减重（不低于 0）
  if (bottom > 0 && tops.every((t) => (t.reps || 0) < bottom)) {
    return {
      kind: 'decrease',
      currentWeight,
      suggestedWeight: Math.max(0, currentWeight - increment),
      reason: `连续 ${capHits} 次未达次数下限 ${bottom} 次，建议减重夯实动作`,
    };
  }
  return null;
}
