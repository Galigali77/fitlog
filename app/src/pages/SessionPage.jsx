import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store';
import { exerciseById } from '@/data/exercises';
import { todayStr } from '@/data/history';
import { ArrowLeft, Check, Plus, Timer, Trophy, X } from 'lucide-react';

// 每组的历史最佳容量（演示 PR 检测用）
const HISTORICAL_BEST = {
  squat: 80 * 8, bench: 50 * 10, deadlift: 100 * 6, ohp: 35 * 8, row: 55 * 10,
  'db-press': 22.5 * 10, 'db-fly': 10 * 12, 'db-curl': 12.5 * 10, 'db-lunge': 20 * 12,
  'db-shoulder': 7.5 * 15, pullup: 70 * 10, pushup: 0, plank: 0, calf: 0,
  'leg-raise': 0, romanian: 60 * 10,
};

// 上次数据预填
const LAST_TIME = {
  squat: { weight: 77.5, reps: 8 },
  bench: { weight: 50, reps: 10 },
  ohp: { weight: 35, reps: 8 },
  row: { weight: 55, reps: 10 },
  'db-curl': { weight: 12.5, reps: 10 },
};

/** @param {{ routine: import('@/types').Routine, onFinish: () => void }} props */
export default function SessionPage({ routine, onFinish }) {
  const { addWorkout } = useStore();
  const [exercises, setExercises] = useState(() =>
    routine.items.map((it) => ({
      exerciseId: it.exerciseId,
      nameZh: exerciseById(it.exerciseId).nameZh,
      sets: Array.from({ length: it.targetSets }, () => ({
        ...(LAST_TIME[it.exerciseId] ?? { weight: 0, reps: 0 }),
        done: false,
      })),
    }))
  );
  const [prs, setPrs] = useState([]);
  const [restLeft, setRestLeft] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (restLeft <= 0) return;
    timerRef.current = window.setTimeout(() => setRestLeft((s) => s - 1), 1000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [restLeft]);

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
    // PR 检测
    const best = HISTORICAL_BEST[ex.exerciseId] ?? 0;
    if (set.weight * set.reps > best && !prs.includes(ex.nameZh)) {
      setPrs((prev) => [...prev, ex.nameZh]);
    }
    setRestLeft(90); // 组间休息计时器（默认 90s）
  };

  const addSet = (ei) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== ei ? ex : { ...ex, sets: [...ex.sets, { weight: ex.sets.at(-1)?.weight ?? 0, reps: ex.sets.at(-1)?.reps ?? 0, done: false }] }
      )
    );
  };

  const volume = useMemo(
    () => exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, x) => s + (x.done ? x.weight * x.reps : 0), 0), 0),
    [exercises]
  );
  const doneSets = exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);

  const finish = () => {
    addWorkout({
      id: `w-${Date.now()}`,
      date: todayStr,
      title: routine.name,
      routineName: routine.name,
      exercises: exercises.filter((e) => e.sets.some((s) => s.done)),
    });
    onFinish();
  };

  return (
    <div className="px-5 pt-5 pb-36 space-y-5">
      <header className="flex items-center justify-between">
        <button onClick={onFinish} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
          <ArrowLeft size={18} />
        </button>
        <div className="text-center">
          <h1 className="font-bold">{routine.name}</h1>
          <p className="text-[11px] text-muted-foreground font-mono">已完成 {doneSets} 组 · {volume} kg 容量</p>
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
        const meta = exerciseById(ex.exerciseId);
        return (
          <section key={ex.exerciseId} className="rounded-3xl p-4 glow-card bg-card/80 border border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold">{meta.nameZh}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {meta.muscles.join(' / ')} · {meta.equipment}
                </p>
              </div>
              <span className="text-[11px] text-purple-300 bg-purple-500/15 border border-purple-500/25 rounded-full px-2.5 py-1">
                上次 {LAST_TIME[ex.exerciseId] ? `${LAST_TIME[ex.exerciseId].weight}×${LAST_TIME[ex.exerciseId].reps}` : '—'}
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
            <button onClick={() => setRestLeft(0)} className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-200 active:scale-95 transition">
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
