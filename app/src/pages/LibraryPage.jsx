import { useMemo, useState } from 'react';
import { EXERCISES, EQUIPMENTS, MUSCLES, exerciseById } from '@/data/exercises';
import { Search, X } from 'lucide-react';

// 按参考图布局：顶部搜索 + 左侧肌群竖栏 + 右侧器械筛选 + GIF 双列卡片
export default function LibraryPage() {
  const [keyword, setKeyword] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [equipment, setEquipment] = useState('全部');
  const [detailId, setDetailId] = useState(null);

  const list = useMemo(
    () =>
      EXERCISES.filter((e) => {
        if (keyword && !e.nameZh.includes(keyword) && !e.nameEn.toLowerCase().includes(keyword.toLowerCase())) return false;
        if (muscle && !e.muscles.includes(muscle)) return false;
        if (equipment !== '全部' && e.equipment !== equipment) return false;
        return true;
      }),
    [keyword, muscle, equipment]
  );

  // 动作详情（抽屉式全屏）
  if (detailId) {
    const ex = exerciseById(detailId);
    return (
      <div className="px-5 pt-5 pb-28 space-y-5">
        <button onClick={() => setDetailId(null)} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
          <X size={18} />
        </button>
        {/* GIF 演示区（正式版替换为 openGym 动图，见版权说明） */}
        <div className="gif-placeholder rounded-3xl h-64 flex items-center justify-center border border-purple-500/25 glow-card">
          <div className="text-center relative z-10">
            <p className="text-5xl">🏋️</p>
            <p className="text-xs text-purple-200/80 mt-2 tracking-widest">GIF 演示 · 循环播放</p>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{ex.nameZh}</h2>
          <p className="text-sm text-muted-foreground">{ex.nameEn}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {ex.muscles.map((m) => (
              <span key={m} className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/25">{m}</span>
            ))}
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border/60 text-muted-foreground">{ex.equipment} · {ex.type}</span>
          </div>
        </div>
        <section className="rounded-3xl p-4 bg-card/80 border border-border/60">
          <h3 className="font-bold text-sm mb-2">动作要领</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{ex.desc}</p>
        </section>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed px-1">
          媒体版权声明（正式版）：动作演示动图 © Aliaksandr Makatserchyk / Gym Visual，经 openGym 项目非商业授权使用。
        </p>
      </div>
    );
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
            placeholder="输入动作名字搜索"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex items-start gap-3 mt-4 px-5">
        {/* 左侧肌群竖栏（参考图样式，选中项左侧紫色竖条） */}
        <aside className="sticky top-4 w-[68px] shrink-0 max-h-[calc(100dvh-190px)] overflow-y-auto no-scrollbar rounded-2xl bg-card/60 border border-border/50 py-2">
          {[{ name: '全部', value: null }, ...MUSCLES.map((m) => ({ name: m, value: m }))].map((item) => {
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
            {EQUIPMENTS.map((eq) => (
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

          {/* GIF 双列卡片 */}
          <div className="grid grid-cols-2 gap-3">
            {list.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setDetailId(ex.id)}
                className="text-left rounded-2xl overflow-hidden bg-card/80 border border-border/60 active:scale-[0.97] transition glow-card"
              >
                {/* GIF 演示位（占位动画，正式版为 openGym 动图循环播放） */}
                <div className="gif-placeholder relative aspect-square flex items-center justify-center">
                  <span className="absolute left-0 top-0 z-10 text-[10px] px-2 py-0.5 rounded-br-xl bg-gradient-to-r from-purple-500 to-violet-600 text-primary-foreground font-medium">
                    讲解
                  </span>
                  <span className="text-3xl relative z-10">🏋️</span>
                  <span className="absolute bottom-1.5 right-1.5 z-10 text-[9px] px-1.5 py-0.5 rounded-md bg-black/50 text-purple-200/90 font-mono border border-purple-400/20">
                    GIF
                  </span>
                </div>
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
          <p className="text-[10px] text-muted-foreground/60 mt-4 leading-relaxed">
            16 个演示动作 · 正式版 3000+（openGym 数据）
          </p>
        </main>
      </div>
    </div>
  );
}
