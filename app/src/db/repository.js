/**
 * Repository 数据访问层（技术方案 2.1.1 第四道防线）
 * 页面不直接碰 Dexie 表，所有读写经这里收敛，字段拼装只发生在本文件。
 */
import { db } from './schema';

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * 数组分组（替代 Map.groupBy：该 API 需 iOS 17.4+，不满足兼容性需求 iOS Safari 15+）
 * @template T
 * @param {T[]} list @param {(item: T) => string} keyFn
 * @returns {Map<string, T[]>}
 */
function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** 组顺序还原：sets 以随机 uid 为主键，读取顺序不稳定，统一按写入时的 setIndex 排序（旧数据无该字段时保持原顺序） */
const bySetIndex = (a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0);

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- 训练记录 ----------

/**
 * 读取全部训练（按日期倒序），并组装 workoutExercises + sets 三级结构
 * @returns {Promise<import('@/types').Workout[]>}
 */
export async function listWorkouts() {
  const workouts = await db.workouts.orderBy('date').reverse().toArray();
  const allEx = await db.workoutExercises.toArray();
  const allSets = await db.sets.toArray();
  const setsByWe = groupBy(allSets, (s) => s.workoutExerciseId);
  const exByWorkout = groupBy(allEx, (e) => e.workoutId);
  return workouts.map((w) => ({
    ...w,
    exercises: (exByWorkout.get(w.id) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((e) => ({ ...e, sets: (setsByWe.get(e.id) ?? []).sort(bySetIndex) })),
  }));
}

/**
 * 保存一次完成的训练（事务式落盘：三级记录要么全部写入要么全部回滚）
 * @param {{ date: string, title: string, routineId?: string, routineName?: string,
 *           durationMin?: number, note?: string,
 *           exercises: Array<{ exerciseId: string, nameZh: string,
 *             sets: Array<{ weight: number, reps: number, rpe?: number, type?: string }> }> }} payload
 * @returns {Promise<string>} 新训练 id
 */
export async function saveWorkout(payload) {
  const workoutId = uid('w');
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
    await db.workouts.add({
      id: workoutId,
      date: payload.date,
      title: payload.title,
      routineId: payload.routineId ?? null,
      routineName: payload.routineName ?? null,
      durationMin: payload.durationMin ?? null,
      note: payload.note ?? '',
      createdAt: Date.now(),
    });
    for (const [order, ex] of payload.exercises.entries()) {
      const weId = uid('we');
      await db.workoutExercises.add({
        id: weId,
        workoutId,
        exerciseId: ex.exerciseId,
        nameZh: ex.nameZh,
        order,
      });
      await db.sets.bulkAdd(
        ex.sets.map((s, si) => ({
          id: uid('s'),
          workoutExerciseId: weId,
          setIndex: si,
          weight: s.weight || 0,
          reps: s.reps || 0,
          rpe: s.rpe ?? null,
          type: s.type ?? 'work',
        }))
      );
    }
  });
  return workoutId;
}

/**
 * 取某动作的历史组数据（按训练日期从新到旧分组），供「上次数据预填」与 PR/超负荷检测
 * @param {string} exerciseId
 * @returns {Promise<Array<{ date: string, sets: Array<{ weight: number, reps: number, type?: string }> }>>}
 */
export async function exerciseHistory(exerciseId) {
  const wes = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
  if (wes.length === 0) return [];
  const workouts = await db.workouts.toArray();
  const dateById = new Map(workouts.map((w) => [w.id, w.date]));
  const allSets = await db.sets.toArray();
  const setsByWe = groupBy(allSets, (s) => s.workoutExerciseId);
  return wes
    .map((we) => ({ date: dateById.get(we.workoutId) ?? '', sets: (setsByWe.get(we.id) ?? []).sort(bySetIndex) }))
    .filter((r) => r.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 上次数据预填（FR-LOG-03）：取该动作最近一次训练各组的重量与次数
 * @param {string} exerciseId
 * @returns {Promise<Array<{ weight: number, reps: number }> | null>}
 */
export async function lastSetsOf(exerciseId) {
  const history = await exerciseHistory(exerciseId);
  return history[0]?.sets?.length ? history[0].sets : null;
}

// ---------- 训练计划 ----------

/** @returns {Promise<import('@/types').Routine[]>} 全部计划（组装 items，按种子顺序排序） */
export async function listRoutines() {
  const routines = await db.routines.toArray();
  const items = await db.routineItems.toArray();
  const itemsByRoutine = groupBy(items, (i) => i.routineId);
  // Dexie 主键索引按 id 字典序返回，展示顺序以种子写入时的 order 字段为准
  return routines
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((r) => ({ ...r, items: itemsByRoutine.get(r.id) ?? [] }));
}

/**
 * 轮换计划完成一次后推进位置（FR-PLAN-03 轮换模式）
 * @param {string} routineId
 * @param {number} itemCount
 */
export async function advanceRotation(routineId, itemCount) {
  const r = await db.routines.get(routineId);
  if (!r || r.mode !== 'rotation') return;
  await db.routines.update(routineId, { rotationPos: ((r.rotationPos ?? 0) + 1) % Math.max(1, itemCount) });
}

// ---------- 身材记录（照片 Blob 化，阶段一第 3 项） ----------

/**
 * 保存一组身材记录（正面 + 背面，至少两张，FR-ANA-02）
 * @param {{ date: string, front: Blob, back: Blob }} payload
 */
export async function addBodyPhotos(payload) {
  await db.bodyPhotos.add({ id: uid('bp'), date: payload.date, front: payload.front, back: payload.back });
}

/** @returns {Promise<import('@/types').BodyPhoto[]>} 按日期倒序 */
export const listBodyPhotos = () => db.bodyPhotos.orderBy('date').reverse().toArray();

// ---------- 设置项持久化（阶段一第 4 项） ----------

export const DEFAULT_SETTINGS = {
  restSeconds: 90, // 组间休息计时器默认秒数（15s–15min 可配，FR-LOG-04）
  incrementKg: 2.5, // 渐进超负荷加重幅度（FR-PLAN-07）
  capHits: 2, // 连续达标判定次数（FR-ANA-03）
};

/** @param {string} key @param {*} fallback */
export async function getSetting(key, fallback) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

/** @param {string} key @param {*} value */
export const setSetting = (key, value) => db.settings.put({ key, value });

/** 读取全部设置并与默认值合并 */
export async function getAllSettings() {
  const rows = await db.settings.toArray();
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

// ---------- 计划编辑（阶段三：FR-PLAN-02） ----------

/**
 * 新建或更新计划（含计划项，事务写入；有 id 则整体替换 items）
 * @param {{ id?: string, name: string, mode: 'weekly'|'rotation', weekday?: number|null,
 *           items: Array<{ exerciseId: string, targetSets: number, targetReps: string, increment?: number|null }> }} payload
 * @returns {Promise<string>} 计划 id
 */
export async function saveRoutine(payload) {
  const routineId = payload.id ?? uid('r');
  await db.transaction('rw', [db.routines, db.routineItems], async () => {
    const existing = await db.routines.get(routineId);
    await db.routines.put({
      id: routineId,
      name: payload.name,
      mode: payload.mode,
      weekday: payload.weekday ?? null, // weekly 模式绑定的星期（0=周日…6=周六）
      rotationPos: existing?.rotationPos ?? 0,
      order: existing?.order ?? (await db.routines.count()),
    });
    await db.routineItems.where('routineId').equals(routineId).delete();
    await db.routineItems.bulkAdd(
      payload.items.map((it, i) => ({
        id: `${routineId}-item-${i}-${Date.now().toString(36)}`,
        routineId,
        exerciseId: it.exerciseId,
        targetSets: it.targetSets,
        targetReps: it.targetReps,
        increment: it.increment ?? null,
      }))
    );
  });
  return routineId;
}

/** 复制计划（基于模板创建自己的计划，FR-PLAN-02） */
export async function duplicateRoutine(routineId, newName) {
  const src = await db.routines.get(routineId);
  if (!src) return null;
  const items = await db.routineItems.where('routineId').equals(routineId).toArray();
  return saveRoutine({
    name: newName ?? `${src.name}（副本）`,
    mode: src.mode,
    weekday: src.weekday ?? null,
    items: items.map((it) => ({ exerciseId: it.exerciseId, targetSets: it.targetSets, targetReps: it.targetReps, increment: it.increment })),
  });
}

/** 删除计划及其计划项 */
export async function deleteRoutine(routineId) {
  await db.transaction('rw', [db.routines, db.routineItems], async () => {
    await db.routineItems.where('routineId').equals(routineId).delete();
    await db.routines.delete(routineId);
  });
}

// ---------- 历史训练编辑与补记（阶段三：FR-LOG-09） ----------

/**
 * 读取单次训练详情（组装 exercises + sets）
 * @param {string} workoutId
 * @returns {Promise<import('@/types').Workout | undefined>}
 */
export async function getWorkout(workoutId) {
  const w = await db.workouts.get(workoutId);
  if (!w) return undefined;
  const exs = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
  const allSets = await db.sets.toArray();
  const setsByWe = groupBy(allSets, (s) => s.workoutExerciseId);
  return {
    ...w,
    exercises: exs
      .sort((a, b) => a.order - b.order)
      .map((e) => ({ ...e, sets: (setsByWe.get(e.id) ?? []).sort(bySetIndex) })),
  };
}

/**
 * 更新历史训练（改日期、改组数据）；三级子记录整体重写，统计因 useLiveQuery 自动重算
 * @param {string} workoutId
 * @param {{ date: string, title: string, note?: string,
 *           exercises: Array<{ exerciseId: string, nameZh: string,
 *             sets: Array<{ weight: number, reps: number, rpe?: number, type?: string }> }> }} payload
 */
export async function updateWorkout(workoutId, payload) {
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
    await db.workouts.update(workoutId, {
      date: payload.date,
      title: payload.title,
      note: payload.note ?? '',
    });
    // 删除旧子记录后按新数据重建（比逐条 diff 更可靠，数据量小）
    const oldExs = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    if (oldExs.length > 0) {
      await db.sets.where('workoutExerciseId').anyOf(oldExs.map((e) => e.id)).delete();
    }
    await db.workoutExercises.where('workoutId').equals(workoutId).delete();
    for (const [order, ex] of payload.exercises.entries()) {
      const weId = uid('we');
      await db.workoutExercises.add({ id: weId, workoutId, exerciseId: ex.exerciseId, nameZh: ex.nameZh, order });
      await db.sets.bulkAdd(
        ex.sets.map((s, si) => ({
          id: uid('s'),
          workoutExerciseId: weId,
          setIndex: si,
          weight: s.weight || 0,
          reps: s.reps || 0,
          rpe: s.rpe ?? null,
          type: s.type ?? 'work',
        }))
      );
    }
  });
}

/** 删除训练（级联删除动作与组） */
export async function deleteWorkout(workoutId) {
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
    const exs = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    if (exs.length > 0) {
      await db.sets.where('workoutExerciseId').anyOf(exs.map((e) => e.id)).delete();
    }
    await db.workoutExercises.where('workoutId').equals(workoutId).delete();
    await db.workouts.delete(workoutId);
  });
}

// ---------- 训练草稿（记录页防丢：未完成的训练自动持久化到此） ----------

/** 草稿固定主键：同一时间只保留一份未完成的训练 */
const DRAFT_ID = 'current';

/**
 * 保存训练草稿（SessionPage 防抖自动调用；结束/放弃训练时清除）
 * @param {object} draft 记录页状态快照
 * @param {string|null} draft.routineId
 * @param {string|null} draft.routineName
 * @param {string} draft.date 训练日期 YYYY-MM-DD（补记时为历史日期）
 * @param {number} draft.startedAt 开始时刻 epoch ms（恢复后时长计算不中断）
 * @param {Array} draft.exercises 组数据（含 done 状态）
 * @param {object} [draft.nameMap]
 * @param {object} [draft.lastMap]
 * @param {object} [draft.historyMap]
 * @param {string[]} [draft.prs]
 */
export async function saveDraft(draft) {
  await db.sessionDrafts.put({ id: DRAFT_ID, ...draft, updatedAt: Date.now() });
}

/** 读取未完成的训练草稿（无草稿返回 undefined） */
export const loadDraft = () => db.sessionDrafts.get(DRAFT_ID);

/** 清除训练草稿（结束/放弃训练后调用） */
export const clearDraft = () => db.sessionDrafts.delete(DRAFT_ID);
