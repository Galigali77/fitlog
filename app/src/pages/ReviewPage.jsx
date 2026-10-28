import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store';
import { todayStr, exerciseHistory } from '@/db/repository';
import { describeDbError } from '@/ui/toast';
import { exerciseById } from '@/data/exerciseLibrary';
import { suggestOverload, parseTargetReps } from '@/domain/overload';
import { Camera, Lightbulb, User, BellRing } from 'lucide-react';

/** 训练热力图（FR-ANA-01）：近 15 周 GitHub 风格格子，按当日训练次数映射颜色 */
/** @param {{ workouts: { date: string }[] }} props */
function Heatmap({ workouts }) {
  const counts = new Map();
  workouts.forEach((w) => counts.set(w.date, (counts.get(w.date) ?? 0) + 1));
  const today = new Date();
  const days = [];
  const start = new Date(today);
  // 98 = 14 周：起点对齐到 14 周前的周一，15 列网格的最后一列恰为本周（含今天），未来日期走 future 分支
  start.setDate(today.getDate() - 98 - ((today.getDay() + 6) % 7));
  for (let i = 0; i < 105; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: key, count: counts.get(key) ?? 0, future: d > today });
  }
  const level = (c) => (c === 0 ? 'bg-purple-950/60' : c === 1 ? 'bg-purple-800/80' : c === 2 ? 'bg-purple-600' : 'bg-purple-400');
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

/** Blob → ObjectURL（URL 变化/组件卸载时释放，避免内存泄漏） */
function useBlobUrl(blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );
  return url;
}

// 身材占位图（未上传照片时的示意）
function PhotoPlaceholder({ label }) {
  return (
    <div className="gif-placeholder rounded-2xl aspect-[3/4] flex flex-col items-center justify-center border border-purple-500/25">
      <User size={26} className="text-purple-300/80 relative z-10" />
      <p className="text-[10px] text-purple-200/70 mt-1.5 tracking-widest relative z-10">{label}</p>
    </div>
  );
}

// 历史记录中的一张照片（Blob 渲染）
function HistoryPhoto({ blob, label }) {
  const url = useBlobUrl(blob);
  if (!url) return <PhotoPlaceholder label={label} />;
  return <img src={url} alt={label} className="rounded-xl w-full aspect-[3/4] object-cover border border-border/60" />;
}

// 上传位按钮（有预览则显示预览图）
/** @param {{ label: string, value: string|null, onPick: () => void }} props */
function PickBtn({ label, value, onPick }) {
  return value ? (
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
}

// 身材记录（FR-ANA-02）：每 15 天一组正面 + 背面照片，Blob 存 IndexedDB，仅存本机
function BodyRecord() {
  const { bodyPhotos, addBodyPhotos } = useStore();
  const [front, setFront] = useState(null); // 预览用 dataURL
  const [back, setBack] = useState(null);
  const frontFile = useRef(null); // 原始 File（Blob），保存时直存 IndexedDB
  const backFile = useRef(null);
  const [error, setError] = useState('');
  const frontRef = useRef(null);
  const backRef = useRef(null);

  const sorted = useMemo(() => [...bodyPhotos].sort((a, b) => b.date.localeCompare(a.date)), [bodyPhotos]);
  const lastDate = sorted[0]?.date;
  const daysLeft = useMemo(() => {
    if (!lastDate) return 0;
    const diff = Math.floor((new Date(todayStr()).getTime() - new Date(lastDate).getTime()) / 86400000);
    return Math.max(0, 15 - diff);
  }, [lastDate]);

  /** @param {File|undefined} file @param {(s: string) => void} setter @param {import('react').RefObject<File|null>} fileRef */
  const readFile = (file, setter, fileRef) => {
    if (!file) return;
    fileRef.current = file; // 保留 Blob 本体
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!frontFile.current || !backFile.current) {
      setError('身材记录需要至少正面和背面两张照片');
      return;
    }
    try {
      await addBodyPhotos({ date: todayStr(), front: frontFile.current, back: backFile.current });
    } catch (err) {
      // 写库失败（照片体积大，最易触发配额）：提示并保留已选照片
      setError(`保存失败：${describeDbError(err)}`);
      return;
    }
    frontFile.current = null;
    backFile.current = null;
    setFront(null);
    setBack(null);
    setError('');
  };

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
      <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], setFront, frontFile); e.target.value = ''; }} />
      <input ref={backRef} type="file" accept="image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0], setBack, backFile); e.target.value = ''; }} />
      {(front || back) && (
        <button onClick={save} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 font-bold text-sm glow-primary active:scale-[0.98] transition">
          保存本次身材记录
        </button>
      )}
      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}

      {/* 历史时间线（按日期倒序） */}
      {sorted.length > 0 && (
        <div className="mt-4 space-y-3">
          {sorted.map((p) => (
            <div key={p.id} className="flex gap-3">
              <div className="w-14 shrink-0 text-center">
                <p className="text-[11px] font-mono text-purple-300">{p.date.slice(5)}</p>
                <p className="text-[9px] text-muted-foreground">{p.date.slice(0, 4)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <HistoryPhoto blob={p.front} label="正面" />
                <HistoryPhoto blob={p.back} label="背面" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** 渐进超负荷建议（FR-ANA-03）：基于真实历史 + 计划目标次数区间 */
function useOverloadSuggestions() {
  const { routines, settings } = useStore();
  const [suggestions, setSuggestions] = useState([]);
  // 依赖键需覆盖目标组数/次数：改了 targetSets/targetReps 后建议必须重算
  const routineKey = routines
    .map((r) => `${r.id}:${r.items.map((it) => `${it.exerciseId}@${it.targetSets}x${it.targetReps}`).join(',')}`)
    .join('|');

  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const r of routines) {
        for (const it of r.items) {
          const { isAmrap, top } = parseTargetReps(it.targetReps);
          if (isAmrap || top <= 0) continue;
          const history = await exerciseHistory(it.exerciseId);
          if (history.length < (settings.capHits ?? 2)) continue;
          const s = suggestOverload({
            recentSessions: history.map((h) => h.sets),
            targetReps: it.targetReps,
            increment: it.increment ?? settings.incrementKg ?? 2.5,
            capHits: settings.capHits ?? 2,
          });
          if (s) {
            const meta = await exerciseById(it.exerciseId);
            out.push({
              ...s,
              routineId: r.id,
              exerciseId: it.exerciseId,
              exerciseName: meta?.nameZh ?? it.exerciseId,
              targetReps: it.targetReps,
            });
          }
        }
      }
      if (alive) setSuggestions(out);
    })();
    return () => {
      alive = false;
    };
    // settings 对象随 Dexie 订阅更新，纳入依赖保证配置变更后重算
  }, [routineKey, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  return suggestions;
}

export default function ReviewPage({ onOpenWorkout, onLogPast }) {
  const { workouts } = useStore();
  const suggestions = useOverloadSuggestions();
  const today = todayStr();

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header>
        <h1 className="text-2xl font-bold">训练<span className="text-gradient">复盘</span></h1>
        <p className="text-xs text-muted-foreground mt-1">数据只存在你的浏览器里</p>
      </header>

      {/* 超负荷建议 */}
      {suggestions.map((s) => (
        // 同一动作可能出现在多个计划里，key 用 routineId + exerciseId 组合避免撞车
        <section key={`${s.routineId}:${s.exerciseId}`} className="rounded-3xl p-4 bg-gradient-to-br from-purple-600/25 to-transparent border border-purple-400/30 glow-card flex gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/25 flex items-center justify-center text-purple-200 shrink-0">
            <Lightbulb size={18} />
          </div>
          <div>
            <p className="font-bold text-sm text-purple-100">渐进超负荷建议</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {s.exerciseName}：{s.reason}（当前 {s.currentWeight}kg，目标 {s.targetReps}），建议下次{' '}
              {s.kind === 'increase' ? '加重' : '减重'}{' '}
              <span className="text-purple-300 font-bold font-mono">→ {s.suggestedWeight}kg</span>。
            </p>
          </div>
        </section>
      ))}

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
        <p className="text-[10px] text-muted-foreground mt-2">近 15 周 · 共 {workouts.filter((w) => w.date <= today).length} 次训练</p>
      </section>

      {/* 身材记录（每 15 天一组，照片仅存本地） */}
      <BodyRecord />

      {/* 时间线（FR-ANA-06，倒序；点入查看/编辑明细，FR-LOG-09） */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">训练时间线</h3>
          <button onClick={onLogPast} className="text-xs px-3 py-1.5 rounded-full border border-purple-500/40 text-purple-300 active:scale-95 transition">
            ＋ 补记
          </button>
        </div>
        <div className="space-y-2.5">
          {workouts.slice(0, 8).map((w) => (
            <button key={w.id} onClick={() => onOpenWorkout(w.id)} className="w-full text-left rounded-2xl px-4 py-3 bg-card/70 border border-border/60 flex items-center justify-between active:scale-[0.98] transition">
              <div>
                <p className="font-semibold text-sm">{w.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {w.date} · {w.exercises?.length ?? 0} 个动作
                </p>
              </div>
              {w.date === today && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30">今天</span>
              )}
            </button>
          ))}
          {workouts.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">还没有训练记录</p>
          )}
        </div>
      </section>
    </div>
  );
}
