#!/usr/bin/env python3
"""
optimize_gifs.py — 演示媒体分发与校验（技术方案 阶段二第 2 项）

版权约束（见 NOTICE.md / openGym media/NOTICE.md）：
    动作演示媒体 © Aliaksandr Makatserchyk / Gym Visual，授权条款要求**保持原样**，
    不得裁剪、压缩重编码或二次剪辑。因此本脚本**不做任何图像处理**：
    - openGym 已提供 180px 的静帧（media/still/*.webp）与动画（media/clip/*.mp4），
      静帧即列表页"首帧缩略图"，动画即详情页演示，天然满足按需加载设计；
    - 本脚本只负责：原样拷贝到 app/public/exercises/、尺寸合规校验（≤180px）、体积报告。

用法：
    python optimize_gifs.py            # 拷贝 + 校验 + 报告
    python optimize_gifs.py --check    # 只校验已分发的产物，不拷贝
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_MEDIA = ROOT / "tools" / "_cache" / "openGym" / "catalogue" / "media"
OUT_DIR = ROOT / "app" / "public" / "exercises"

MAX_WIDTH = 180  # 授权条款允许的自托管展示宽度


def webp_width(path: Path) -> int | None:
    """读 webp 宽度（装了 Pillow 才校验，未安装返回 None 跳过）。"""
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        with Image.open(path) as im:
            return im.width
    except Exception:
        return None


def copy_tree(src: Path, dst: Path, suffix: str) -> tuple[int, int]:
    """原样拷贝一类媒体，返回 (文件数, 总字节)。"""
    dst.mkdir(parents=True, exist_ok=True)
    count, total = 0, 0
    for f in sorted(src.glob(f"*{suffix}")):
        target = dst / f.name
        if not target.is_file() or target.stat().st_size != f.stat().st_size:
            shutil.copyfile(f, target)
        count += 1
        total += f.stat().st_size
    return count, total


def main() -> int:
    parser = argparse.ArgumentParser(description="分发并校验 openGym 演示媒体（原样，不修改）")
    parser.add_argument("--check", action="store_true", help="只校验 app/public/exercises 下已有产物")
    args = parser.parse_args()

    if not args.check:
        if not CACHE_MEDIA.is_dir():
            print("[error] 未找到上游媒体缓存，请先运行 python tools/fetch_openGym.py")
            return 1
        for kind, suffix in (("still", ".webp"), ("clip", ".mp4")):
            n, size = copy_tree(CACHE_MEDIA / kind, OUT_DIR / kind, suffix)
            print(f"[copy] {kind}/：{n} 个文件，共 {size / 1024 / 1024:.1f} MB（原样拷贝，未修改）")

    # 校验：静帧宽度 ≤180px（授权条款），并统计产物总体积
    oversized = []
    total_files, total_size = 0, 0
    for kind, suffix in (("still", ".webp"), ("clip", ".mp4")):
        d = OUT_DIR / kind
        if not d.is_dir():
            print(f"[warn] 缺少目录：{d}")
            continue
        for f in sorted(d.glob(f"*{suffix}")):
            total_files += 1
            total_size += f.stat().st_size
            if suffix == ".webp":
                w = webp_width(f)
                if w is not None and w > MAX_WIDTH:
                    oversized.append(f"{f.name}（宽 {w}px）")
    print(f"[report] 媒体共 {total_files} 个文件，{total_size / 1024 / 1024:.1f} MB")
    if oversized:
        print(f"[warn] 超过 {MAX_WIDTH}px 宽度的静帧 {len(oversized)} 个（授权条款上限，请人工核对）：")
        for name in oversized[:20]:
            print(f"  - {name}")
    else:
        print(f"[ok] 静帧尺寸均 ≤{MAX_WIDTH}px（或未安装 Pillow 跳过校验：pip install Pillow）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
