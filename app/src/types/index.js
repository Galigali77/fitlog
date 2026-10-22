/**
 * 核心数据模型（JSDoc @typedef，与 docs/需求分析.md 第 4 章对齐）
 * 这些定义仅供编辑器补全/悬停提示，不参与编译。
 */

/**
 * @typedef {Object} Exercise
 * @property {string} id
 * @property {string} nameZh
 * @property {string} nameEn
 * @property {string[]} muscles      目标肌群
 * @property {string} equipment      所需器械
 * @property {'力量'|'有氧'|'拉伸'} type
 * @property {string} desc           动作要领
 */

/**
 * @typedef {Object} SetData
 * @property {number} weight   kg，自重动作可为 0
 * @property {number} reps
 * @property {boolean} [done]
 */

/**
 * @typedef {Object} WorkoutExercise
 * @property {string} exerciseId
 * @property {string} nameZh
 * @property {SetData[]} sets
 */

/**
 * @typedef {Object} Workout
 * @property {string} id
 * @property {string} date           YYYY-MM-DD
 * @property {string} title
 * @property {string} [routineName]
 * @property {WorkoutExercise[]} exercises
 */

/**
 * @typedef {Object} RoutineItem
 * @property {string} exerciseId
 * @property {number} targetSets
 * @property {string} targetReps     如 "8-10"
 */

/**
 * @typedef {Object} Routine
 * @property {string} id
 * @property {string} name
 * @property {'weekly'|'rotation'} mode
 * @property {RoutineItem[]} items
 */

/**
 * @typedef {Object} BodyPhoto
 * @property {string} id
 * @property {string} date           YYYY-MM-DD
 * @property {string} front          图片地址 / dataURL
 * @property {string} back
 */

/** 底部导航键：'today' | 'review' | 'library' | 'plan' */

export {}; // 本模块仅承载 JSDoc 定义，无运行时导出
