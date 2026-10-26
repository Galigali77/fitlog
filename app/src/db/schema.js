/**
 * IndexedDB 表结构定义（Dexie.js 封装）
 * 与 docs/技术设计方案.md 第 4.1 节对齐。
 *
 * 版本迁移约定：
 * - 新增字段/新表时递增 version(n).stores({...})，必要时配 upgrade() 迁移旧数据；
 * - 内置动作（openGym）不进 IndexedDB，以 public/exercises/index.json 只读分发；
 *   用户自建动作进 customExercises 表，查询时二者合并。
 */
import Dexie from 'dexie';

export const db = new Dexie('fitlog');

db.version(1).stores({
  // 一次训练会话；date 建索引供热力图/时间线按日期查询
  workouts: 'id, date, routineId',
  // 训练内的动作；workoutId 索引供按训练组装
  workoutExercises: 'id, workoutId, exerciseId',
  // 最小记录单元：重量/次数/RPE/组类型
  sets: 'id, workoutExerciseId',
  // 训练计划（mode: 'weekly' 按星期 | 'rotation' 轮换；rotationPos 当前轮换位置）
  routines: 'id',
  // 计划内动作（目标组数/目标次数区间/加重幅度）
  routineItems: 'id, routineId, exerciseId',
  // 身材记录：照片存 Blob（比 dataURL 省空间，可直接 <img src=blobURL>）
  bodyPhotos: 'id, date',
  // 用户自建动作（FR-EX-06）
  customExercises: 'id',
  // 键值设置：计时器默认秒数、加重幅度、判定次数等
  settings: 'key',
});

// v2：训练草稿表（记录页自动持久化，刷新/关闭标签页后可恢复未完成的训练）
db.version(2).stores({
  // 全局单条草稿，id 固定 'current'；内容存记录页状态快照（exercises/nameMap/startedAt 等）
  sessionDrafts: 'id',
});
