import { useState } from 'react';
import { StoreProvider } from '@/store';
import TodayPage from '@/pages/TodayPage';
import SessionPage from '@/pages/SessionPage';
import ReviewPage from '@/pages/ReviewPage';
import LibraryPage from '@/pages/LibraryPage';
import PlanPage from '@/pages/PlanPage';
import type { Routine, TabKey } from '@/types';
import { Dumbbell, BarChart3, Library, ClipboardList } from 'lucide-react';

const TABS: { key: TabKey; label: string; icon: typeof Dumbbell }[] = [
  { key: 'today', label: '今日', icon: Dumbbell },
  { key: 'review', label: '复盘', icon: BarChart3 },
  { key: 'library', label: '动作库', icon: Library },
  { key: 'plan', label: '计划', icon: ClipboardList },
];

function Shell() {
  const [tab, setTab] = useState<TabKey>('today');
  const [session, setSession] = useState<Routine | null>(null);

  const startSession = (routine: Routine) => {
    setSession(routine);
    window.scrollTo(0, 0);
  };

  if (session) {
    return (
      <SessionPage
        routine={session}
        onFinish={() => {
          setSession(null);
          setTab('review');
        }}
      />
    );
  }

  return (
    <>
      {tab === 'today' && <TodayPage onStart={startSession} />}
      {tab === 'review' && <ReviewPage />}
      {tab === 'library' && <LibraryPage />}
      {tab === 'plan' && <PlanPage onStart={startSession} />}

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
    </StoreProvider>
  );
}
