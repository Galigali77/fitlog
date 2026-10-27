import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store';
import { lastSetsOf, exerciseHistory, todayStr, loadDraft, saveDraft, clearDraft } from '@/db/repository';
import { toast, describeDbError } from '@/ui/toast';
import { exerciseById } from '@/data/exerciseLibrary';
import { isNewPR, shouldNotifyPR } from '@/domain/pr';
import { workoutVolume } from '@/domain/volume';
import { useRestTimer } from '@/hooks/useRestTimer';
import ExercisePicker from '@/components/ExercisePicker';
import { ArrowLeft, Check, Plus, Timer, Trophy, X } from 'lucide-react';

/**
 * 记录页：逐组记录 + 上次数据预填（FR-LOG-03）+ PR 检测（FR-LOG-05）+ 组间计时器（FR-LOG-04）
 * 数据在「结束训练」时事务式落盘 IndexedDB，刷新后仍在（阶段一验收）。
 * 阶段三扩展：支持自由训练（routine=null，从动作库加动作）与补记（date 指定历史日期，FR-LOG-09）。
 */
/** @param {{ routine: import('@/types').Routine | null, date?: string, onFinish: () => void }} props */
export default function SessionPage({ routine, date, onFinish }) {
  const { saveWorkout, settings } = useStore();
  const [exercises, setExercises] = useState(null); // null = 预填数据加载中
  const [historyMap, setHistoryMap] = useState({}); // exerciseId → 历史所有组（PR 检测用）
  const [lastMap, setLastMap] = useState({}); // exerciseId → 上次各组（「上次」角标用）
  const [nameMap, setNameMap] = useState({});
  const [prs, setPrs] = useState([]);
  const [picking, setPicking] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false); // 退出确认弹层（退出保留草稿 / 放弃清除）
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const { left: restLeft, flash, start: startRest, stop: stopRest } = useRestTimer(settings.restSeconds);

  const title = routine?.name ?? '自由训练';
  const workoutDate = date ?? todayStr();

  /** 加载某动作的元数据/上次组/历史，供预填与 PR 检测 */
  const loadExerciseMeta = async (exerciseId) => {
    const [meta, last, history] = await Promise.all([
      exerciseById(exerciseId),
      lastSetsOf(exerciseId),
      exerciseHistory(exerciseId),
    ]);
    setNameMap((prev) => ({ ...prev, [exerciseId]: meta?.nameZh ?? exerciseId }));
    setLastMap((prev) => ({ ...prev, [exerciseId]: last }));
    setHistoryMap((prev) => ({ ...prev, [exerciseId]: history.flatMap((h) => h.sets) }));
    return { meta, last };
  };

  // 初始化：优先恢复未完成的草稿（刷新/杀后台后继续），否则按计划项生成组并预填
  useEffect(() => {
    let alive = true;
    (async () => {
      // 草稿恢复：仅当草稿属于当前计划（或同为自由训练）时恢复，避免串台
      const draft = await loadDraft();
      if (alive && draft && (draft.routineId ?? null) === (routine?.id ?? null)) {
        setExercises(draft.exercises ?? []);
        setNameMap(draft.nameMap ?? {});
        setLastMap(draft.lastMap ?? {});
        setHistoryMap(draft.historyMap ?? {});
        setPrs(draft.prs ?? []);
        if (draft.startedAt) setStartedAt(draft.startedAt); // 恢复开始时刻，训练时长不含中断
        return;
      }
      if (!routine) {
        setExercises([]);
        return;
      }
      const entries = await Promise.all(
        routine.items.map(async (it) => ({ it, ...(await loadExerciseMeta(it.exerciseId)) }))
      );
      if (!alive) return;
      setExercises(
        entries.map(({ it, last }) => ({
          exerciseId: it.exerciseId,
          sets: Array.from({ length: it.targetSets }, (_, i) => ({
            weight: last?.[i]?.weight ?? last?.[0]?.weight ?? 0,
            reps: last?.[i]?.reps ?? last?.[0]?.reps ?? 0,
            done: false,
          })),
        }))
      );
    })();
    return () => {
      alive = false;
    };
  }, [routine]);

  // 自动保存草稿：组数据变化 500ms 后防抖落盘（含 done 状态），刷新/关闭标签页后可恢复。
  // 写失败（配额满/隐私模式）只提示一次，避免防抖触发反复弹 toast。
  const draftErrShown = useRef(false);
  useEffect(() => {
    if (exercises === null) return undefined;
    const t = window.setTimeout(() => {
      saveDraft({
        routineId: routine?.id ?? null,
        routineName: routine?.name ?? null,
        date: workoutDate,
        startedAt,
        exercises,
        nameMap,
        lastMap,
        historyMap,
        prs,
      }).catch((err) => {
        if (draftErrShown.current) return;
        draftErrShown.current = true;
        toast(`草稿自动保存失败：${describeDbError(err)}`);
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [exercises, nameMap, lastMap, historyMap, prs, startedAt, workoutDate, routine]);

  /** 训练中途从动作库追加动作（默认 3 组，按上次数据预填） */
  const addExercise = async (ex) => {
    setPicking(false);
    const { last } = await loadExerciseMeta(ex.id);
    setExercises((prev) => [
      ...(prev ?? []),
      {
        exerciseId: ex.id,
        sets: Array.from({ length: 3 }, (_, i) => ({
          weight: last?.[i]?.weight ?? last?.[0]?.weight ?? 0,
          reps: last?.[i]?.reps ?? last?.[0]?.reps ?? 0,
          done: false,
        })),
      },
    ]);
  };

  const updateSet = (ei, si, patch) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) }
      )
    );
  };

  const completeSet = (ei, si) => {
    const ex = exercises[ei];
    const set = ex.sets[si];
    updateSet(ei, si, { done: true });
    // PR 检测：与真实历史比较，同一动作本次训练只提示一次
    const name = nameMap[ex.exerciseId] ?? ex.exerciseId;
    if (isNewPR(set, historyMap[ex.exerciseId]) && shouldNotifyPR(name, prs)) {
      setPrs((prev) => [...prev, name]);
    }
    startRest(); // 组间休息计时器（默认秒数来自设置）
  };

  const addSet = (ei) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== ei
          ? ex
          : { ...ex, sets: [...ex.sets, { weight: ex.sets.at(-1)?.weight ?? 0, reps: ex.sets.at(-1)?.reps ?? 0, done: false }] }
      )
    );
  };

  const volume = useMemo(() => workoutVolume(exercises ?? [], { onlyDone: true }), [exercises]);
  const doneSets = (exercises ?? []).reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);

  const finish = async () => {
    const done = (exercises ?? [])
      .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.done) }))
      .filter((ex) => ex.sets.length > 0);
    if (done.length > 0) {
      try {
        await saveWorkout({
          date: workoutDate,
          title,
          routineId: routine?.id ?? null, // 自由训练无关联计划（FR-LOG-08）
          routineName: routine?.name ?? null,
          durationMin: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
          exercises: done.map((ex) => ({
            exerciseId: ex.exerciseId,
            nameZh: nameMap[ex.exerciseId] ?? ex.exerciseId,
            sets: ex.sets.map(({ weight, reps }) => ({ weight, reps })),
          })),
        });
      } catch (err) {
        // 保存失败：不清草稿、不退出页面，数据仍可重试或去设置页导出
        toast(`保存训练失败：${describeDbError(err)}。数据仍保留在本页草稿中，请处理后可重试`);
        return;
      }
    }
    try {
      await clearDraft(); // 训练落盘（或空训练放弃）后清除草稿，避免残留
    } catch (err) {
      // 落盘已成功但草稿没清掉：必须提示，否则今日页会出现「幽灵草稿」引导用户重复训练
      toast(`训练已保存，但清除草稿失败：${describeDbError(err)}。若今日页出现「未完成的训练」卡片，请直接点「放弃」`);
    }
    onFinish();
  };

  if (!exercises) {
    return <p className="px-5 pt-10 text-sm text-muted-foreground">正在预填上次数据…</p>;
  }

  return (
    <div className="px-5 pt-5 pb-36 space-y-5">
      {/* 到时闪屏层 */}
      {flash && <div className="fixed inset-0 z-[60] bg-purple-400/40 pointer-events-none" />}

      <header className="flex items-center justify-between">
        <button onClick={() => setQuitOpen(true)} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
          <ArrowLeft size={18} />
        </button>
        <div className="text-center">
          <h1 className="font-bold">{title}</h1>
          <p className="text-[11px] text-muted-foreground font-mono">
            {workoutDate !== todayStr() ? `补记 ${workoutDate} · ` : ''}已完成 {doneSets} 组 · {volume} kg 容量
          </p>
        </div>
        <button onClick={finish} className="px-3.5 h-9 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-sm font-bold glow-primary active:scale-95 transition">
          结束
        </button>
      </header>

      {prs.length > 0 && (
        <div className="rounded-2xl px-4 py-3 bg-purple-500/15 border border-purple-400/30 flex items-center gap-2.5">
          <Trophy size={16} className="text-purple-300" />
          <p className="text-sm text-purple-200">新纪录：{prs.join('、')}！</p>
        </div>
      )}

      {exercises.map((ex, ei) => {
        const last = lastMap[ex.exerciseId];
        return (
          <section key={ex.exerciseId} className="rounded-3xl p-4 glow-card bg-card/80 border border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold">{nameMap[ex.exerciseId] ?? ex.exerciseId}</h3>
              </div>
              <span className="text-[11px] text-purple-300 bg-purple-500/15 border border-purple-500/25 rounded-full px-2.5 py-1">
                上次 {last?.length ? `${last[0].weight}×${last[0].reps}` : '—'}
              </span>
            </div>
            <div className="space-y-2">
              {ex.sets.map((set, si) => (
                <div
                  key={si}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 border transition ${
                    set.done ? 'bg-purple-500/10 border-purple-500/30' : 'bg-background/60 border-border/50'
                  }`}
                >
                  <span className="w-6 text-center text-xs font-mono text-muted-foreground">{si + 1}</span>
                  <div className="flex-1 flex items-center justify-center gap-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={set.weight || ''}
                      placeholder="kg"
                      onChange={(e) => updateSet(ei, si, { weight: parseFloat(e.target.value) || 0, done: false })}
                      className="w-16 text-center bg-transparent border border-border/60 rounded-lg py-1.5 text-sm font-mono focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-muted-foreground text-xs">kg ×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={set.reps || ''}
                      placeholder="次"
                      onChange={(e) => updateSet(ei, si, { reps: parseInt(e.target.value) || 0, done: false })}
                      className="w-14 text-center bg-transparent border border-border/60 rounded-lg py-1.5 text-sm font-mono focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-muted-foreground text-xs">次</span>
                  </div>
                  <button
                    onClick={() => (set.done ? updateSet(ei, si, { done: false }) : completeSet(ei, si))}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95 ${
                      set.done ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-primary-foreground' : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {set.done ? <Check size={16} /> : <Timer size={16} />}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => addSet(ei)} className="mt-2.5 w-full py-2 rounded-xl border border-dashed border-purple-500/40 text-purple-300 text-sm flex items-center justify-center gap-1 active:scale-[0.98] transition">
              <Plus size={14} /> 添加一组
            </button>
          </section>
        );
      })}

      {/* 训练中途追加动作（自由训练的入口，也是计划外加练） */}
      <button onClick={() => setPicking(true)} className="w-full py-3 rounded-2xl border border-dashed border-purple-500/40 text-purple-300 text-sm flex items-center justify-center gap-1 active:scale-[0.98] transition">
        <Plus size={14} /> 添加动作
      </button>
      {exercises.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">自由训练：点上方按钮从动作库添加第一个动作</p>
      )}
      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}

      {/* 组间休息计时器悬浮条 */}
      {restLeft > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[380px] z-40">
          <div className="rounded-2xl px-5 py-3.5 bg-[#1c1030]/95 backdrop-blur border border-purple-400/40 glow-primary flex items-center justify-between pulse-ring">
            <div className="flex items-center gap-3">
              <Timer size={18} className="text-purple-300" />
              <div>
                <p className="text-[10px] text-muted-foreground tracking-widest">组间休息</p>
                <p className="text-xl font-black font-mono text-gradient leading-none">
                  {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
                </p>
              </div>
            </div>
            <button onClick={stopRest} className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-200 active:scale-95 transition">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 退出确认：默认保留草稿（自动保存），也可主动放弃清除 */}
      {quitOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setQuitOpen(false)}>
          <div className="w-full max-w-[430px] m-3 rounded-3xl bg-card border border-border/60 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-bold">退出本次训练？</h3>
              <p className="text-xs text-muted-foreground mt-1">已记录的组已自动保存为草稿，可在今日页随时继续</p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setQuitOpen(false)} className="flex-1 py-3 rounded-2xl bg-background/60 border border-border/50 text-sm active:scale-[0.98] transition">
                继续训练
              </button>
              <button onClick={onFinish} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 text-sm font-bold glow-primary active:scale-[0.98] transition">
                保存并退出
              </button>
            </div>
            <button
              onClick={async () => {
                await clearDraft();
                onFinish();
              }}
              className="w-full py-1 text-xs text-red-400/90 active:scale-[0.98] transition"
            >
              放弃本次训练（清除草稿）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
