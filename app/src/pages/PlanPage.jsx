import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { exerciseById } from '@/data/exerciseLibrary';
import { deleteRoutine, duplicateRoutine } from '@/db/repository';
import PlanEditor from '@/components/PlanEditor';
import { RefreshCcw, CalendarDays, Play, Plus, Pencil, Copy, Trash2 } from 'lucide-react';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 计划页（阶段三重写）：我的计划列表 + 新建 / 编辑 / 复制 / 删除（FR-PLAN-02）
 */
/** @param {{ onStart: (routine: import('@/types').Routine) => void }} props */
export default function PlanPage({ onStart }) {
  const { routines, settings } = useStore();
  const [nameMap, setNameMap] = useState({});
  const [editing, setEditing] = useState(null); // null=列表 'new'=新建 routine对象=编辑
  const [confirmDelete, setConfirmDelete] = useState(null); // 待确认删除的计划

  const cursor = Number(settings.rotationCursor ?? 0);
  const rotationRoutines = routines.filter((r) => r.mode === 'rotation');
  const nextId = rotationRoutines.length ? rotationRoutines[cursor % rotationRoutines.length].id : null;

  // 解析全部计划引用到的动作名
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(routines.flatMap((r) => r.items.map((it) => it.exerciseId)))];
    Promise.all(ids.map((id) => exerciseById(id))).then((list) => {
      if (!alive) return;
      setNameMap(Object.fromEntries(ids.map((id, i) => [id, list[i]?.nameZh ?? id])));
    });
    return () => {
      alive = false;
    };
  }, [routines]);

  if (editing) {
    return <PlanEditor routine={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  }

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header>
        <h1 className="text-2xl font-bold">训练<span className="text-gradient">计划</span></h1>
        <p className="text-xs text-muted-foreground mt-1">A / B / C 轮换，练完自动排到下一个</p>
      </header>

      {/* 我的计划 */}
      <section className="space-y-3">
        {routines.map((r) => {
          const next = r.id === nextId;
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
                    {r.mode === 'rotation' ? <RefreshCcw size={11} /> : <CalendarDays size={11} />}
                    {r.mode === 'rotation' ? '轮换模式' : `每${WEEKDAYS[r.weekday ?? 0]}`} · {r.items.length} 个动作
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
                  <span key={it.id ?? it.exerciseId} className="text-[10px] px-2 py-1 rounded-full bg-purple-500/10 text-purple-200/90 border border-purple-500/20">
                    {nameMap[it.exerciseId] ?? '…'} {it.targetSets}×{it.targetReps}
                  </span>
                ))}
              </div>
              {/* 编辑 / 复制 / 删除 */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
                <button onClick={() => setEditing(r)} className="flex-1 py-1.5 rounded-xl bg-background/60 border border-border/50 text-xs text-muted-foreground flex items-center justify-center gap-1 active:scale-[0.98] transition">
                  <Pencil size={12} /> 编辑
                </button>
                <button onClick={() => duplicateRoutine(r.id)} className="flex-1 py-1.5 rounded-xl bg-background/60 border border-border/50 text-xs text-muted-foreground flex items-center justify-center gap-1 active:scale-[0.98] transition">
                  <Copy size={12} /> 复制
                </button>
                <button onClick={() => setConfirmDelete(r)} className="flex-1 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center justify-center gap-1 active:scale-[0.98] transition">
                  <Trash2 size={12} /> 删除
                </button>
              </div>
            </div>
          );
        })}
        {routines.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">还没有计划，点击下方新建</p>
        )}
      </section>

      <button onClick={() => setEditing('new')} className="w-full py-3.5 rounded-2xl border border-dashed border-purple-500/40 text-purple-300 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
        <Plus size={15} /> 新建自定义计划
      </button>

      {/* 删除确认（覆盖式弹层） */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-[430px] m-3 rounded-3xl bg-card border border-border/60 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-center">
              删除计划「<span className="font-bold">{confirmDelete.name}</span>」？<br />
              <span className="text-xs text-muted-foreground">已完成的训练记录不受影响</span>
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl bg-background/60 border border-border/50 text-sm active:scale-[0.98] transition">
                取消
              </button>
              <button
                onClick={async () => {
                  await deleteRoutine(confirmDelete.id);
                  setConfirmDelete(null);
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
