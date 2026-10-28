/**
 * 分享卡片生成（FR-DATA-05）：Canvas 绘制单次训练摘要卡，导出 PNG
 * 零依赖，1080×1440（3:4，适合社交平台）
 */

const W = 1080;
const H = 1440;

/**
 * @param {{ date: string, title: string, durationMin?: number,
 *           exercises: Array<{ nameZh: string, sets: Array<{ weight: number, reps: number }> } }} workout
 * @returns {Promise<Blob>} PNG 图片
 */
export async function generateShareCard(workout) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 背景：深紫渐变 + 顶部光晕（与应用主题一致）
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#170b2b');
  bg.addColorStop(1, '#0a0614');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, -60, 40, W * 0.85, -60, 560);
  glow.addColorStop(0, 'rgba(139,92,246,0.35)');
  glow.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 品牌与日期
  ctx.fillStyle = '#a78bfa';
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.fillText('FitLog 健身记录', 72, 96);
  ctx.fillStyle = '#8b83a3';
  ctx.font = '30px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(workout.date, W - 72, 96);
  ctx.textAlign = 'left';

  // 标题
  ctx.fillStyle = '#f3eeff';
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText(workout.title, 72, 200);

  // 汇总指标
  const sets = workout.exercises.flatMap((e) => e.sets);
  const volume = sets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);
  const metrics = [
    { label: '动作', value: String(workout.exercises.length) },
    { label: '总组数', value: String(sets.length) },
    { label: '总容量', value: `${volume} kg` },
    { label: '时长', value: workout.durationMin ? `${workout.durationMin} 分钟` : '—' },
  ];
  metrics.forEach((m, i) => {
    const x = 72 + i * 240;
    roundRect(ctx, x, 250, 216, 130, 24);
    ctx.fillStyle = 'rgba(139,92,246,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(168,85,247,0.35)';
    ctx.stroke();
    ctx.fillStyle = '#e9d5ff';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText(m.value, x + 24, 312);
    ctx.fillStyle = '#8b83a3';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(m.label, x + 24, 356);
  });

  // 动作明细
  let y = 460;
  ctx.font = '600 30px system-ui, sans-serif';
  workout.exercises.slice(0, 10).forEach((ex) => {
    const best = ex.sets.reduce((b, s) => Math.max(b, (s.weight || 0) * (s.reps || 0)), 0);
    roundRect(ctx, 72, y, W - 144, 96, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.fillStyle = '#f3eeff';
    ctx.font = '600 32px system-ui, sans-serif';
    ctx.fillText(ex.nameZh, 100, y + 58);
    ctx.fillStyle = '#a78bfa';
    ctx.font = '30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${ex.sets.length} 组 · 最佳容量 ${best} kg`, W - 100, y + 58);
    ctx.textAlign = 'left';
    y += 116;
  });
  if (workout.exercises.length > 10) {
    ctx.fillStyle = '#8b83a3';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(`…另有 ${workout.exercises.length - 10} 个动作`, 72, y + 40);
  }

  // 底部水印
  ctx.fillStyle = '#6d6390';
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillText('本地记录 · 数据不出设备', 72, H - 60);

  // toBlob 可能因 canvas 过大/内存不足回调 null：必须 reject，否则调用方拿到 null 无感知失败
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob 返回 null'))), 'image/png')
  );
}

/** 圆角矩形路径 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
