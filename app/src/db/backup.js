/**
 * 数据备份与恢复（FR-DATA-02/03/04）
 * - 导出 JSON：完整备份（身材照片 Blob 转 base64）；
 * - 导入 JSON：全量覆盖式恢复，校验 app 与 exportVersion 字段；
 * - 导出 CSV：训练明细表（带 BOM，Excel 直接打开不乱码）。
 */
import { db } from './schema';
import { listWorkouts } from './repository';

const EXPORT_VERSION = 1;

/** Blob → base64（不带 data: 前缀） */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** base64 → Blob */
function base64ToBlob(base64, mime = 'image/jpeg') {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * 组装完整备份对象（格式见技术方案 4.2）
 * @returns {Promise<object>}
 */
export async function buildBackup() {
  const [workouts, workoutExercises, sets, routines, routineItems, bodyPhotos, customExercises, settings] =
    await Promise.all([
      db.workouts.toArray(),
      db.workoutExercises.toArray(),
      db.sets.toArray(),
      db.routines.toArray(),
      db.routineItems.toArray(),
      db.bodyPhotos.toArray(),
      db.customExercises.toArray(),
      db.settings.toArray(),
    ]);
  return {
    app: 'fitlog',
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      workouts,
      workoutExercises,
      sets,
      routines,
      routineItems,
      // 照片 Blob 转 base64，保证 JSON 可序列化
      bodyPhotos: await Promise.all(
        bodyPhotos.map(async (p) => ({
          ...p,
          front: p.front ? await blobToBase64(p.front) : null,
          back: p.back ? await blobToBase64(p.back) : null,
        }))
      ),
      customExercises,
      settings,
    },
  };
}

/** 触发浏览器下载 */
export function downloadFile(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 导出完整备份 JSON 文件 */
export async function exportJSON() {
  const backup = await buildBackup();
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`fitlog-backup-${date}.json`, JSON.stringify(backup), 'application/json');
}

/**
 * 从 JSON 全量覆盖式恢复（FR-DATA-03）
 * @param {object} backup 解析后的备份对象
 * @throws {Error} 格式或版本不兼容时抛出中文错误信息
 */
export async function importJSON(backup) {
  if (!backup || backup.app !== 'fitlog') throw new Error('不是 FitLog 的备份文件');
  if (backup.exportVersion !== EXPORT_VERSION) {
    throw new Error(`备份版本不兼容（文件 v${backup.exportVersion}，当前支持 v${EXPORT_VERSION}）`);
  }
  const d = backup.data ?? {};
  const tables = [
    db.workouts, db.workoutExercises, db.sets, db.routines,
    db.routineItems, db.bodyPhotos, db.customExercises, db.settings,
  ];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    if (d.workouts?.length) await db.workouts.bulkAdd(d.workouts);
    if (d.workoutExercises?.length) await db.workoutExercises.bulkAdd(d.workoutExercises);
    if (d.sets?.length) await db.sets.bulkAdd(d.sets);
    if (d.routines?.length) await db.routines.bulkAdd(d.routines);
    if (d.routineItems?.length) await db.routineItems.bulkAdd(d.routineItems);
    if (d.bodyPhotos?.length) {
      await db.bodyPhotos.bulkAdd(
        d.bodyPhotos.map((p) => ({
          ...p,
          front: p.front ? base64ToBlob(p.front) : null,
          back: p.back ? base64ToBlob(p.back) : null,
        }))
      );
    }
    if (d.customExercises?.length) await db.customExercises.bulkAdd(d.customExercises);
    if (d.settings?.length) await db.settings.bulkAdd(d.settings);
  });
}

/**
 * 导出训练明细 CSV（FR-DATA-04）：日期、训练、动作、组序、重量、次数、RPE
 */
export async function exportCSV() {
  const workouts = await listWorkouts();
  const rows = [['日期', '训练', '动作', '组序', '重量(kg)', '次数', 'RPE']];
  for (const w of workouts) {
    for (const ex of w.exercises ?? []) {
      (ex.sets ?? []).forEach((s, i) => {
        rows.push([w.date, w.title, ex.nameZh ?? ex.exerciseId, String(i + 1), String(s.weight), String(s.reps), s.rpe ?? '']);
      });
    }
  }
  // 字段统一加引号转义；开头加 BOM 让 Excel 按 UTF-8 解析中文
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`fitlog-sets-${date}.csv`, csv, 'text/csv;charset=utf-8');
}
