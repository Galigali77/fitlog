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

// v3：sets 加复合索引 [workoutExerciseId+setIndex]（阶段四性能加固）。
// 注意：repository.setsFor 实际走的是 workoutExerciseId 单字段索引 + 内存显式 sort(bySetIndex)，
// 复合索引的价值在于支持「按动作 + 组序」的范围查询与有序遍历，并不保证 anyOf 查询天然按组序返回。
// upgrade 给阶段一~三写入的旧组数据回填 setIndex（按当前主键序分配，顺序从此稳定）。
db.version(3)
  .stores({
    sets: 'id, workoutExerciseId, [workoutExerciseId+setIndex]',
  })
  .upgrade(async (tx) => {
    const sets = await tx.table('sets').toArray();
    const groups = new Map(); // workoutExerciseId → 该动作下的组（主键序）
    for (const s of sets) {
      const arr = groups.get(s.workoutExerciseId);
      if (arr) arr.push(s);
      else groups.set(s.workoutExerciseId, [s]);
    }
    const patched = [];
    for (const arr of groups.values()) {
      arr.forEach((s, i) => {
        if (s.setIndex === undefined) patched.push({ ...s, setIndex: i });
      });
    }
    if (patched.length > 0) await tx.table('sets').bulkPut(patched);
  });
