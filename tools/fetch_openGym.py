#!/usr/bin/env python3
"""
fetch_openGym.py — 拉取 openGym catalogue 动作数据并清洗为前端 JSON（技术方案 阶段二第 1 项）

用法：
    python fetch_openGym.py                # 全量：下载数据 + 生成 index.json / routinesSeed.json
    python fetch_openGym.py --refresh      # 强制重新下载上游数据（忽略本地缓存）

产物（均写入 app/public/exercises/，该目录被 .gitignore 排除，版权原因不入仓库）：
    index.json         动作库主文件（中文字段已映射，缺失简体翻译回退英文）
    routinesSeed.json  内置种子计划（动作 id 已解析为 openGym 真实 id）
    zh_missing.txt     简体中文缺失条目名单（供人工补翻，需求文档 8.2）

媒体文件（media/still/*.webp、media/clip/*.mp4）由 optimize_gifs.py 拷贝分发，
本脚本只读取其存在性来标记 hasMedia。

实现说明：只用 Python 标准库（urllib/zipfile/tarfile），无需 requests/gitpython。
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import tarfile
import urllib.request
from pathlib import Path

# Windows 控制台默认 GBK，统一切 UTF-8 避免中文/符号输出报错
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ---------- 路径约定 ----------
ROOT = Path(__file__).resolve().parent.parent          # 项目根（代码/）
CACHE = ROOT / "tools" / "_cache" / "openGym"           # 上游仓库缓存（可重跑）
OUT_DIR = ROOT / "app" / "public" / "exercises"         # 前端产物目录

OPENGYM_TARBALL = "https://codeload.github.com/DuarteSantos8/openGym/tar.gz/refs/heads/main"

# ---------- openGym 词汇表 → 中文映射 ----------
# 词表与 openGym scripts/catalogue/validate.mjs 保持一致
BODY_PART_ZH = {
    "back": "背部", "cardio": "心肺", "chest": "胸部", "lower arms": "小臂",
    "lower legs": "小腿", "neck": "颈部", "shoulders": "肩部", "upper arms": "大臂",
    "upper legs": "大腿", "waist": "核心", "full body": "全身",
}

EQUIPMENT_ZH = {
    "body weight": "徒手", "dumbbell": "哑铃", "cable": "绳索", "barbell": "杠铃",
    "leverage machine": "固定器械", "band": "弹力带", "smith machine": "史密斯机",
    "kettlebell": "壶铃", "weighted": "负重", "stability ball": "瑜伽球",
    "ez barbell": "曲杆杠铃", "assisted": "辅助器械", "sled machine": "雪橇机",
    "medicine ball": "药球", "rope": "战绳", "roller": "泡沫轴",
    "resistance band": "阻力带", "bosu ball": "波速球", "olympic barbell": "奥杆",
    "wheel roller": "健腹轮", "upper body ergometer": "上肢功率车", "skierg machine": "滑雪机",
    "hammer": "锤铃", "stationary bike": "动感单车", "tire": "轮胎", "trap bar": "六角杠铃",
    "elliptical machine": "椭圆机", "stepmill machine": "爬楼机", "suspension trainer": "悬挂带",
    "sandbag": "沙袋", "landmine": "地雷架", "weight plate": "杠铃片",
    "clubbell": "棒铃", "macebell": "锤铃",
}

TARGET_ZH = {
    "abs": "腹肌", "pectorals": "胸大肌", "biceps": "肱二头肌", "glutes": "臀部",
    "delts": "三角肌", "triceps": "肱三头肌", "upper back": "上背部", "lats": "背阔肌",
    "calves": "小腿", "quads": "股四头肌", "forearms": "小臂",
    "cardiovascular system": "心肺", "hamstrings": "腘绳肌", "spine": "脊柱",
    "traps": "斜方肌", "adductors": "内收肌", "serratus anterior": "前锯肌",
    "abductors": "外展肌", "levator scapulae": "肩胛提肌",
}

SECONDARY_ZH = {
    "shoulders": "三角肌", "deltoids": "三角肌", "rear deltoids": "三角肌后束",
    "rotator cuff": "肩袖", "chest": "胸部", "upper chest": "上胸", "triceps": "肱三头肌",
    "biceps": "肱二头肌", "brachialis": "肱肌", "forearms": "小臂", "wrists": "手腕",
    "wrist flexors": "屈腕肌", "wrist extensors": "伸腕肌", "grip muscles": "握力肌群",
    "back": "背部", "upper back": "上背部", "lats": "背阔肌", "latissimus dorsi": "背阔肌",
    "rhomboids": "菱形肌", "trapezius": "斜方肌", "traps": "斜方肌", "lower back": "下背部",
    "core": "核心", "abdominals": "腹肌", "obliques": "腹斜肌", "lower abs": "下腹",
    "hip flexors": "髂腰肌", "glutes": "臀部", "quadriceps": "股四头肌",
    "hamstrings": "腘绳肌", "adductors": "内收肌", "inner thighs": "大腿内侧",
    "groin": "腹股沟", "calves": "小腿", "soleus": "比目鱼肌", "shins": "胫骨前肌",
    "ankles": "踝部", "ankle stabilizers": "踝部稳定肌", "feet": "足部", "hands": "手部",
    "sternocleidomastoid": "胸锁乳突肌",
}

# category → 前端动作类型（力量/有氧/拉伸/其他）
CATEGORY_TYPE = {
    "strength": "力量", "olympic": "力量", "calisthenics": "力量", "isometric": "力量",
    "plyometrics": "力量", "combat": "力量",
    "cardio": "有氧",
    "stretching": "拉伸", "mobility": "拉伸", "yoga": "拉伸", "pilates": "拉伸",
    "rehab": "拉伸",
}

# ---------- 种子计划模板（英文名 → 由脚本解析为 openGym 真实 id） ----------
# 对应需求 FR-PLAN-01：5×5 全身、PPL、三分化、宿舍哑铃版
TEMPLATE_EXERCISES = {
    "squat": ["barbell squat"],
    "bench": ["barbell bench press"],
    "deadlift": ["barbell deadlift", "deadlift"],
    "ohp": ["barbell standing military press", "barbell seated overhead press", "overhead press"],
    "row": ["barbell bent over row", "barbell row", "bent over row"],
    "db-press": ["dumbbell bench press"],
    "db-fly": ["dumbbell fly", "dumbbell flye"],
    "db-curl": ["dumbbell biceps curl", "dumbbell curl"],
    "db-lunge": ["dumbbell lunge"],
    "db-shoulder": ["dumbbell lateral raise"],
    "pullup": ["pull-up", "pull up", "pullup"],
    "pushup": ["push-up", "push up"],
    "plank": ["front plank", "plank"],
    "leg-raise": ["hanging leg raise"],
    "calf": ["bodyweight standing calf raise", "standing calf raise", "calf raise"],
    "romanian": ["barbell romanian deadlift", "romanian deadlift"],
}


def download_cache(refresh: bool) -> Path:
    """下载 openGym 仓库 tarball 并解出 catalogue/ 到本地缓存目录。"""
    marker = CACHE / "catalogue" / "exercises"
    if marker.is_dir() and not refresh:
        print(f"[fetch] 使用本地缓存：{CACHE}")
        return CACHE
    print(f"[fetch] 下载 openGym：{OPENGYM_TARBALL}")
    req = urllib.request.Request(OPENGYM_TARBALL, headers={"User-Agent": "fitlog-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        blob = resp.read()
    print(f"[fetch] 下载完成，{len(blob) / 1024 / 1024:.1f} MB，解包 catalogue/ …")
    CACHE.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
        for member in tar:
            # tarball 顶层目录为 openGym-main/，只解 catalogue/ 子树
            parts = Path(member.name).parts
            if len(parts) >= 2 and parts[1] == "catalogue":
                member.name = str(Path(*parts[1:]))
                tar.extract(member, CACHE, filter="data")
    return CACHE


def resolve_id(candidates: list[str], by_name: dict[str, str]) -> str | None:
    """按候选英文名解析动作 id：精确匹配优先。"""
    for c in candidates:
        if c in by_name:
            return by_name[c]
    return None


def build_seed_routines(by_name: dict[str, str]) -> list[dict]:
    """生成种子计划（动作 id 替换为 openGym 真实 id，未解析的动作跳过并告警）。"""
    def rid(key: str) -> str | None:
        rid_ = resolve_id(TEMPLATE_EXERCISES[key], by_name)
        if rid_ is None:
            print(f"[seed] [warn] 未找到动作：{key} {TEMPLATE_EXERCISES[key]}")
        return rid_

    def item(key: str, sets: int, reps: str) -> dict | None:
        ex_id = rid(key)
        return {"exerciseId": ex_id, "targetSets": sets, "targetReps": reps} if ex_id else None

    def items(*defs) -> list[dict]:
        return [d for d in (item(*t) for t in defs) if d]

    return [r for r in [
        {"id": "r-push", "name": "推日 Push（A）", "mode": "rotation", "rotationPos": 0,
         "items": items(("bench", 4, "8-10"), ("ohp", 3, "8-12"), ("db-fly", 3, "12-15"), ("db-curl", 3, "10-12"))},
        {"id": "r-pull", "name": "拉日 Pull（B）", "mode": "rotation", "rotationPos": 0,
         "items": items(("pullup", 4, "6-10"), ("row", 4, "8-10"), ("db-curl", 3, "10-12"))},
        {"id": "r-legs", "name": "腿日 Legs（C）", "mode": "rotation", "rotationPos": 0,
         "items": items(("squat", 5, "5-8"), ("romanian", 3, "8-10"), ("calf", 4, "15-20"), ("plank", 3, "45秒"))},
        {"id": "t-5x5", "name": "5×5 全身（模板）", "mode": "weekly", "rotationPos": 0, "weekday": 0,
         "items": items(("squat", 5, "5"), ("bench", 5, "5"), ("row", 5, "5"))},
        {"id": "t-home", "name": "宿舍哑铃版（模板）", "mode": "rotation", "rotationPos": 0,
         "items": items(("db-press", 4, "8-12"), ("db-lunge", 3, "10-12"), ("pushup", 3, "力竭"), ("plank", 3, "60秒"))},
    ] if r["items"]]


def main() -> int:
    parser = argparse.ArgumentParser(description="拉取 openGym 动作数据并生成前端 JSON")
    parser.add_argument("--refresh", action="store_true", help="忽略缓存重新下载")
    args = parser.parse_args()

    src = download_cache(args.refresh)
    ex_dir = src / "catalogue" / "exercises"
    zh_file = src / "catalogue" / "i18n" / "zh.json"
    still_dir = src / "catalogue" / "media" / "still"
    clip_dir = src / "catalogue" / "media" / "clip"

    # 简体中文翻译表（缺失回退英文，并输出缺失名单 —— 需求文档 8.2）
    zh: dict = json.loads(zh_file.read_text(encoding="utf-8")) if zh_file.is_file() else {}

    exercises = []
    by_name: dict[str, str] = {}
    zh_missing = []
    for f in sorted(ex_dir.glob("*.json")):
        e = json.loads(f.read_text(encoding="utf-8"))
        if e.get("variantOf"):
            continue  # 女性图示变体：无独立文本，跳过（复用主条目媒体与文案）
        ex_id = e["id"]
        name_en = e.get("name", "").strip()
        by_name[name_en.lower()] = ex_id
        tr = zh.get(ex_id) or {}
        name_zh = (tr.get("name") or "").strip() or name_en
        if not tr.get("name"):
            zh_missing.append(f"{ex_id}\t{name_en}")
        # 要领 = 描述 + 编号步骤（中文优先，回退英文）
        desc = tr.get("description") or e.get("description") or ""
        steps = tr.get("instructions") or e.get("instructions") or []
        if steps:
            desc = (desc + "\n" if desc else "") + "\n".join(f"{i + 1}. {s}" for i, s in enumerate(steps))
        target = e.get("target", "")
        muscles = [TARGET_ZH.get(target, target)] if target else []
        secondary = []
        for m in e.get("secondaryMuscles") or []:
            zh_m = SECONDARY_ZH.get(m, m)
            if zh_m not in secondary and zh_m not in muscles:
                secondary.append(zh_m)
        has_media = (still_dir / f"{ex_id}.webp").is_file() or (clip_dir / f"{ex_id}.mp4").is_file()
        exercises.append({
            "id": ex_id,
            "nameZh": name_zh,
            "nameEn": name_en,
            "muscles": muscles,
            "secondaryMuscles": secondary,
            "equipment": EQUIPMENT_ZH.get(e.get("equipment", ""), e.get("equipment", "")),
            "bodyPart": BODY_PART_ZH.get(e.get("bodyPart", ""), e.get("bodyPart", "")),
            "type": CATEGORY_TYPE.get(e.get("category", ""), "其他"),
            "desc": desc,
            "hasMedia": has_media,
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index_path = OUT_DIR / "index.json"
    index_path.write_text(
        json.dumps({
            "source": "openGym catalogue (https://github.com/DuarteSantos8/openGym)",
            "mediaCopyright": "动作演示媒体 © Aliaksandr Makatserchyk / Gym Visual，非商业用途原样使用",
            "generatedBy": "tools/fetch_openGym.py",
            "count": len(exercises),
            "exercises": exercises,
        }, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    seed = build_seed_routines(by_name)
    (OUT_DIR / "routinesSeed.json").write_text(
        json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "zh_missing.txt").write_text("\n".join(zh_missing) + "\n", encoding="utf-8")

    zh_pct = (len(exercises) - len(zh_missing)) / max(1, len(exercises)) * 100
    print(f"[done] 动作 {len(exercises)} 条 → {index_path}")
    print(f"[done] 简体中文覆盖率 {zh_pct:.1f}%（缺失 {len(zh_missing)} 条 → zh_missing.txt）")
    print(f"[done] 种子计划 {len(seed)} 套 → routinesSeed.json")
    print("[next] 运行 python tools/optimize_gifs.py 分发演示媒体")
    return 0


if __name__ == "__main__":
    sys.exit(main())
