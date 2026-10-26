import { useEffect, useMemo, useState } from 'react';
import { getWorkout, updateWorkout, deleteWorkout } from '@/db/repository';
import { workoutVolume } from '@/domain/volume';
import { generateShareCard } from '@/components/ShareCard';
import { downloadFile } from '@/db/backup';
import { ArrowLeft, CalendarDays, Plus, Share2, Trash2 } from 'lucide-react';

/**
 * 训练详情页（阶段三：FR-LOG-09 / FR-ANA-06 / FR-DATA-05）
 * 查看明细、改日期、改/删/增组数据、删除整次训练、导出分享卡片 PNG；
 * 保存后统计（热力图/容量/建议）因 useLiveQuery 订阅自动重算。
 * @param {{ workoutId: string, onClose: () => void, onDeleted?: () => void }} props
 */
export default function WorkoutDetailPage({ workoutId, onClose, onDeleted }) {
  const [workout, setWorkout] = useState(null);
  const [date, setDate] = useState('');
  const [exercises, setExercises] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);

  // 按 workoutId 加载一次（异步读取，setState 发生在 await 之后的回调里）
  useEffect(() => {
    let alive = true;
    (async () => {
      const w = await getWorkout(workoutId);
      if (!alive) return;
      if (!w) {
        onClose();
        return;
      }
      setWorkout(w);
      setDate(w.date);
      setExercises(w.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s })) })));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅按 workoutId 加载一次
  }, [workoutId]);

  const volume = useMemo(() => workoutVolume(exercises), [exercises]);
  const setCount = exercises.reduce((n, ex) => n + ex.sets.length, 0);

  const updateSet = (ei, si, patch) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }))
    );
  };

  const save = async () => {
    const cleaned = exercises.filter((ex) => ex.sets.length > 0);
    await updateWorkout(workoutId, {
      date,
      title: workout.title,
      note: workout.note,
      exercises: cleaned.map((ex) => ({
        exerciseId: ex.exerciseId,
        nameZh: ex.nameZh,
        sets: ex.sets.map((s) => ({ weight: s.weight || 0, reps: s.reps || 0, rpe: s.rpe, type: s.type })),
      })),
    });
    onClose();
  };

  const share = async () => {
    setSharing(true);
    try {
      const blob = await generateShareCard({ ...workout, date, exercises });
      downloadFile(`fitlog-${date}.png`, blob, 'image/png');
    } finally {
      setSharing(false);
    }
  };

  if (!workout) {
    return <p className="px-5 pt-10 text-sm text-muted-foreground">加载中…</p>;
  }

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <header className="flex items-center justify-between">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
          <ArrowLeft size={18} />
        </button>
        <div className="text-center">
          <h1 className="font-bold">{workout.title}</h1>
          <p className="text-[11px] text-muted-foreground font-mono">{setCount} 组 · {volume} kg 容量</p>
        </div>
        <button onClick={save} className="px-3.5 h-9 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-sm font-bold glow-primary active:scale-95 transition">
          保存
        </button>
      </header>

      {/* 日期修改（FR-LOG-09 改日期） */}
      <label className="rounded-2xl px-4 py-3 bg-card/80 border border-border/60 flex items-center gap-3">
        <CalendarDays size={16} className="text-purple-300 shrink-0" />
        <span className="text-sm text-muted-foreground">训练日期</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 bg-transparent text-sm font-mono text-right focus:outline-none [color-scheme:dark]"
        />
      </label>

      {/* 动作与组（可编辑/删除/添加） */}
      {exercises.map((ex, ei) => (
        <section key={ex.id ?? ex.exerciseId} className="rounded-3xl p-4 glow-card bg-card/80 border border-border/60">
          <h3 className="font-bold mb-3">{ex.nameZh}</h3>
          <div className="space-y-2">
            {ex.sets.map((set, si) => (
              <div key={set.id ?? si} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 bg-background/60 border border-border/50">
                <span className="w-6 text-center text-xs font-mono text-muted-foreground">{si + 1}</span>
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={set.weight || ''}
                    placeholder="kg"
                    onChange={(e) => updateSet(ei, si, { weight: parseFloat(e.target.value) || 0 })}
                    className="w-16 text-center bg-transparent border border-border/60 rounded-lg py-1.5 text-sm font-mono focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-muted-foreground text-xs">kg ×</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.reps || ''}
                    placeholder="次"
                    onChange={(e) => updateSet(ei, si, { reps: parseInt(e.target.value) || 0 })}
                    className="w-14 text-center bg-transparent border border-border/60 rounded-lg py-1.5 text-sm font-mono focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-muted-foreground text-xs">次</span>
                </div>
                <button
                  onClick={() => setExercises((prev) => prev.map((x, i) => (i !== ei ? x : { ...x, sets: x.sets.filter((_, j) => j !== si) })))}
                  className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center active:scale-95 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setExercises((prev) => prev.map((x, i) => (i !== ei ? x : { ...x, sets: [...x.sets, { weight: x.sets.at(-1)?.weight ?? 0, reps: x.sets.at(-1)?.reps ?? 0 }] })))}
            className="mt-2.5 w-full py-2 rounded-xl border border-dashed border-purple-500/40 text-purple-300 text-sm flex items-center justify-center gap-1 active:scale-[0.98] transition"
          >
            <Plus size={14} /> 添加一组
          </button>
        </section>
      ))}

      {/* 分享卡片 + 删除训练 */}
      <div className="flex gap-2.5">
        <button onClick={share} disabled={sharing} className="flex-1 py-3 rounded-2xl bg-purple-500/15 border border-purple-500/40 text-purple-200 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50">
          <Share2 size={14} /> {sharing ? '生成中…' : '分享卡片'}
        </button>
        <button onClick={() => setConfirmDelete(true)} className="flex-1 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
          <Trash2 size={14} /> 删除本次训练
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-[430px] m-3 rounded-3xl bg-card border border-border/60 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-center">删除「{workout.title}」（{workout.date}）的全部记录？此操作不可恢复。</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-2xl bg-background/60 border border-border/50 text-sm active:scale-[0.98] transition">
                取消
              </button>
              <button
                onClick={async () => {
                  await deleteWorkout(workoutId);
                  setConfirmDelete(false);
                  (onDeleted ?? onClose)();
                }}
                className="flex-1 py-3 rounded-2xl bg-red-500/80 text-sm font-bold active:scale-[0.98] transition"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
