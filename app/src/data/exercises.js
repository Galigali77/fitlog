// 原型样例动作库（正式版将整体替换为 openGym catalogue/ 数据 + GIF）
/** @type {import('@/types').Exercise[]} */
export const EXERCISES = [
  { id: 'squat', nameZh: '杠铃深蹲', nameEn: 'Barbell Squat', muscles: ['股四头肌', '臀部'], equipment: '杠铃', type: '力量', desc: '双脚与肩同宽，核心收紧，髋膝联动下蹲至大腿平行地面，脚跟蹬地起身。' },
  { id: 'bench', nameZh: '平板卧推', nameEn: 'Bench Press', muscles: ['胸大肌', '肱三头肌'], equipment: '杠铃', type: '力量', desc: '肩胛后缩下沉贴凳，握距略宽于肩，下放至触胸后推起，手腕保持中立。' },
  { id: 'deadlift', nameZh: '硬拉', nameEn: 'Deadlift', muscles: ['下背部', '臀部', '腘绳肌'], equipment: '杠铃', type: '力量', desc: '背部平直，杠铃贴小腿上下，伸髋发力锁定，避免弓腰。' },
  { id: 'ohp', nameZh: '杠铃推举', nameEn: 'Overhead Press', muscles: ['三角肌', '肱三头肌'], equipment: '杠铃', type: '力量', desc: '核心收紧，杠铃沿面部前侧垂直上推，头部稍后让，顶端不耸肩。' },
  { id: 'row', nameZh: '杠铃划船', nameEn: 'Barbell Row', muscles: ['背阔肌', '肱二头肌'], equipment: '杠铃', type: '力量', desc: '俯身约 45°，背部平直，杠铃沿大腿拉向肚脐，顶峰收缩 1 秒。' },
  { id: 'db-press', nameZh: '哑铃卧推', nameEn: 'Dumbbell Press', muscles: ['胸大肌', '肱三头肌'], equipment: '哑铃', type: '力量', desc: '哑铃置于胸两侧，推起时微向内收，下放控制 2 秒。' },
  { id: 'db-fly', nameZh: '哑铃飞鸟', nameEn: 'Dumbbell Fly', muscles: ['胸大肌'], equipment: '哑铃', type: '力量', desc: '肘部微屈固定角度，弧线展开至与肩平，环抱感收拢。' },
  { id: 'db-curl', nameZh: '哑铃弯举', nameEn: 'Dumbbell Curl', muscles: ['肱二头肌'], equipment: '哑铃', type: '力量', desc: '上臂贴紧身体不动，顶峰收缩，缓慢下放不借力。' },
  { id: 'db-lunge', nameZh: '哑铃箭步蹲', nameEn: 'Dumbbell Lunge', muscles: ['股四头肌', '臀部'], equipment: '哑铃', type: '力量', desc: '躯干直立，前腿膝盖不超过脚尖，后腿轻触地即起。' },
  { id: 'db-shoulder', nameZh: '哑铃侧平举', nameEn: 'Lateral Raise', muscles: ['三角肌'], equipment: '哑铃', type: '力量', desc: '肘部微屈，向两侧举至肩高，控制下放，不耸肩。' },
  { id: 'pullup', nameZh: '引体向上', nameEn: 'Pull Up', muscles: ['背阔肌', '肱二头肌'], equipment: '单杠', type: '力量', desc: '握距略宽于肩，胸口向杠方向拉，顶端停顿，缓慢下放至手臂伸直。' },
  { id: 'pushup', nameZh: '俯卧撑', nameEn: 'Push Up', muscles: ['胸大肌', '肱三头肌'], equipment: '徒手', type: '力量', desc: '身体成一条直线，肘部与躯干约 45°，胸部接近地面后推起。' },
  { id: 'plank', nameZh: '平板支撑', nameEn: 'Plank', muscles: ['核心'], equipment: '徒手', type: '拉伸', desc: '前臂撑地，身体成直线，核心收紧，均匀呼吸，计时动作。' },
  { id: 'leg-raise', nameZh: '悬垂举腿', nameEn: 'Hanging Leg Raise', muscles: ['核心', '髂腰肌'], equipment: '单杠', type: '力量', desc: '悬垂保持身体稳定，抬腿至脚尖过杠，控制下放不摆动。' },
  { id: 'calf', nameZh: '站姿提踵', nameEn: 'Standing Calf Raise', muscles: ['小腿'], equipment: '徒手', type: '力量', desc: '前脚掌踩稳，提踵至最高点后停顿 1 秒，缓慢下放拉伸。' },
  { id: 'romanian', nameZh: '罗马尼亚硬拉', nameEn: 'Romanian Deadlift', muscles: ['腘绳肌', '下背部'], equipment: '杠铃', type: '力量', desc: '膝部微屈固定，髋部后推，杠铃沿小腿下放至腘绳肌有明显牵拉感。' },
];

export const MUSCLES = ['胸大肌', '背阔肌', '三角肌', '肱二头肌', '肱三头肌', '股四头肌', '腘绳肌', '臀部', '下背部', '核心', '小腿'];

export const EQUIPMENTS = ['全部', '徒手', '哑铃', '杠铃', '单杠'];

/** @type {import('@/types').Routine[]} */
export const ROUTINES = [
  {
    id: 'r-push', name: '推日 Push（A）', mode: 'rotation',
    items: [
      { exerciseId: 'bench', targetSets: 4, targetReps: '8-10' },
      { exerciseId: 'ohp', targetSets: 3, targetReps: '8-12' },
      { exerciseId: 'db-fly', targetSets: 3, targetReps: '12-15' },
      { exerciseId: 'db-curl', targetSets: 3, targetReps: '10-12' },
    ],
  },
  {
    id: 'r-pull', name: '拉日 Pull（B）', mode: 'rotation',
    items: [
      { exerciseId: 'pullup', targetSets: 4, targetReps: '6-10' },
      { exerciseId: 'row', targetSets: 4, targetReps: '8-10' },
      { exerciseId: 'db-curl', targetSets: 3, targetReps: '10-12' },
    ],
  },
  {
    id: 'r-legs', name: '腿日 Legs（C）', mode: 'rotation',
    items: [
      { exerciseId: 'squat', targetSets: 5, targetReps: '5-8' },
      { exerciseId: 'romanian', targetSets: 3, targetReps: '8-10' },
      { exerciseId: 'calf', targetSets: 4, targetReps: '15-20' },
      { exerciseId: 'plank', targetSets: 3, targetReps: '45秒' },
    ],
  },
];

// 内置模板
/** @type {import('@/types').Routine[]} */
export const TEMPLATES = [
  { id: 't-5x5', name: '5×5 力量增肌', mode: 'weekly', items: [
    { exerciseId: 'squat', targetSets: 5, targetReps: '5' },
    { exerciseId: 'bench', targetSets: 5, targetReps: '5' },
    { exerciseId: 'row', targetSets: 5, targetReps: '5' },
  ]},
  { id: 't-ppl', name: 'Push / Pull / Legs', mode: 'rotation', items: [] },
  { id: 't-home', name: '宿舍哑铃版', mode: 'rotation', items: [
    { exerciseId: 'db-press', targetSets: 4, targetReps: '8-12' },
    { exerciseId: 'db-lunge', targetSets: 3, targetReps: '10-12' },
    { exerciseId: 'pushup', targetSets: 3, targetReps: '力竭' },
    { exerciseId: 'plank', targetSets: 3, targetReps: '60秒' },
  ]},
];

/** @param {string} id @returns {import('@/types').Exercise} */
export const exerciseById = (id) =>
  EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
