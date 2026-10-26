import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { exportJSON, exportCSV, importJSON } from '@/db/backup';
import { ArrowLeft, Download, Upload, FileSpreadsheet, Info, Smartphone, HardDrive } from 'lucide-react';

/** 数值设置行（定义在组件外，避免每次渲染重建类型导致输入框失焦） */
function NumberRow({ label, hint, value, min, max, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="w-20 text-center bg-background/60 border border-border/60 rounded-lg py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
      />
    </div>
  );
}

/**
 * 设置页（阶段三：FR-DATA-02/03/04 + 设置项持久化 + PWA 安装引导 + 版权关于）
 * 入口为今日页右上角齿轮（主界面保持 4 个 Tab，需求 5.1）。
 * @param {{ onClose: () => void }} props
 */
export default function SettingsPage({ onClose }) {
  const { settings, updateSetting } = useStore();
  const [message, setMessage] = useState('');
  const [storage, setStorage] = useState(null); // { usage, quota }
  const importRef = useRef(null);

  // 存储占用（技术方案第 7 章：超过 80% 提示导出清理）
  useEffect(() => {
    navigator.storage?.estimate?.().then(setStorage).catch(() => {});
  }, []);

  const storagePct = storage?.quota ? Math.round((storage.usage / storage.quota) * 100) : null;

  /** 导入备份：读文件 → 解析 → 校验 → 全量覆盖恢复 */
  const onImportFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      await importJSON(JSON.parse(text));
      setMessage('导入成功，数据已恢复');
    } catch (err) {
      setMessage(`导入失败：${err.message}`);
    }
  };

  return (
    <div className="px-5 pt-5 pb-28 space-y-5">
      <header className="flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-card/80 border border-border/60 flex items-center justify-center active:scale-95 transition">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold">设置</h1>
      </header>

      {/* 训练参数（持久化到 settings 表） */}
      <section className="rounded-3xl px-4 py-2 bg-card/80 border border-border/60">
        <NumberRow
          label="组间休息计时"
          hint="默认 90 秒，范围 15–900 秒（FR-LOG-04）"
          value={settings.restSeconds}
          min={15}
          max={900}
          onChange={(v) => updateSetting('restSeconds', v)}
        />
        <NumberRow
          label="加重幅度"
          hint="渐进超负荷建议的默认步进 kg（FR-PLAN-07）"
          value={settings.incrementKg}
          min={1}
          max={10}
          onChange={(v) => updateSetting('incrementKg', v)}
        />
        <NumberRow
          label="达标判定次数"
          hint="连续 N 次达次数上限才建议加重（FR-ANA-03）"
          value={settings.capHits}
          min={1}
          max={5}
          onChange={(v) => updateSetting('capHits', v)}
        />
      </section>

      {/* 数据管理 */}
      <section className="rounded-3xl p-4 bg-card/80 border border-border/60 space-y-3">
        <h3 className="font-bold text-sm">数据管理</h3>
        <p className="text-[11px] text-muted-foreground">所有数据只存在本机浏览器，建议定期导出备份</p>
        <div className="grid grid-cols-1 gap-2.5">
          <button onClick={exportJSON} className="py-3 rounded-2xl bg-purple-500/15 border border-purple-500/40 text-purple-200 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <Download size={15} /> 导出完整备份（JSON）
          </button>
          <button onClick={exportCSV} className="py-3 rounded-2xl bg-background/60 border border-border/60 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <FileSpreadsheet size={15} /> 导出训练明细（CSV，Excel 可用）
          </button>
          <button onClick={() => importRef.current?.click()} className="py-3 rounded-2xl bg-background/60 border border-border/60 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <Upload size={15} /> 从备份恢复（全量覆盖）
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              onImportFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {message && <p className="text-[11px] text-purple-300">{message}</p>}
        {storage && (
          <p className={`text-[11px] flex items-center gap-1.5 ${storagePct > 80 ? 'text-red-400' : 'text-muted-foreground'}`}>
            <HardDrive size={12} />
            本地存储占用 {(storage.usage / 1024 / 1024).toFixed(1)} MB
            {storagePct !== null && ` / 约 ${storagePct}%`}
            {storagePct > 80 && '，建议导出备份后清理'}
          </p>
        )}
      </section>

      {/* 安装到主屏幕（PWA，FR-DATA-07） */}
      <section className="rounded-3xl p-4 bg-card/80 border border-border/60 space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Smartphone size={15} className="text-purple-300" /> 安装到主屏幕
        </h3>
        <ol className="text-[11px] text-muted-foreground leading-relaxed list-decimal list-inside space-y-1">
          <li>iPhone：Safari 打开本页 → 底部分享按钮 →「添加到主屏幕」</li>
          <li>Android：Chrome 打开本页 → 右上角菜单 →「安装应用 / 添加到主屏幕」</li>
          <li>安装后全屏运行、无地址栏，断网也能完整使用</li>
        </ol>
      </section>

      {/* 关于与版权（需求文档 8.1：保留版权声明） */}
      <section className="rounded-3xl p-4 bg-card/80 border border-border/60 space-y-2">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Info size={15} className="text-purple-300" /> 关于
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          FitLog · 本地优先的健身记录工具（非商业个人用途）。
          动作数据来源 openGym 项目；动作演示媒体 © Aliaksandr Makatserchyk / Gym Visual，
          经 openGym 授权仅限非商业用途原样使用。无账号、无服务端、无遥测，数据不出设备。
        </p>
      </section>
    </div>
  );
}
