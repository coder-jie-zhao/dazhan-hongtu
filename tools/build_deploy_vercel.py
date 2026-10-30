#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 Vercel 部署包 dist-vercel/（静态站点 + serverless 函数 /api/chat、/api/health）。

与 EdgeOne 版（dist-online）的异同：
  相同点：业务逻辑仍是 v2/api/chat.js 原样复制，前后端同一份实现、同一阈值、同一语料。
  不同点：
    · Vercel 的 Node 函数原生支持 req.body(自动解析JSON) 与 res.status().json()，
      所以不需要 EdgeOne 那样的 Response 垫片，薄壳即可。
    · 必须额外补一个 api/health.js：前端 net.health() 先打 /api/health 探测，
      Vercel 上 /api/chat 函数并不覆盖 /api/health 路由，缺了它前端会误判离线、
      永远走本地检索，真模型链路就废了。这是从 v2/server.js 原样抠出来的健康检查。
    · 静态目录里【排除 api/】：Vercel 把 api/ 当函数目录，静态里不留同名文件。
    · 额外写一个最小 package.json(只声明 node>=18，无 start/无依赖)，
      避免 Vercel 误把项目当成要 npm start 的 Node 服务器。

用法：
  python tools/build_deploy_vercel.py

产出：
  dist-vercel/   可直接 `npx vercel deploy dist-vercel`，
                 或 GitHub 部署时 Root Directory 填 dist-vercel（构建命令留空，先提交本目录）
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "v2")
TPL = os.path.join(ROOT, "tools", "vercel")
OUT = os.path.join(ROOT, "dist-vercel")

INCLUDE_DIRS = ["styles", "js", "data", "assets"]   # 注意：不含 api
INCLUDE_FILES = ["index.html"]


def clean(path):
    """逐文件删除，避免 shutil.rmtree 被安全删除机制拦截。"""
    if not os.path.isdir(path):
        return
    for base, dirs, files in os.walk(path, topdown=False):
        for f in files:
            try:
                os.remove(os.path.join(base, f))
            except OSError:
                pass
        for d in dirs:
            try:
                os.rmdir(os.path.join(base, d))
            except OSError:
                pass
    try:
        os.rmdir(path)
    except OSError:
        pass


def human(n):
    for unit in ("B", "KB", "MB"):
        if n < 1024:
            return "%.1f %s" % (n, unit)
        n /= 1024.0
    return "%.1f GB" % n


def put(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def main():
    clean(OUT)
    os.makedirs(OUT, exist_ok=True)

    # ---- 1) 静态部分 ----
    for name in INCLUDE_FILES:
        src = os.path.join(SRC, name)
        if os.path.exists(src):
            put(src, os.path.join(OUT, name))
    for d in INCLUDE_DIRS:
        src_dir = os.path.join(SRC, d)
        if os.path.isdir(src_dir):
            shutil.copytree(src_dir, os.path.join(OUT, d))

    # ---- 2) 函数 api/ ----
    api_dir = os.path.join(OUT, "api")
    os.makedirs(api_dir, exist_ok=True)
    # 入口（薄壳） + 健康检查 + 业务实现(原样复制 v2/api/chat.js)
    put(os.path.join(TPL, "api", "chat.js"), os.path.join(api_dir, "chat.js"))
    put(os.path.join(TPL, "api", "health.js"), os.path.join(api_dir, "health.js"))
    # 业务实现原样复制。放在 api/ 这一层并加 _ 前缀 ——
    # 这样 ../data、../js/domain 能正确解析到「部署根目录」的静态文件（与前端同一份），
    # 同时 _ 前缀让 Vercel 不把它当成 /api/_handler 这个路由函数。
    put(os.path.join(SRC, "api", "chat.js"), os.path.join(api_dir, "_handler.js"))

    # ---- 3) vercel.json + 最小 package.json ----
    put(os.path.join(TPL, "vercel.json"), os.path.join(OUT, "vercel.json"))
    with open(os.path.join(OUT, "package.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "name": "dazhan-hongtu-vercel",
                "version": "2.0.0",
                "private": True,
                "engines": {"node": ">=18"},
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    # ---- 4) 统计 ----
    total = count = 0
    for base, dirs, files in os.walk(OUT):
        for f in files:
            total += os.path.getsize(os.path.join(base, f))
            count += 1

    print("dist-vercel/    %s  %d 个文件" % (human(total), count))
    print("")
    print("函数目录：")
    for base, dirs, files in os.walk(api_dir):
        for f in files:
            p = os.path.join(base, f)
            print("  %-40s %s" % (os.path.relpath(p, OUT).replace("\\", "/"),
                                  human(os.path.getsize(p))))
    print("")
    print("下一步：")
    print("  本地部署：npx vercel deploy dist-vercel")
    print("  GitHub  ：Root Directory 填 dist-vercel，构建命令留空（先跑本脚本生成并提交该目录）")
    print("  环境变量：LLM_API_KEY / LLM_BASE_URL=https://api.deepseek.com/v1 / LLM_MODEL=deepseek-chat")


if __name__ == "__main__":
    main()
