/**
 * Toast 渲染容器：固定在底部导航上方，圆角暗色气泡，自动消失。
 * 挂在 App 根部一次即可。
 */
import { useEffect, useState } from 'react';
import { subscribeToast } from '@/ui/toast';
import { AlertCircle } from 'lucide-react';

export default function ToastHost() {
  const [items, setItems] = useState([]); // { id, message }

  useEffect(
    () =>
      subscribeToast((item) => {
        setItems((prev) => [...prev.slice(-2), item]); // 最多同时 3 条
        window.setTimeout(() => {
          setItems((prev) => prev.filter((t) => t.id !== item.id));
        }, 4000);
      }),
    []
  );

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[380px] z-[80] space-y-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-2 rounded-2xl px-4 py-3 bg-[#2a1a3e]/95 border border-purple-500/40 shadow-lg text-sm text-purple-100"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-purple-300" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
