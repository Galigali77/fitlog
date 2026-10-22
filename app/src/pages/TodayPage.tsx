import { useStore } from '@/store';
import { ROUTINES, exerciseById } from '@/data/exercises';
import { todayStr } from '@/data/history';
import type { Routine } from '@/types';
import { Dumbbell, Flame, TrendingUp, ChevronRight } from 'lucide-react';

interface Props {
  onStart: (routine: Routine) => void;
}

export default function TodayPage({ onStart }: Props) {
  const { workouts } = useStore();
  // 轮换模式：找到下一次该练的轮换位置（原型按已完成次数取模）
  const doneCount = workouts.filter((w) => w.date === todayStr).length;
  const routine = ROUTINES[(workouts.length + doneCount) % ROUTINES.length];

  const thisWeek = (() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const mondayStr = monday.toISOString().slice(0, 10);
    return workouts.filter((w) => w.date >= mondayStr).length;
  })();

  const recent = workouts.slice(0, 4);

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground tracking-widest">{todayStr}</p>
          <h1 className="text-2xl font-bold mt-1">
            好好休息，<span className="text-gradient">好好训练</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-gradient leading-none">{thisWeek}</p>
          <p className="text-[10px] text-muted-foreground mt-1">本周训练 / 次</p>
        </div>
      </header>

      {/* 今天练什么 */}
      <section className="rounded-3xl p-5 glow-card bg-gradient-to-br from-[#2a1745] via-card to-card border border-purple-500/20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple-600/25 blur-3xl" />
        <div className="flex items-center gap-2 text-purple-300 text-xs tracking-widest">
          <Flame size={14} />
          今天练什么 · 轮换 {String.fromCharCode(65 + (workouts.length % 3))}
        </div>
        <h2 className="text-xl font-bold mt-2">{routine.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {routine.items.length} 个动作 · 预计 50 分钟
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {routine.items.map((it) => (
            <span key={it.exerciseId} className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/20">
              {exerciseById(it.exerciseId).nameZh} ×{it.targetSets}
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

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 bg-card/70 border border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-300">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold">深蹲 e1RM</p>
            <p className="text-xs text-purple-300 font-mono">85.5 kg ↑</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 bg-card/70 border border-border/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-300">
            <Dumbbell size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold">连续训练</p>
            <p className="text-xs text-purple-300 font-mono">第 {Math.min(workouts.length, 99)} 次</p>
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
        </div>
      </section>
    </div>
  );
}
