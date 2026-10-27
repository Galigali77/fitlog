import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from '@/store';
import TodayPage from '@/pages/TodayPage';
import SessionPage from '@/pages/SessionPage';
import ReviewPage from '@/pages/ReviewPage';
import LibraryPage from '@/pages/LibraryPage';
import PlanPage from '@/pages/PlanPage';
import WorkoutDetailPage from '@/pages/WorkoutDetailPage';
import SettingsPage from '@/pages/SettingsPage';
import ToastHost from '@/components/ToastHost';
import { todayStr, loadDraft, clearDraft } from '@/db/repository';
import { Dumbbell, BarChart3, Library, ClipboardList, X } from 'lucide-react';

const TABS = [
  { key: 'today', label: '今日', icon: Dumbbell },
  { key: 'review', label: '复盘', icon: BarChart3 },
  { key: 'library', label: '动作库', icon: Library },
  { key: 'plan', label: '计划', icon: ClipboardList },
];

/**
 * 补记底部弹层：选日期 + 选计划（或自由训练）后进入记录页（FR-LOG-09 事后补记）
 * @param {{ onPick: (session: { routine: import('@/types').Routine|null, date: string }) => void,
 *           onClose: () => void }} props
 */
function LogPastSheet({ onPick, onClose }) {
  const { routines } = useStore();
  const [date, setDate] = useState(todayStr());
  const [routineId, setRoutineId] = useState('free');

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-[430px] m-3 rounded-3xl bg-card border border-border/60 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">补记历史训练</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-background/60 border border-border/50 flex items-center justify-center active:scale-95 transition">
            <X size={15} />
          </button>
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">训练日期</span>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-full bg-background/60 border border-border/60 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-purple-400 [color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">使用计划</span>
          <select
            value={routineId}
            onChange={(e) => setRoutineId(e.target.value)}
            className="mt-1.5 w-full bg-background/60 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
          >
            <option value="free">自由训练（手动添加动作）</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => onPick({ routine: routines.find((r) => r.id === routineId) ?? null, date })}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 font-bold text-sm glow-primary active:scale-[0.98] transition"
        >
          开始补记
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState('today');
  const [session, setSession] = useState(null); // { routine, date? } 进行中的训练/补记
  const [workoutId, setWorkoutId] = useState(null); // 训练详情
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logPastOpen, setLogPastOpen] = useState(false);
  const [draft, setDraft] = useState(null); // 未完成的训练草稿（记录页自动保存）

  // 切回今日页时刷新草稿（结束/放弃训练后卡片自动消失）
  useEffect(() => {
    if (tab !== 'today') return undefined;
    let alive = true;
    loadDraft().then((d) => {
      if (alive) setDraft(d);
    });
    return () => {
      alive = false;
    };
  }, [tab]);

  const startSession = (routine, date = null) => {
    setSession({ routine, date });
    window.scrollTo(0, 0);
  };

  /** 放弃草稿：清除持久化的未完成训练 */
  const discardDraft = async () => {
    await clearDraft();
    setDraft(null);
  };

  // 记录页（正常训练 / 补记 / 自由训练）
  if (session) {
    return (
      <SessionPage
        routine={session.routine}
        date={session.date ?? undefined}
        onFinish={() => {
          setSession(null);
          setTab('review');
        }}
      />
    );
  }

  // 训练详情（查看 / 编辑 / 删除）
  if (workoutId) {
    return <WorkoutDetailPage workoutId={workoutId} onClose={() => setWorkoutId(null)} onDeleted={() => setWorkoutId(null)} />;
  }

  // 设置页
  if (settingsOpen) {
    return <SettingsPage onClose={() => setSettingsOpen(false)} />;
  }

  return (
    <>
      {tab === 'today' && (
        <TodayPage
          onStart={startSession}
          onOpenSettings={() => setSettingsOpen(true)}
          draft={draft}
          onDiscardDraft={discardDraft}
        />
      )}
      {tab === 'review' && (
        <ReviewPage
          onOpenWorkout={(id) => {
            setWorkoutId(id);
            window.scrollTo(0, 0);
          }}
          onLogPast={() => setLogPastOpen(true)}
        />
      )}
      {tab === 'library' && <LibraryPage />}
      {tab === 'plan' && <PlanPage onStart={startSession} />}

      {logPastOpen && (
        <LogPastSheet
          onPick={(s) => {
            setLogPastOpen(false);
            setSession(s);
            window.scrollTo(0, 0);
          }}
          onClose={() => setLogPastOpen(false)}
        />
      )}

      {/* 底部导航：4 个入口，符合需求 5.1 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
        <div className="mx-3 mb-3 rounded-3xl bg-[#150b26]/90 backdrop-blur-xl border border-purple-500/20 flex justify-around py-2">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  window.scrollTo(0, 0);
                }}
                className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl transition active:scale-95"
              >
                <Icon size={20} className={active ? 'text-purple-400' : 'text-muted-foreground/60'} strokeWidth={active ? 2.4 : 2} />
                <span className={`text-[10px] ${active ? 'text-purple-300 font-semibold' : 'text-muted-foreground/60'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      {/* 手机宽度容器：桌面预览时居中显示 */}
      <div className="min-h-screen w-full max-w-[430px] mx-auto relative border-x border-purple-500/10">
        <Shell />
      </div>
      {/* 全局写操作失败提示（toast 事件总线的渲染端） */}
      <ToastHost />
    </StoreProvider>
  );
}
