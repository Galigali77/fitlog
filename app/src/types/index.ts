// 核心数据模型（对应需求分析第 4 章）
export interface Exercise {
  id: string;
  nameZh: string;
  nameEn: string;
  muscles: string[]; // 目标肌群
  equipment: string; // 所需器械
  type: '力量' | '有氧' | '拉伸';
  desc: string; // 动作要领
}

export interface SetData {
  weight: number; // kg，自重动作可为 0
  reps: number;
  done?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  nameZh: string;
  sets: SetData[];
}

export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  routineName?: string;
  exercises: WorkoutExercise[];
}

export interface RoutineItem {
  exerciseId: string;
  targetSets: number;
  targetReps: string; // 如 "8-10"
}

export interface Routine {
  id: string;
  name: string;
  mode: 'weekly' | 'rotation';
  items: RoutineItem[];
}

// 身材记录：每 15 天一组，至少正面 + 背面两张照片
export interface BodyPhoto {
  id: string;
  date: string; // YYYY-MM-DD
  front: string; // 图片地址 / dataURL
  back: string;
}

export type TabKey = 'today' | 'review' | 'library' | 'plan';
