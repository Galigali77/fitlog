/**
 * 训练草稿层测试（Dexie v2 sessionDrafts）
 * 覆盖：保存/读取往返、单条覆盖写、清除、与正式训练记录互不干扰
 * 运行：npm run test（需 fake-indexeddb，Node 环境模拟 IndexedDB）
 */
import 'fake-indexeddb/auto'; // 必须先于 Dexie 初始化注入 indexedDB 全局对象
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/schema';
import { saveDraft, loadDraft, clearDraft, saveWorkout, listWorkouts } from '../src/db/repository';

const sampleDraft = {
  routineId: 'r-push',
  routineName: '推日 Push（A）',
  date: '2026-10-26',
  startedAt: Date.now() - 60000,
  exercises: [
    {
      exerciseId: 'bench',
      sets: [
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 8, done: false },
      ],
    },
  ],
  nameMap: { bench: '平板卧推' },
  prs: ['平板卧推'],
};

beforeEach(async () => {
  await db.sessionDrafts.clear();
});

describe('训练草稿（sessionDrafts v2）', () => {
  it('无草稿时 loadDraft 返回 undefined', async () => {
    expect(await loadDraft()).toBeUndefined();
  });

  it('saveDraft → loadDraft 完整往返：组数据与 done 状态不丢', async () => {
    await saveDraft(sampleDraft);
    const d = await loadDraft();
    expect(d.exercises[0].sets[0]).toMatchObject({ weight: 60, reps: 10, done: true });
    expect(d.exercises[0].sets[1]).toMatchObject({ weight: 60, reps: 8, done: false });
    expect(d.nameMap.bench).toBe('平板卧推');
    expect(d.prs).toEqual(['平板卧推']);
    expect(d.startedAt).toBe(sampleDraft.startedAt);
    expect(d.date).toBe('2026-10-26');
  });

  it('单条草稿：后保存的覆盖先保存的（同一时间只留一份）', async () => {
    await saveDraft(sampleDraft);
    await saveDraft({ ...sampleDraft, routineName: '拉日 Pull（B）' });
    const all = await db.sessionDrafts.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].routineName).toBe('拉日 Pull（B）');
  });

  it('clearDraft 后草稿消失', async () => {
    await saveDraft(sampleDraft);
    await clearDraft();
    expect(await loadDraft()).toBeUndefined();
  });

  it('防丢场景闭环：训练中存草稿 → 结束后落盘并清草稿 → 记录完整、草稿无残留', async () => {
    // 1) 训练中：草稿写入
    await saveDraft(sampleDraft);
    // 2) 结束训练：done 组落盘（SessionPage.finish 行为）
    await saveWorkout({
      date: sampleDraft.date,
      title: sampleDraft.routineName,
      routineId: sampleDraft.routineId,
      routineName: sampleDraft.routineName,
      exercises: sampleDraft.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        nameZh: '平板卧推',
        sets: ex.sets.filter((s) => s.done).map(({ weight, reps }) => ({ weight, reps })),
      })),
    });
    // 3) 清除草稿
    await clearDraft();
    const workouts = await listWorkouts();
    expect(workouts).toHaveLength(1);
    expect(workouts[0].routineName).toBe('推日 Push（A）');
    expect(workouts[0].exercises[0].sets).toHaveLength(1); // 只落盘已完成组
    expect(workouts[0].exercises[0].sets[0]).toMatchObject({ weight: 60, reps: 10 });
    expect(await loadDraft()).toBeUndefined();
  });
});
