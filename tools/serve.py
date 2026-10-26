#!/usr/bin/env python3
"""
serve.py — 本地静态服务器（技术方案 2.2 / 阶段五自用部署）

用途：
    - 开发自测 app/dist 构建产物；
    - 局域网内手机访问（绑定 0.0.0.0，手机与电脑同一 Wi-Fi 下用电脑 IP 打开）。

用法：
    python serve.py                 # 服务 ../app/dist，端口 7100
    python serve.py --dir ../app/dist --port 8080
"""
from __future__ import annotations

import argparse
import functools
import http.server
import socket
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def lan_ip() -> str:
    """取本机局域网 IP（用于提示手机访问地址）。"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main() -> int:
    parser = argparse.ArgumentParser(description="FitLog 本地静态服务器")
    parser.add_argument("--dir", default=str(ROOT / "app" / "dist"), help="静态文件目录（默认 app/dist）")
    parser.add_argument("--port", type=int, default=7100, help="端口（默认 7100）")
    args = parser.parse_args()

    serve_dir = Path(args.dir).resolve()
    if not serve_dir.is_dir():
        print(f"[error] 目录不存在：{serve_dir}\n        请先在 app/ 下执行 npm run build")
        return 1

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(serve_dir))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", args.port), handler) as httpd:
        ip = lan_ip()
        print(f"[serve] 本机访问：  http://localhost:{args.port}/")
        print(f"[serve] 手机访问：  http://{ip}:{args.port}/  （与电脑同一 Wi-Fi）")
        print("[serve] Ctrl+C 停止")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
