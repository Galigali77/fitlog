// 生成最近 105 天的演示历史数据（复盘页热力图 / 曲线用）
function fmt(d) {
  return d.toISOString().slice(0, 10);
}

const today = new Date();
const past = (days) => {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return fmt(d);
};

// 近 15 周的训练日期分布（每周 3-4 练）
const TRAIN_DAYS = [];
for (let week = 0; week < 15; week++) {
  const base = week * 7 + 1;
  TRAIN_DAYS.push(base, base + 2, base + 4);
  if (week % 3 !== 2) TRAIN_DAYS.push(base + 5);
}

/** @type {import('@/types').Workout[]} */
export const SAMPLE_WORKOUTS = TRAIN_DAYS.map((daysAgo, i) => {
  const cycle = ['推日 Push', '拉日 Pull', '腿日 Legs'][i % 3];
  return {
    id: `sample-${i}`,
    date: past(daysAgo),
    title: cycle,
    routineName: cycle,
    exercises: [],
  };
});

// 深蹲 e1RM 历史最佳（今日页快捷入口用）
export const SQUAT_BEST_E1RM = 85.5;

// 平板卧推最近两次记录：连续达到次数上限 10 次（触发超负荷建议）
export const BENCH_HISTORY = [
  { date: past(14), weight: 50, reps: 10 },
  { date: past(7), weight: 50, reps: 10 },
];

// 动作 → 主要肌群（肌肉覆盖热力图用）
export const EXERCISE_MUSCLE_MAP = {
  推日: ['胸大肌', '三角肌', '肱三头肌'],
  拉日: ['背阔肌', '肱二头肌'],
  腿日: ['股四头肌', '臀部', '腘绳肌'],
};

// 身材记录演示数据（占位图：正式版为用户实拍照片，仅存本地）
/** @type {import('@/types').BodyPhoto[]} */
export const SAMPLE_BODY_PHOTOS = [
  { id: 'bp-1', date: past(30), front: '', back: '' },
  { id: 'bp-2', date: past(15), front: '', back: '' },
];

export const todayStr = fmt(today);
