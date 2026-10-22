import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/store';
import { BENCH_HISTORY, EXERCISE_MUSCLE_MAP, todayStr } from '@/data/history';
import { MUSCLES } from '@/data/exercises';
import type { BodyPhoto } from '@/types';
import { Camera, Lightbulb, User, BellRing } from 'lucide-react';

// 最近 15 周训练热力图
function Heatmap({ workouts }: { workouts: { date: string }[] }) {
  const counts = new Map<string, number>();
  workouts.forEach((w) => counts.set(w.date, (counts.get(w.date) ?? 0) + 1));
  const today = new Date();
  const days: { date: string; count: number; future: boolean }[] = [];
  const start = new Date(today);
  start.setDate(today.getDate() - 104 - ((today.getDay() + 6) % 7)); // 对齐到周一
  for (let i = 0; i < 105; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: counts.get(key) ?? 0, future: d > today });
  }
  const level = (c: number) => (c === 0 ? 'bg-purple-950/60' : c === 1 ? 'bg-purple-800/80' : c === 2 ? 'bg-purple-600' : 'bg-purple-400');
  return (
    <div className="grid grid-rows-7 grid-flow-col gap-[3px] overflow-x-auto no-scrollbar py-1">
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.date} · ${d.count} 次`}
          className={`w-full min-w-[13px] aspect-square rounded-[3px] ${d.future ? 'bg-transparent' : level(d.count)}`}
        />
      ))}
    </div>
  );
}

// 身材占位图（未上传照片时的示意）
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="gif-placeholder rounded-2xl aspect-[3/4] flex flex-col items-center justify-center border border-purple-500/25">
      <User size={26} className="text-purple-300/80 relative z-10" />
      <p className="text-[10px] text-purple-200/70 mt-1.5 tracking-widest relative z-10">{label}</p>
    </div>
  );
}

// 身材记录：每 15 天一组正面 + 背面照片
function BodyRecord() {
  const { bodyPhotos, addBodyPhotos } = useStore();
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [error, setError] = useState('');
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => [...bodyPhotos].sort((a, b) => b.date.localeCompare(a.date)), [bodyPhotos]);
  const lastDate = sorted[0]?.date;
  const daysLeft = useMemo(() => {
    if (!lastDate) return 0;
    const diff = Math.floor((new Date(todayStr).getTime() - new Date(lastDate).getTime()) / 86400000);
    return Math.max(0, 15 - diff);
  }, [lastDate]);

  const readFile = (file: File | undefined, setter: (s: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!front || !back) {
      setError('身材记录需要至少正面和背面两张照片');
      return;
    }
    addBodyPhotos({ id: `bp-${Date.now()}`, date: todayStr, front, back });
    setFront(null);
    setBack(null);
    setError('');
  };

  const PickBtn = ({ label, value, onPick }: { label: string; value: string | null; onPick: () => void }) =>
    value ? (
      <button onClick={onPick} className="rounded-2xl overflow-hidden border border-purple-400/40 active:scale-[0.98] transition">
        <img src={value} alt={label} className="w-full aspect-[3/4] object-cover" />
        <p className="text-[10px] text-purple-300 py-1 bg-background/80">重新选择{label}</p>
      </button>
    ) : (
      <button onClick={onPick} className="rounded-2xl aspect-[3/4] border-2 border-dashed border-purple-500/40 flex flex-col items-center justify-center gap-1.5 text-purple-300 active:scale-[0.98] transition">
        <Camera size={20} />
        <span className="text-xs">上传{label}</span>
      </button>
    );

  return (
    <section className="rounded-3xl p-4 bg-card/80 border border-border/60 glow-card">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm">身材记录</h3>
        <span className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 ${
          daysLeft === 0
            ? 'bg-purple-500/25 border-purple-400/40 text-purple-100'
            : 'bg-card border-border/60 text-muted-foreground'
        }`}>
          <BellRing size={10} />
          {daysLeft === 0 ? '今天该记录身材了' : `距下次记录还有 ${daysLeft} 天`}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">每 15 天一次 · 至少正面 + 背面 · 照片只存本机</p>

      {/* 新的记录 */}
      <div className="grid grid-cols-2 gap-3">
        <PickBtn label="正面" value={front} onPick={() => frontRef.current?.click()} />
        <PickBtn label="背面" value={back} onPick={() => backRef.current?.click()} />
      </div>
      <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], setFront); e.target.value = ''; }} />
      <input ref={backRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], setBack); e.target.value = ''; }} />
      {(front || back) && (
        <button onClick={save} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 font-bold text-sm glow-primary active:scale-[0.98] transition">
          保存本次身材记录
        </button>
      )}
      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}

      {/* 历史时间线 */}
      {sorted.length > 0 && (
        <div className="mt-4 space-y-3">
          {sorted.map((p: BodyPhoto) => (
            <div key={p.id} className="flex gap-3">
              <div className="w-14 shrink-0 text-center">
                <p className="text-[11px] font-mono text-purple-300">{p.date.slice(5)}</p>
                <p className="text-[9px] text-muted-foreground">{p.date.slice(0, 4)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                {p.front ? <img src={p.front} alt="正面" className="rounded-xl w-full aspect-[3/4] object-cover border border-border/60" /> : <PhotoPlaceholder label="正面" />}
                {p.back ? <img src={p.back} alt="背面" className="rounded-xl w-full aspect-[3/4] object-cover border border-border/60" /> : <PhotoPlaceholder label="背面" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ReviewPage() {
  const { workouts } = useStore();

  // 肌肉群覆盖（近 30 天）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);
  const coverage = new Map<string, number>();
  workouts.filter((w) => w.date >= since).forEach((w) => {
    (EXERCISE_MUSCLE_MAP[w.title] ?? []).forEach((m) => coverage.set(m, (coverage.get(m) ?? 0) + 1));
  });
  const maxCount = Math.max(1, ...coverage.values());

  // 超负荷建议：平板卧推连续两次达到次数上限 10
  const hitCap = BENCH_HISTORY.length >= 2 && BENCH_HISTORY.slice(-2).every((b) => b.reps >= 10);

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header>
        <h1 className="text-2xl font-bold">训练<span className="text-gradient">复盘</span></h1>
        <p className="text-xs text-muted-foreground mt-1">数据只存在你的浏览器里</p>
      </header>

      {/* 超负荷建议 */}
      {hitCap && (
        <section className="rounded-3xl p-4 bg-gradient-to-br from-purple-600/25 to-transparent border border-purple-400/30 glow-card flex gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/25 flex items-center justify-center text-purple-200 shrink-0">
            <Lightbulb size={18} />
          </div>
          <div>
            <p className="font-bold text-sm text-purple-100">渐进超负荷建议</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              平板卧推已连续 2 次达到次数上限（50kg × 10），建议下次加重{' '}
              <span className="text-purple-300 font-bold font-mono">+2.5kg → 52.5kg</span>，目标回到 8 次区间。
            </p>
          </div>
        </section>
      )}

      {/* 热力图 */}
      <section className="rounded-3xl p-4 bg-card/80 border border-border/60 glow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">训练热力图</h3>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            少
            <span className="inline-flex gap-[3px]">
              <i className="w-2.5 h-2.5 rounded-[2px] bg-purple-950/60 inline-block" />
              <i className="w-2.5 h-2.5 rounded-[2px] bg-purple-800/80 inline-block" />
              <i className="w-2.5 h-2.5 rounded-[2px] bg-purple-600 inline-block" />
              <i className="w-2.5 h-2.5 rounded-[2px] bg-purple-400 inline-block" />
            </span>
            多
          </span>
        </div>
        <Heatmap workouts={workouts} />
        <p className="text-[10px] text-muted-foreground mt-2">近 15 周 · 共 {workouts.filter((w) => w.date <= todayStr).length} 次训练</p>
      </section>

      {/* 身材记录（替代原进步曲线） */}
      <BodyRecord />

      {/* 肌肉覆盖 */}
      <section className="rounded-3xl p-4 bg-card/80 border border-border/60 glow-card">
        <h3 className="font-bold text-sm mb-3">肌肉覆盖 · 近 30 天</h3>
        <div className="space-y-2.5">
          {MUSCLES.map((m) => {
            const c = coverage.get(m) ?? 0;
            const pct = (c / maxCount) * 100;
            return (
              <div key={m} className="flex items-center gap-3">
                <span className={`w-14 text-xs ${c === 0 ? 'text-muted-foreground/60' : ''}`}>{m}</span>
                <div className="flex-1 h-2 rounded-full bg-purple-950/70 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c === 0 ? 'bg-transparent' : 'bg-gradient-to-r from-purple-600 to-purple-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[10px] font-mono text-muted-foreground">
                  {c === 0 ? '冷落' : `${c}次`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 时间线 */}
      <section>
        <h3 className="font-bold text-sm mb-3">训练时间线</h3>
        <div className="space-y-2.5">
          {workouts.slice(0, 8).map((w) => (
            <div key={w.id} className="rounded-2xl px-4 py-3 bg-card/70 border border-border/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{w.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{w.date}</p>
              </div>
              {w.date === todayStr && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30">今天</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
