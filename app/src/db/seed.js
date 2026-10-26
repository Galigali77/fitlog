/**
 * 首次启动种子数据（技术方案 4.3：空计划 + 内置模板写入）
 * 种子计划引用真实 openGym 动作 id，由 tools/fetch_openGym.py 生成
 * app/public/exercises/routinesSeed.json；文件缺失（未跑过工具链）时回退到演示动作 id。
 */
import { db } from './schema';

const FALLBACK_ROUTINES = [
  {
    id: 'r-push', name: '推日 Push（A）', mode: 'rotation', rotationPos: 0,
    items: [
      { exerciseId: 'bench', targetSets: 4, targetReps: '8-10' },
      { exerciseId: 'ohp', targetSets: 3, targetReps: '8-12' },
      { exerciseId: 'db-fly', targetSets: 3, targetReps: '12-15' },
      { exerciseId: 'db-curl', targetSets: 3, targetReps: '10-12' },
    ],
  },
  {
    id: 'r-pull', name: '拉日 Pull（B）', mode: 'rotation', rotationPos: 0,
    items: [
      { exerciseId: 'pullup', targetSets: 4, targetReps: '6-10' },
      { exerciseId: 'row', targetSets: 4, targetReps: '8-10' },
      { exerciseId: 'db-curl', targetSets: 3, targetReps: '10-12' },
    ],
  },
  {
    id: 'r-legs', name: '腿日 Legs（C）', mode: 'rotation', rotationPos: 0,
    items: [
      { exerciseId: 'squat', targetSets: 5, targetReps: '5-8' },
      { exerciseId: 'romanian', targetSets: 3, targetReps: '8-10' },
      { exerciseId: 'calf', targetSets: 4, targetReps: '15-20' },
      { exerciseId: 'plank', targetSets: 3, targetReps: '45秒' },
    ],
  },
];

/**
 * 数据库为空时写入种子计划（幂等：只在 routines 表为空时执行）
 * @param {string} [base] 站点基础路径（Vite base，构建产物子路径部署时非 "/"）
 */
export async function seedIfEmpty(base = '/') {
  const count = await db.routines.count();
  if (count > 0) return;
  let routines = FALLBACK_ROUTINES;
  try {
    const res = await fetch(`${base}exercises/routinesSeed.json`);
    if (res.ok) routines = await res.json();
  } catch {
    // 离线或文件缺失时用回退种子，不阻塞启动
  }
  await db.transaction('rw', [db.routines, db.routineItems], async () => {
    for (const [order, r] of routines.entries()) {
      await db.routines.add({ id: r.id, name: r.name, mode: r.mode, rotationPos: r.rotationPos ?? 0, order });
      await db.routineItems.bulkAdd(
        (r.items ?? []).map((it, i) => ({
          id: `${r.id}-item-${i}`,
          routineId: r.id,
          exerciseId: it.exerciseId,
          targetSets: it.targetSets,
          targetReps: it.targetReps,
          increment: it.increment ?? null,
        }))
      );
    }
  });
}
