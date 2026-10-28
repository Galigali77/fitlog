import { useEffect, useState } from 'react';
import { saveRoutine } from '@/db/repository';
import { describeDbError } from '@/ui/toast';
import { exerciseById } from '@/data/exerciseLibrary';
import ExercisePicker from '@/components/ExercisePicker';
import NumberField from '@/components/NumberField';
import { ArrowLeft, GripVertical, Plus, Trash2 } from 'lucide-react';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 计划编辑器（阶段三：FR-PLAN-02/03/07）
 * 新建 / 编辑计划：名称、模式（按星期 | 轮换）、动作列表（增删、目标组数×次数、加重幅度）
 * @param {{ routine: import('@/types').Routine | null,  // null = 新建
 *           onDone: () => void }} props
 */
export default function PlanEditor({ routine, onDone }) {
  const [name, setName] = useState(routine?.name ?? '');
  const [mode, setMode] = useState(routine?.mode ?? 'rotation');
  const [weekday, setWeekday] = useState(routine?.weekday ?? 1);
  const [items, setItems] = useState(() =>
    (routine?.items ?? []).map((it) => ({ ...it }))
  );
  const [nameMap, setNameMap] = useState({});
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  // 解析动作名
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(items.map((it) => it.exerciseId))];
    Promise.all(ids.map((id) => exerciseById(id))).then((list) => {
      if (!alive) return;
      setNameMap((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id, i) => [id, list[i]?.nameZh ?? id])) }));
    });
    return () => {
      alive = false;
    };
  }, [items]);

  const addExercise = (ex) => {
    setItems((prev) => [...prev, { exerciseId: ex.id, targetSets: 3, targetReps: '8-12', increment: null }]);
    setNameMap((prev) => ({ ...prev, [ex.id]: ex.nameZh }));
    setPicking(false);
  };

  const updateItem = (i, patch) => {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  };

  const moveItem = (i, dir) => {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) {
      setError('请填写计划名称');
      return;
    }
    if (items.length === 0) {
      setError('计划至少需要一个动作');
      return;
    }
    try {
      await saveRoutine({
        id: routine?.id,
        name: name.trim(),
        mode,
        weekday: mode === 'weekly' ? weekday : null,
        items: items.map((it) => ({
          exerciseId: it.exerciseId,
          targetSets: Math.max(1, it.targetSets || 1),
          targetReps: String(it.targetReps || '8-12'),
          increment: it.increment ?? null,
        })),
      });
    } catch (err) {
      // 写库失败（配额满/隐私模式）：留在编辑页并用表单内错误区提示，不静默返回
      setError(`保存失败：${describeDbError(err)}`);
      return;
    }
    onDone();
  };

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <header className="flex items-center justify-between">
        <button onClick={onDone} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold">{routine ? '编辑计划' : '新建计划'}</h1>
        <button onClick={save} className="px-3.5 h-9 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-sm font-bold glow-primary active:scale-95 transition">
          保存
        </button>
      </header>

      {/* 名称 */}
      <section className="rounded-3xl p-4 bg-card/80 border border-border/60 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="计划名称，如：推日 Push"
          className="w-full bg-transparent border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
        />
        {/* 模式（FR-PLAN-03） */}
        <div className="flex gap-2">
          {[
            { key: 'rotation', label: '轮换模式', hint: 'A/B/C 按完成顺序推进' },
            { key: 'weekly', label: '绑定星期', hint: '固定星期几练' },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 rounded-2xl px-3 py-2.5 border text-left transition active:scale-[0.98] ${
                mode === m.key ? 'bg-purple-500/15 border-purple-400/50' : 'bg-background/60 border-border/50'
              }`}
            >
              <p className={`text-sm font-semibold ${mode === m.key ? 'text-purple-200' : ''}`}>{m.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.hint}</p>
            </button>
          ))}
        </div>
        {mode === 'weekly' && (
          <div className="flex gap-1.5 flex-wrap">
            {WEEKDAYS.map((w, i) => (
              <button
                key={w}
                onClick={() => setWeekday(i)}
                className={`px-3 py-1.5 rounded-full text-xs border transition active:scale-95 ${
                  weekday === i
                    ? 'bg-gradient-to-r from-purple-500 to-violet-600 border-transparent text-primary-foreground'
                    : 'bg-card/70 border-border/60 text-muted-foreground'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 动作列表 */}
      <section className="space-y-2.5">
        {items.map((it, i) => (
          <div key={`${it.exerciseId}-${i}`} className="rounded-2xl p-3.5 bg-card/80 border border-border/60">
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <GripVertical size={14} className="text-muted-foreground/50" />
                {nameMap[it.exerciseId] ?? '…'}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => moveItem(i, -1)} className="w-7 h-7 rounded-lg bg-background/60 border border-border/50 text-xs text-muted-foreground active:scale-95 transition">↑</button>
                <button onClick={() => moveItem(i, 1)} className="w-7 h-7 rounded-lg bg-background/60 border border-border/50 text-xs text-muted-foreground active:scale-95 transition">↓</button>
                <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center active:scale-95 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 flex-1">
                <span className="text-muted-foreground shrink-0">组数</span>
                <NumberField
                  integer
                  min="1"
                  value={it.targetSets}
                  onCommit={(n) => updateItem(i, { targetSets: Math.max(1, n ?? 1) })}
                  className="w-full text-center bg-background/60 border border-border/50 rounded-lg py-1.5 font-mono focus:outline-none focus:border-purple-400"
                />
              </label>
              <label className="flex items-center gap-1.5 flex-[1.4]">
                <span className="text-muted-foreground shrink-0">次数</span>
                <input
                  value={it.targetReps}
                  onChange={(e) => updateItem(i, { targetReps: e.target.value })}
                  placeholder="8-12 / 45秒 / 力竭"
                  className="w-full text-center bg-background/60 border border-border/50 rounded-lg py-1.5 font-mono focus:outline-none focus:border-purple-400"
                />
              </label>
              <label className="flex items-center gap-1.5 flex-1" title="渐进超负荷加重幅度（FR-PLAN-07），留空用全局设置">
                <span className="text-muted-foreground shrink-0">加重</span>
                <NumberField
                  step="0.5"
                  value={it.increment}
                  onCommit={(n) => updateItem(i, { increment: n })}
                  placeholder="2.5"
                  className="w-full text-center bg-background/60 border border-border/50 rounded-lg py-1.5 font-mono focus:outline-none focus:border-purple-400"
                />
              </label>
            </div>
          </div>
        ))}

        <button onClick={() => setPicking(true)} className="w-full py-3 rounded-2xl border border-dashed border-purple-500/40 text-purple-300 text-sm flex items-center justify-center gap-1 active:scale-[0.98] transition">
          <Plus size={14} /> 从动作库添加
        </button>
        {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
      </section>

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}
    </div>
  );
}
