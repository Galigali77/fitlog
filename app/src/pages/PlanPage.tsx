import { ROUTINES, TEMPLATES, exerciseById } from '@/data/exercises';
import { useStore } from '@/store';
import type { Routine } from '@/types';
import { CalendarDays, RefreshCcw, Share2, Play } from 'lucide-react';

interface Props {
  onStart: (routine: Routine) => void;
}

export default function PlanPage({ onStart }: Props) {
  const { workouts } = useStore();

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header>
        <h1 className="text-2xl font-bold">训练<span className="text-gradient">计划</span></h1>
        <p className="text-xs text-muted-foreground mt-1">A / B / C 轮换，练完自动排到下一个</p>
      </header>

      {/* 我的轮换计划 */}
      <section className="space-y-3">
        {ROUTINES.map((r, i) => {
          const next = workouts.length % ROUTINES.length === i;
          return (
            <div
              key={r.id}
              className={`rounded-3xl p-4 border transition ${
                next ? 'bg-gradient-to-br from-purple-600/20 to-transparent border-purple-400/40 glow-card' : 'bg-card/70 border-border/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    {r.name}
                    {next && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 border border-purple-400/40 text-purple-100">下一个</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <RefreshCcw size={11} /> 轮换模式 · {r.items.length} 个动作
                  </p>
                </div>
                <button
                  onClick={() => onStart(r)}
                  className="w-10 h-10 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center glow-primary active:scale-95 transition"
                >
                  <Play size={16} className="text-primary-foreground" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {r.items.map((it) => (
                  <span key={it.exerciseId} className="text-[10px] px-2 py-1 rounded-full bg-purple-500/10 text-purple-200/90 border border-purple-500/20">
                    {exerciseById(it.exerciseId).nameZh} {it.targetSets}×{it.targetReps}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* 内置模板 */}
      <section>
        <h3 className="font-bold text-sm mb-3">内置模板</h3>
        <div className="space-y-2.5">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-2xl px-4 py-3.5 bg-card/70 border border-border/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <CalendarDays size={11} />
                  {t.mode === 'weekly' ? '按星期' : '轮换'} · {t.items.length || '多套组合'} 个动作
                </p>
              </div>
              <button className="text-xs px-3 py-1.5 rounded-full border border-purple-500/40 text-purple-300 active:scale-95 transition flex items-center gap-1">
                <Share2 size={11} /> 采用
              </button>
            </div>
          ))}
        </div>
      </section>

      <button className="w-full py-3.5 rounded-2xl border border-dashed border-purple-500/40 text-purple-300 text-sm font-medium active:scale-[0.98] transition">
        ＋ 新建自定义计划
      </button>
    </div>
  );
}
