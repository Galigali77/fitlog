import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { todayStr } from '@/db/repository';
import { exerciseById } from '@/data/exerciseLibrary';
import { Dumbbell, Flame, TrendingUp, ChevronRight, Settings, History } from 'lucide-react';

/** 今日页：「今天练什么」卡片 + 快捷统计 + 最近训练摘要（FR-PLAN-04） */
/** @param {{ onStart: (routine: import('@/types').Routine|null, date?: string|null) => void,
 *            onOpenSettings: () => void,
 *            draft?: object|null, onDiscardDraft?: () => void }} props */
export default function TodayPage({ onStart, onOpenSettings, draft = null, onDiscardDraft }) {
  const { ready, workouts, routines, settings } = useStore();
  const [nameMap, setNameMap] = useState({}); // exerciseId → 动作名（动作库异步加载）

  // 今天练什么：优先「绑定今天星期」的计划（FR-PLAN-03 模式①），否则按轮换游标取下一个（模式②）
  const rotationRoutines = routines.filter((r) => r.mode === 'rotation');
  const cursor = Number(settings.rotationCursor ?? 0);
  const todayWeekly = routines.find((r) => r.mode === 'weekly' && r.weekday === new Date().getDay());
  const routine = todayWeekly
    ?? (rotationRoutines.length ? rotationRoutines[cursor % rotationRoutines.length] : routines[0]);

  // 解析计划内动作名（动作库在 IndexedDB 之外，异步读一次）
  useEffect(() => {
    if (!routine) return undefined;
    let alive = true;
    Promise.all(routine.items.map((it) => exerciseById(it.exerciseId))).then((list) => {
      if (!alive) return;
      setNameMap(Object.fromEntries(routine.items.map((it, i) => [it.exerciseId, list[i]?.nameZh ?? it.exerciseId])));
    });
    return () => {
      alive = false;
    };
  }, [routine]);

  // 本周训练次数（周一起算）
  const thisWeek = (() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    // 必须按本地时区格式化：toISOString() 是 UTC，凌晨会把周一算成周日（时区错位 bug）
    const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    return workouts.filter((w) => w.date >= mondayStr).length;
  })();

  const recent = workouts.slice(0, 4);

  // 未完成的训练草稿：找到对应计划（可能已被删除，退化为自由训练）并统计已完成组数
  const draftRoutine = draft ? (routines.find((r) => r.id === draft.routineId) ?? null) : null;
  const draftDoneSets = (draft?.exercises?.reduce((n, ex) => n + (ex.sets?.filter((s) => s.done).length ?? 0), 0) ?? 0);

  // 仅数据未就绪时显示加载中；ready 但没有任何计划时走下方的空态页（不再卡死）
  if (!ready) {
    return <p className="px-5 pt-10 text-sm text-muted-foreground">数据加载中…</p>;
  }

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground tracking-widest">{todayStr()}</p>
          <h1 className="text-2xl font-bold mt-1">
            好好休息，<span className="text-gradient">好好训练</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-black text-gradient leading-none">{thisWeek}</p>
            <p className="text-[10px] text-muted-foreground mt-1">本周训练 / 次</p>
          </div>
          <button
            onClick={onOpenSettings}
            aria-label="设置"
            className="w-9 h-9 rounded-xl bg-card/70 border border-border/60 flex items-center justify-center text-muted-foreground active:scale-95 transition"
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      {/* 未完成的训练：记录页自动保存的草稿，点击继续（含补记日期） */}
      {draft && (
        <section className="rounded-3xl p-4 bg-gradient-to-br from-purple-600/25 to-transparent border border-purple-400/40 glow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/25 flex items-center justify-center text-purple-200 shrink-0">
            <History size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">未完成的训练 · {draft.routineName ?? '自由训练'}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {draft.date && draft.date !== todayStr() ? `补记 ${draft.date} · ` : ''}已记录 {draftDoneSets} 组
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onDiscardDraft?.()} className="px-3 py-2 rounded-xl bg-background/60 border border-border/50 text-xs text-muted-foreground active:scale-95 transition">
              放弃
            </button>
            <button onClick={() => onStart(draftRoutine, draft.date ?? null)} className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-xs font-bold glow-primary active:scale-[0.98] transition">
              继续训练
            </button>
          </div>
        </section>
      )}

      {/* 今天练什么（有计划）/ 空态引导（一个计划都没有） */}
      {routine ? (
        <section className="rounded-3xl p-5 glow-card bg-gradient-to-br from-[#2a1745] via-card to-card border border-purple-500/20 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple-600/25 blur-3xl" />
          <div className="flex items-center gap-2 text-purple-300 text-xs tracking-widest">
            <Flame size={14} />
            {todayWeekly
              ? `今天练什么 · 周${'日一二三四五六'[routine.weekday]}计划`
              : `今天练什么 · 轮换 ${String.fromCharCode(65 + (cursor % Math.max(1, rotationRoutines.length)))}`}
          </div>
          <h2 className="text-xl font-bold mt-2">{routine.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {routine.items.length} 个动作 · 预计 {routine.items.reduce((s, it) => s + it.targetSets, 0) * 3} 分钟
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {routine.items.map((it) => (
              <span key={it.id ?? it.exerciseId} className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/20">
                {nameMap[it.exerciseId] ?? '…'} ×{it.targetSets}
              </span>
            ))}
          </div>
          <button
            onClick={() => onStart(routine)}
            className="mt-5 w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 font-bold text-[15px] glow-primary active:scale-[0.98] transition"
          >
            开始训练
          </button>
        </section>
      ) : (
        <section className="rounded-3xl p-5 glow-card bg-gradient-to-br from-[#2a1745] via-card to-card border border-purple-500/20 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple-600/25 blur-3xl" />
          <div className="flex items-center gap-2 text-purple-300 text-xs tracking-widest">
            <Flame size={14} />
            还没有训练计划
          </div>
          <h2 className="text-xl font-bold mt-2">从第一次训练开始</h2>
          <p className="text-sm text-muted-foreground mt-1">
            到底部「计划」页创建你的第一个计划，或直接开始一次自由训练
          </p>
          <button
            onClick={() => onStart(null)}
            className="mt-5 w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 font-bold text-[15px] glow-primary active:scale-[0.98] transition"
          >
            开始自由训练
          </button>
        </section>
      )}

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 bg-card/70 border border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-300">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold">累计训练</p>
            <p className="text-xs text-purple-300 font-mono">{workouts.length} 次</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 bg-card/70 border border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-300">
            <Dumbbell size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold">休息计时</p>
            <p className="text-xs text-purple-300 font-mono">默认 {settings.restSeconds}s</p>
          </div>
        </div>
      </div>

      {/* 最近训练 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">最近训练</h3>
          <span className="text-xs text-muted-foreground">时间线见复盘页</span>
        </div>
        <div className="space-y-2.5">
          {recent.map((w) => (
            <div key={w.id} className="rounded-2xl px-4 py-3.5 bg-card/70 border border-border/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{w.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{w.date}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          ))}
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">还没有训练记录，点上方「开始训练」完成第一次</p>
          )}
        </div>
      </section>
    </div>
  );
}
