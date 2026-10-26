/**
 * 核心数据模型（JSDoc @typedef，与 docs/需求分析.md 第 4 章、docs/技术设计方案.md 第 4.1 节对齐）
 * 这些定义仅供编辑器补全/悬停提示，不参与编译（技术方案 2.1.1 第一道防线）。
 */

/**
 * 动作（内置动作来自 openGym，id 为数字字符串如 "0025"；自定义动作 id 以 "c-" 开头）
 * @typedef {Object} Exercise
 * @property {string} id
 * @property {string} nameZh            中文名（缺失时回退英文名）
 * @property {string} nameEn            英文名
 * @property {string[]} muscles         目标肌群（中文）
 * @property {string[]} secondaryMuscles 协同肌群（中文）
 * @property {string} equipment         所需器械（中文）
 * @property {string} bodyPart          身体部位（中文）
 * @property {'力量'|'有氧'|'拉伸'|'其他'} type
 * @property {string} desc              动作要领（描述 + 步骤拼接）
 * @property {boolean} [hasMedia]       是否有演示媒体（静帧/动画）
 * @property {boolean} [custom]         是否用户自建
 */

/**
 * 组（最小记录单元）
 * @typedef {Object} SetData
 * @property {string} id
 * @property {string} workoutExerciseId
 * @property {number} weight            kg，自重动作可为 0
 * @property {number} reps              次数（计时类动作存秒数）
 * @property {number} [rpe]             自感用力系数 6-10（可选）
 * @property {'work'|'warmup'} [type]   正式组/热身组，默认 work
 */

/**
 * 训练内的一个动作
 * @typedef {Object} WorkoutExercise
 * @property {string} id
 * @property {string} workoutId
 * @property {string} exerciseId
 * @property {number} order             动作在训练中的顺序
 */

/**
 * 一次训练（组装后的视图对象，repository 层拼接返回）
 * @typedef {Object} Workout
 * @property {string} id
 * @property {string} date              YYYY-MM-DD
 * @property {string} title
 * @property {string} [routineId]       关联计划 id（自由训练为空）
 * @property {string} [routineName]
 * @property {number} [durationMin]
 * @property {string} [note]
 * @property {Array<WorkoutExercise & { nameZh: string, sets: SetData[] }>} [exercises] 组装视图才有
 */

/**
 * 计划内动作
 * @typedef {Object} RoutineItem
 * @property {string} id
 * @property {string} routineId
 * @property {string} exerciseId
 * @property {number} targetSets
 * @property {string} targetReps        如 "8-10"、"45秒"、"力竭"
 * @property {number} [increment]       加重幅度 kg，默认读全局设置
 */

/**
 * 训练计划
 * @typedef {Object} Routine
 * @property {string} id
 * @property {string} name
 * @property {'weekly'|'rotation'} mode
 * @property {number} rotationPos       轮换模式当前位置
 * @property {RoutineItem[]} [items]    组装视图才有
 */

/**
 * 身材记录（每 15 天一组，照片 Blob 仅存本地）
 * @typedef {Object} BodyPhoto
 * @property {string} id
 * @property {string} date              YYYY-MM-DD
 * @property {Blob} front               正面照片
 * @property {Blob} back                背面照片
 */

export {}; // 本模块仅承载 JSDoc 定义，无运行时导出
