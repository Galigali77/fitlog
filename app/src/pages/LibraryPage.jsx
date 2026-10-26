import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  loadAllExercises,
  filterExercises,
  musclesOf,
  equipmentsOf,
  stillUrl,
  clipUrl,
} from '@/data/exerciseLibrary';
import { Search, X } from 'lucide-react';

/** 稳定的空数组引用（useLiveQuery 加载中占位，避免下游 useMemo 反复失效） */
const EMPTY_LIST = [];

/**
 * 动作卡片媒体：列表页只加载静帧（首帧缩略图），进入视口才挂载 <img>（技术方案 5.5）
 * @param {{ id: string, nameZh: string, hasMedia: boolean }} props
 */
function CardMedia({ id, nameZh, hasMedia }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMedia) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setVisible(true),
      { rootMargin: '200px' } // 提前 200px 预载，滚动更跟手
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMedia]);

  return (
    <div ref={ref} className="gif-placeholder relative aspect-square flex items-center justify-center overflow-hidden">
      {visible && hasMedia ? (
        <img src={stillUrl(id)} alt={nameZh} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="text-3xl relative z-10">🏋️</span>
      )}
      {hasMedia && (
        <span className="absolute bottom-1.5 right-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded-md bg-black/50 text-purple-200/90 font-mono border border-purple-400/20">
          演示
        </span>
      )}
    </div>
  );
}

/**
 * 动作库页（阶段二）：顶部搜索 + 左侧肌群竖栏 + 器械筛选 + 双列卡片
 * 数据源：public/exercises/index.json（openGym 3000+）+ IndexedDB 自定义动作
 */
export default function LibraryPage() {
  const [keyword, setKeyword] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [equipment, setEquipment] = useState('全部');
  const [detail, setDetail] = useState(null); // 详情页动作对象
  const [builtin, setBuiltin] = useState(null); // null = 加载中
  // 自定义动作存 IndexedDB，订阅其变更自动合并
  const custom = useLiveQuery(() => db.customExercises.toArray(), []) ?? EMPTY_LIST;

  useEffect(() => {
    let alive = true;
    loadAllExercises().then((list) => alive && setBuiltin(list));
    return () => {
      alive = false;
    };
  }, []);

  // 内置 + 自定义合并（自定义置顶）
  const all = useMemo(() => {
    if (!builtin) return [];
    const customIds = new Set(custom.map((c) => c.id));
    return [...custom.map((c) => ({ ...c, custom: true })), ...builtin.filter((e) => !customIds.has(e.id))];
  }, [builtin, custom]);

  const muscles = useMemo(() => musclesOf(all), [all]);
  const equipments = useMemo(() => equipmentsOf(all), [all]);
  const list = useMemo(
    () => filterExercises(all, { keyword, muscle, equipment }),
    [all, keyword, muscle, equipment]
  );

  if (builtin === null) {
    return <p className="px-5 pt-10 text-sm text-muted-foreground">动作库加载中…</p>;
  }

  // 动作详情（抽屉式全屏）：动画循环播放，可暂停（FR-EX-07）
  if (detail) {
    return <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />;
  }

  return (
    <div className="pt-6 pb-28">
      {/* 顶部：标题 + 搜索框 */}
      <div className="px-5">
        <h1 className="text-2xl font-bold">动作<span className="text-gradient">库</span></h1>
        <div className="flex items-center gap-2 rounded-2xl px-4 py-3 mt-3 bg-card/80 border border-border/60 focus-within:border-purple-400/60 transition">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入动作名字搜索（中/英）"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex items-start gap-3 mt-4 px-5">
        {/* 左侧肌群竖栏（选中项左侧紫色竖条） */}
        <aside className="sticky top-4 w-[68px] shrink-0 max-h-[calc(100dvh-190px)] overflow-y-auto no-scrollbar rounded-2xl bg-card/60 border border-border/50 py-2">
          {[{ name: '全部', value: null }, ...muscles.map((m) => ({ name: m, value: m }))].map((item) => {
            const active = muscle === item.value;
            return (
              <button
                key={item.name}
                onClick={() => setMuscle(item.value)}
                className={`relative w-full py-2.5 text-[12px] text-center transition active:scale-95 ${
                  active ? 'text-purple-200 font-bold bg-purple-500/10' : 'text-muted-foreground'
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-purple-400 to-violet-600" />}
                {item.name}
              </button>
            );
          })}
        </aside>

        {/* 右侧内容 */}
        <main className="flex-1 min-w-0">
          {/* 器械筛选 chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
            {equipments.map((eq) => (
              <button
                key={eq}
                onClick={() => setEquipment(eq)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition active:scale-95 ${
                  equipment === eq
                    ? 'bg-gradient-to-r from-purple-500 to-violet-600 border-transparent text-primary-foreground'
                    : 'bg-card/70 border-border/60 text-muted-foreground'
                }`}
              >
                {eq}
              </button>
            ))}
          </div>

          {/* 双列卡片（静帧懒加载） */}
          <div className="grid grid-cols-2 gap-3">
            {list.slice(0, 200).map((ex) => (
              <button
                key={ex.id}
                onClick={() => setDetail(ex)}
                className="text-left rounded-2xl overflow-hidden bg-card/80 border border-border/60 active:scale-[0.97] transition glow-card"
              >
                <CardMedia id={ex.id} nameZh={ex.nameZh} hasMedia={!!ex.hasMedia} />
                <div className="px-3 py-2.5">
                  <p className="font-semibold text-[13px] leading-snug">{ex.nameZh}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {ex.muscles[0]} · {ex.equipment}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {list.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">没有匹配的动作</p>
          )}
          {list.length > 200 && (
            <p className="text-[10px] text-muted-foreground mt-3 text-center">已显示前 200 条，请用搜索或筛选缩小范围</p>
          )}
          <p className="text-[10px] text-muted-foreground/60 mt-4 leading-relaxed">
            共 {all.length} 个动作 · 数据来源 openGym
          </p>
        </main>
      </div>
    </div>
  );
}

/**
 * 动作详情页：openGym 演示动画（循环静音播放，点按可暂停）+ 文字要领 + 版权声明
 * @param {{ exercise: import('@/types').Exercise, onClose: () => void }} props
 */
function ExerciseDetail({ exercise, onClose }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="px-5 pt-5 pb-28 space-y-5">
      <button onClick={onClose} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
        <X size={18} />
      </button>

      {/* 演示区：有动画播动画（原样使用，未修改），无动画用文字要领兜底 */}
      {exercise.hasMedia ? (
        <button onClick={togglePlay} className="block w-full rounded-3xl overflow-hidden border border-purple-500/25 glow-card bg-black/40">
          <video
            ref={videoRef}
            src={clipUrl(exercise.id)}
            poster={stillUrl(exercise.id)}
            className="w-full aspect-square object-contain"
            autoPlay
            loop
            muted
            playsInline
          />
          <p className="text-[10px] text-purple-200/70 py-1.5 bg-background/70">{playing ? '点按暂停' : '点按播放'}</p>
        </button>
      ) : (
        <div className="gif-placeholder rounded-3xl h-64 flex items-center justify-center border border-purple-500/25 glow-card">
          <div className="text-center relative z-10">
            <p className="text-5xl">🏋️</p>
            <p className="text-xs text-purple-200/80 mt-2 tracking-widest">暂无演示动画，参考下方文字要领</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold">{exercise.nameZh}</h2>
        <p className="text-sm text-muted-foreground">{exercise.nameEn}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {exercise.muscles.map((m) => (
            <span key={m} className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/25">{m}</span>
          ))}
          {(exercise.secondaryMuscles ?? []).map((m) => (
            <span key={m} className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border/60 text-muted-foreground">协同 · {m}</span>
          ))}
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border/60 text-muted-foreground">{exercise.equipment} · {exercise.type}</span>
        </div>
      </div>

      <section className="rounded-3xl p-4 bg-card/80 border border-border/60">
        <h3 className="font-bold text-sm mb-2">动作要领</h3>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{exercise.desc}</p>
      </section>

      {exercise.hasMedia && (
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed px-1">
          动作演示媒体 © Aliaksandr Makatserchyk / Gym Visual，经 openGym 项目授权仅限非商业用途原样使用。
        </p>
      )}
    </div>
  );
}
