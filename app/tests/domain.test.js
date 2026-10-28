/**
 * domain 纯函数单元测试（阶段三：验收标准第 3 条）
 * 覆盖：渐进超负荷引擎（overlord.js）、容量/e1RM（volume.js）、PR 检测（pr.js）
 * 运行：npm run test（vitest run）
 */
import { describe, it, expect } from 'vitest';
import { parseTargetReps, topSet, suggestOverload } from '../src/domain/overload';
import { setVolume, workoutVolume, e1rm, bestE1rm } from '../src/domain/volume';
import { isNewPR, shouldNotifyPR } from '../src/domain/pr';

describe('parseTargetReps 目标次数解析', () => {
  it('解析区间 "8-10"', () => {
    expect(parseTargetReps('8-10')).toEqual({ bottom: 8, top: 10, isTime: false, isAmrap: false });
  });
  it('解析单值 "5"', () => {
    expect(parseTargetReps('5')).toEqual({ bottom: 5, top: 5, isTime: false, isAmrap: false });
  });
  it('识别计时动作 "45秒"', () => {
    expect(parseTargetReps('45秒')).toEqual({ bottom: 45, top: 45, isTime: true, isAmrap: false });
  });
  it('识别力竭动作', () => {
    expect(parseTargetReps('力竭')).toEqual({ bottom: 0, top: 0, isTime: false, isAmrap: true });
  });
  it('空值安全', () => {
    expect(parseTargetReps(undefined).top).toBe(0);
    expect(parseTargetReps('').top).toBe(0);
  });
  it('反向区间 "10-8" 自动交换为 bottom<=top', () => {
    expect(parseTargetReps('10-8')).toEqual({ bottom: 8, top: 10, isTime: false, isAmrap: false });
  });
});

describe('topSet 取最好一组', () => {
  it('取正式组中次数最多者，忽略热身组', () => {
    const sets = [
      { weight: 20, reps: 15, type: 'warmup' },
      { weight: 60, reps: 8 },
      { weight: 60, reps: 10 },
    ];
    expect(topSet(sets)).toEqual({ weight: 60, reps: 10 });
  });
  it('空列表返回 null', () => {
    expect(topSet([])).toBeNull();
    expect(topSet([{ weight: 20, reps: 15, type: 'warmup' }])).toBeNull();
  });
});

describe('suggestOverload 渐进超负荷建议（验收第 3 条）', () => {
  const s = (weight, reps) => [{ weight, reps }]; // 构造一次训练的单组

  it('连续 2 次达到次数上限 → 建议加重 +2.5kg', () => {
    const r = suggestOverload({
      recentSessions: [s(100, 10), s(100, 12)],
      targetReps: '8-10',
      increment: 2.5,
      capHits: 2,
    });
    expect(r).toMatchObject({ kind: 'increase', currentWeight: 100, suggestedWeight: 102.5 });
  });

  it('连续 2 次未达次数下限 → 建议减重', () => {
    const r = suggestOverload({
      recentSessions: [s(100, 5), s(100, 6)],
      targetReps: '8-10',
      increment: 2.5,
      capHits: 2,
    });
    expect(r).toMatchObject({ kind: 'decrease', suggestedWeight: 97.5 });
  });

  it('减重不低于 0', () => {
    const r = suggestOverload({
      recentSessions: [s(2, 3), s(2, 4)],
      targetReps: '8-10',
      increment: 2.5,
      capHits: 2,
    });
    expect(r.suggestedWeight).toBe(0);
  });

  it('力竭动作跳过判定；计时动作按区间正常判定', () => {
    expect(suggestOverload({ recentSessions: [s(0, 12), s(0, 14)], targetReps: '力竭' })).toBeNull();
    expect(suggestOverload({ recentSessions: [s(0, 50), s(0, 55)], targetReps: '45秒' })).not.toBeNull(); // 计时动作按区间判定
  });

  it('历史次数不足 capHits → 返回 null', () => {
    expect(suggestOverload({ recentSessions: [s(100, 10)], targetReps: '8-10', capHits: 2 })).toBeNull();
    expect(suggestOverload({ recentSessions: [], targetReps: '8-10', capHits: 2 })).toBeNull();
  });

  it('一次达标一次未达标 → 不出建议', () => {
    expect(
      suggestOverload({ recentSessions: [s(100, 10), s(100, 8)], targetReps: '8-10', capHits: 2 })
    ).toBeNull();
  });
});

describe('volume 容量与 e1RM', () => {
  it('setVolume = 重量 × 次数', () => {
    expect(setVolume({ weight: 100, reps: 10 })).toBe(1000);
    expect(setVolume({ weight: 0, reps: 15 })).toBe(0); // 自重动作容量为 0
  });

  it('workoutVolume 汇总一次训练', () => {
    const exercises = [
      { sets: [{ weight: 100, reps: 10 }, { weight: 100, reps: 8 }] },
      { sets: [{ weight: 60, reps: 12 }] },
    ];
    expect(workoutVolume(exercises)).toBe(2520);
  });

  it('workoutVolume 排除热身组（与 overload.topSet 口径一致）', () => {
    const exercises = [
      {
        sets: [
          { weight: 20, reps: 15, type: 'warmup' }, // 300，不计入
          { weight: 60, reps: 10, type: 'work' },
          { weight: 60, reps: 8 }, // 无 type 字段按正式组计
        ],
      },
    ];
    expect(workoutVolume(exercises)).toBe(1080);
  });

  it('workoutVolume onlyDone 只统计已完成组', () => {
    const exercises = [{ sets: [{ weight: 100, reps: 10, done: true }, { weight: 100, reps: 8, done: false }] }];
    expect(workoutVolume(exercises, { onlyDone: true })).toBe(1000);
  });

  it('e1rm Epley 公式', () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(100, 1)).toBe(100); // 单次即为本身
  });

  it('bestE1rm 取历史最佳', () => {
    expect(bestE1rm([{ weight: 100, reps: 5 }, { weight: 90, reps: 10 }])).toBeCloseTo(120, 1);
    expect(bestE1rm([])).toBe(0);
  });
});

describe('pr 个人纪录检测', () => {
  const history = [{ weight: 100, reps: 8 }]; // 容量 800，最重 100

  it('容量超历史 → PR', () => {
    expect(isNewPR({ weight: 100, reps: 10 }, history)).toBe(true);
  });
  it('重量创新高（容量未超）也算 PR', () => {
    expect(isNewPR({ weight: 110, reps: 5 }, history)).toBe(true);
  });
  it('未超历史 → 非 PR', () => {
    expect(isNewPR({ weight: 90, reps: 8 }, history)).toBe(false);
  });
  it('空历史时不算 PR（首次训练缺乏比较基准，避免每组都报 PR）', () => {
    expect(isNewPR({ weight: 50, reps: 5 }, [])).toBe(false);
    expect(isNewPR({ weight: 100, reps: 10 }, null)).toBe(false);
  });
  it('超过历史最大重量/容量才算 PR', () => {
    const h = [{ weight: 80, reps: 10 }, { weight: 100, reps: 5 }]; // 最大容量 800，最大重量 100
    expect(isNewPR({ weight: 100, reps: 9 }, h)).toBe(true); // 容量 900 > 800
    expect(isNewPR({ weight: 102.5, reps: 5 }, h)).toBe(true); // 重量创新高
    expect(isNewPR({ weight: 80, reps: 10 }, h)).toBe(false); // 持平不算
  });
  it('同一动作一次训练内只提示一次', () => {
    expect(shouldNotifyPR('卧推', [])).toBe(true);
    expect(shouldNotifyPR('卧推', ['卧推'])).toBe(false);
  });
});
