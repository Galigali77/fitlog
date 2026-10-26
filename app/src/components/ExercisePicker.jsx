import { useEffect, useMemo, useState } from 'react';
import { loadAllExercises, filterExercises, musclesOf } from '@/data/exerciseLibrary';
import { Search, X } from 'lucide-react';

/**
 * 动作选择器（计划编辑器用）：全屏弹层，搜索 + 肌群筛选，点选返回动作
 * @param {{ onPick: (exercise: import('@/types').Exercise) => void, onClose: () => void }} props
 */
export default function ExercisePicker({ onPick, onClose }) {
  const [all, setAll] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [muscle, setMuscle] = useState(null);

  useEffect(() => {
    let alive = true;
    loadAllExercises().then((list) => alive && setAll(list));
    return () => {
      alive = false;
    };
  }, []);

  const muscles = useMemo(() => musclesOf(all ?? []), [all]);
  const list = useMemo(
    () => filterExercises(all ?? [], { keyword, muscle }),
    [all, keyword, muscle]
  );

  return (
    <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur flex flex-col max-w-[430px] mx-auto">
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">添加动作</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-2xl px-4 py-3 bg-card/80 border border-border/60 focus-within:border-purple-400/60 transition">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索动作（中/英）"
            autoFocus
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[{ name: '全部', value: null }, ...muscles.slice(0, 12).map((m) => ({ name: m, value: m }))].map((item) => (
            <button
              key={item.name}
              onClick={() => setMuscle(item.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition active:scale-95 ${
                muscle === item.value
                  ? 'bg-gradient-to-r from-purple-500 to-violet-600 border-transparent text-primary-foreground'
                  : 'bg-card/70 border-border/60 text-muted-foreground'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {all === null && <p className="text-sm text-muted-foreground py-10 text-center">动作库加载中…</p>}
        <div className="space-y-2">
          {(list ?? []).slice(0, 100).map((ex) => (
            <button
              key={ex.id}
              onClick={() => onPick(ex)}
              className="w-full text-left rounded-2xl px-4 py-3 bg-card/70 border border-border/60 active:scale-[0.98] transition"
            >
              <p className="font-semibold text-sm">{ex.nameZh}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ex.muscles.join(' / ')} · {ex.equipment}
              </p>
            </button>
          ))}
        </div>
        {list && list.length > 100 && (
          <p className="text-[10px] text-muted-foreground mt-3 text-center">匹配 {list.length} 条，仅显示前 100，请继续输入关键词</p>
        )}
        {list && list.length === 0 && (
          <p className="text-sm text-muted-foreground py-10 text-center">没有匹配的动作</p>
        )}
      </div>
    </div>
  );
}
