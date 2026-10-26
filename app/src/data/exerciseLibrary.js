/**
 * 动作库加载与检索（阶段二：读 public/exercises/index.json + 合并用户自建动作）
 *
 * 性能设计（对应非功能需求「搜索 ≤200ms」）：
 * - index.json 异步加载一次后常驻内存，3000+ 条规模下过滤用线性扫描即可达标；
 * - 媒体路径约定：静帧 exercises/still/<id>.webp（列表页懒加载），
 *   动画 exercises/clip/<id>.mp4（详情页循环播放）——均为 openGym 原样媒体，未修改。
 */
import { db } from '@/db/schema';

/** @type {import('@/types').Exercise[] | null} */
let cache = null;
/** @type {Promise<import('@/types').Exercise[]> | null} */
let inflight = null;

/**
 * 加载内置动作库（带缓存与并发去重）；文件缺失时回退到少量内置演示动作
 * @returns {Promise<import('@/types').Exercise[]>}
 */
export function loadExercises() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch(`${import.meta.env.BASE_URL}exercises/index.json`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data) => {
      cache = data.exercises ?? [];
      return cache;
    })
    .catch(() => {
      cache = FALLBACK_EXERCISES;
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * 合并内置动作与用户自建动作（FR-EX-06）
 * @returns {Promise<import('@/types').Exercise[]>}
 */
export async function loadAllExercises() {
  const [builtin, custom] = await Promise.all([loadExercises(), db.customExercises.toArray()]);
  return [...custom.map((c) => ({ ...c, custom: true })), ...builtin];
}

/** 按 id 查动作（先内存索引，未命中返回 null） */
export async function exerciseById(id) {
  const all = await loadAllExercises();
  return all.find((e) => e.id === id) ?? null;
}

/** 静帧（列表页缩略图）路径 */
export const stillUrl = (id) => `${import.meta.env.BASE_URL}exercises/still/${id}.webp`;

/** 动画（详情页演示，循环静音播放）路径 */
export const clipUrl = (id) => `${import.meta.env.BASE_URL}exercises/clip/${id}.mp4`;

/**
 * 组合过滤：名称模糊搜索（中英）+ 肌群 + 器械（FR-EX-03）
 * @param {import('@/types').Exercise[]} list
 * @param {{ keyword?: string, muscle?: string|null, equipment?: string }} q
 */
export function filterExercises(list, { keyword = '', muscle = null, equipment = '全部' } = {}) {
  const kw = keyword.trim().toLowerCase();
  return list.filter((e) => {
    if (kw && !e.nameZh.toLowerCase().includes(kw) && !e.nameEn.toLowerCase().includes(kw)) return false;
    if (muscle && !e.muscles.includes(muscle)) return false;
    if (equipment !== '全部' && e.equipment !== equipment) return false;
    return true;
  });
}

/** 从动作列表提取有序肌群清单（按动作数降序，供左侧竖栏） */
export function musclesOf(list) {
  const count = new Map();
  list.forEach((e) => e.muscles.forEach((m) => count.set(m, (count.get(m) ?? 0) + 1)));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/** 从动作列表提取器械清单（按动作数降序，供筛选 chips） */
export function equipmentsOf(list) {
  const count = new Map();
  list.forEach((e) => count.set(e.equipment, (count.get(e.equipment) ?? 0) + 1));
  return ['全部', ...[...count.entries()].sort((a, b) => b[1] - a[1]).map(([eq]) => eq)];
}

// 工具链未运行时的兜底演示动作（保证应用可启动）
/** @type {import('@/types').Exercise[]} */
const FALLBACK_EXERCISES = [
  { id: 'squat', nameZh: '杠铃深蹲', nameEn: 'Barbell Squat', muscles: ['股四头肌', '臀部'], secondaryMuscles: [], equipment: '杠铃', bodyPart: '下肢', type: '力量', desc: '双脚与肩同宽，核心收紧，髋膝联动下蹲至大腿平行地面，脚跟蹬地起身。', hasMedia: false },
  { id: 'bench', nameZh: '平板卧推', nameEn: 'Bench Press', muscles: ['胸大肌', '肱三头肌'], secondaryMuscles: [], equipment: '杠铃', bodyPart: '胸', type: '力量', desc: '肩胛后缩下沉贴凳，握距略宽于肩，下放至触胸后推起，手腕保持中立。', hasMedia: false },
  { id: 'deadlift', nameZh: '硬拉', nameEn: 'Deadlift', muscles: ['下背部', '臀部', '腘绳肌'], secondaryMuscles: [], equipment: '杠铃', bodyPart: '背', type: '力量', desc: '背部平直，杠铃贴小腿上下，伸髋发力锁定，避免弓腰。', hasMedia: false },
  { id: 'ohp', nameZh: '杠铃推举', nameEn: 'Overhead Press', muscles: ['三角肌', '肱三头肌'], secondaryMuscles: [], equipment: '杠铃', bodyPart: '肩', type: '力量', desc: '核心收紧，杠铃沿面部前侧垂直上推，头部稍后让，顶端不耸肩。', hasMedia: false },
  { id: 'row', nameZh: '杠铃划船', nameEn: 'Barbell Row', muscles: ['背阔肌', '肱二头肌'], secondaryMuscles: [], equipment: '杠铃', bodyPart: '背', type: '力量', desc: '俯身约 45°，背部平直，杠铃沿大腿拉向肚脐，顶峰收缩 1 秒。', hasMedia: false },
  { id: 'db-press', nameZh: '哑铃卧推', nameEn: 'Dumbbell Press', muscles: ['胸大肌', '肱三头肌'], secondaryMuscles: [], equipment: '哑铃', bodyPart: '胸', type: '力量', desc: '哑铃置于胸两侧，推起时微向内收，下放控制 2 秒。', hasMedia: false },
  { id: 'db-fly', nameZh: '哑铃飞鸟', nameEn: 'Dumbbell Fly', muscles: ['胸大肌'], secondaryMuscles: [], equipment: '哑铃', bodyPart: '胸', type: '力量', desc: '肘部微屈固定角度，弧线展开至与肩平，环抱感收拢。', hasMedia: false },
  { id: 'db-curl', nameZh: '哑铃弯举', nameEn: 'Dumbbell Curl', muscles: ['肱二头肌'], secondaryMuscles: [], equipment: '哑铃', bodyPart: '手臂', type: '力量', desc: '上臂贴紧身体不动，顶峰收缩，缓慢下放不借力。', hasMedia: false },
  { id: 'db-lunge', nameZh: '哑铃箭步蹲', nameEn: 'Dumbbell Lunge', muscles: ['股四头肌', '臀部'], secondaryMuscles: [], equipment: '哑铃', bodyPart: '下肢', type: '力量', desc: '躯干直立，前腿膝盖不超过脚尖，后腿轻触地即起。', hasMedia: false },
  { id: 'db-shoulder', nameZh: '哑铃侧平举', nameEn: 'Lateral Raise', muscles: ['三角肌'], secondaryMuscles: [], equipment: '哑铃', bodyPart: '肩', type: '力量', desc: '肘部微屈，向两侧举至肩高，控制下放，不耸肩。', hasMedia: false },
  { id: 'pullup', nameZh: '引体向上', nameEn: 'Pull Up', muscles: ['背阔肌', '肱二头肌'], secondaryMuscles: [], equipment: '单杠', bodyPart: '背', type: '力量', desc: '握距略宽于肩，胸口向杠方向拉，顶端停顿，缓慢下放至手臂伸直。', hasMedia: false },
  { id: 'pushup', nameZh: '俯卧撑', nameEn: 'Push Up', muscles: ['胸大肌', '肱三头肌'], secondaryMuscles: [], equipment: '徒手', bodyPart: '胸', type: '力量', desc: '身体成一条直线，肘部与躯干约 45°，胸部接近地面后推起。', hasMedia: false },
  { id: 'plank', nameZh: '平板支撑', nameEn: 'Plank', muscles: ['核心'], secondaryMuscles: [], equipment: '徒手', bodyPart: '核心', type: '拉伸', desc: '前臂撑地，身体成直线，核心收紧，均匀呼吸，计时动作。', hasMedia: false },
  { id: 'leg-raise', nameZh: '悬垂举腿', nameEn: 'Hanging Leg Raise', muscles: ['核心', '髂腰肌'], secondaryMuscles: [], equipment: '单杠', bodyPart: '核心', type: '力量', desc: '悬垂保持身体稳定，抬腿至脚尖过杠，控制下放不摆动。', hasMedia: false },
  { id: 'calf', nameZh: '站姿提踵', nameEn: 'Standing Calf Raise', muscles: ['小腿'], secondaryMuscles: [], equipment: '徒手', bodyPart: '下肢', type: '力量', desc: '前脚掌踩稳，提踵至最高点后停顿 1 秒，缓慢下放拉伸。', hasMedia: false },
  { id: 'romanian', nameZh: '罗马尼亚硬拉', nameEn: 'Romanian Deadlift', muscles: ['腘绳肌', '下背部'], secondaryMuscles: [], equipment: '杠铃', bodyPart: '下肢', type: '力量', desc: '膝部微屈固定，髋部后推，杠铃沿小腿下放至腘绳肌有明显牵拉感。', hasMedia: false },
];
