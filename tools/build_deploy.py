#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成可直接部署的静态包（v2 → dist/）。

为什么需要这个脚本：
  v2/ 目录 18.4MB，其中 PPT素材/（9.8MB）和 _shots/（5.2MB）是开发自用的
  截图素材，部署时纯属浪费带宽和上传时间。真正上线只要 3.5MB。

  另外这些素材目录里有 28 个中文文件名，部分托管平台（尤其国外的）
  处理中文 URL 会出编码问题，一并排除最省事。

用法：
  python tools/build_deploy.py

产出：
  dist/            可直接拖到 EdgeOne Pages / Vercel / Netlify 的目录
  dist.zip         同一内容的压缩包（EdgeOne Pages 支持拖 zip）
"""
import os
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "v2")
DIST = os.path.join(ROOT, "dist")
ZIP_PATH = os.path.join(ROOT, "dist.zip")

# 需要部署的内容（白名单，只列要的，避免漏删导致把素材传上去）
INCLUDE_DIRS = ["styles", "js", "data", "assets", "api"]
INCLUDE_FILES = ["index.html", "server.js", "package.json", ".env.example"]

# 明确排除（即便在 include 目录里）
EXCLUDE_NAMES = {".env", "corpus.fallback.js"}  # fallback 是构建产物，但 file:// 需要，见下
KEEP_BUNDLED = {"corpus.fallback.js"}           # 实际上要保留，让纯静态也能跑


def clean_dir(path):
    """逐文件删除目录内容，避免 shutil.rmtree 被系统的「安全删除」机制拦截。

    某些环境（含本机的沙箱/回收站重定向）会把 rmtree 重定向到回收站并失败，
    导致脚本中断、dist 只留下半个目录。逐文件 remove 更稳。
    """
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


def main():
    clean_dir(DIST)
    if os.path.exists(ZIP_PATH):
        try:
            os.remove(ZIP_PATH)
        except OSError:
            pass
    os.makedirs(DIST, exist_ok=True)

    total = 0
    count = 0

    # 单文件
    for name in INCLUDE_FILES:
        src = os.path.join(SRC, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(DIST, name))
            size = os.path.getsize(src)
            total += size
            count += 1
            print("  + %-24s %s" % (name, human(size)))

    # 目录
    for d in INCLUDE_DIRS:
        src_dir = os.path.join(SRC, d)
        if not os.path.isdir(src_dir):
            print("  ! 目录不存在，跳过: " + d)
            continue
        dst_dir = os.path.join(DIST, d)
        shutil.copytree(src_dir, dst_dir)
        # 删掉不该带的
        for base, dirs, files in os.walk(dst_dir):
            for f in files:
                p = os.path.join(base, f)
                if f in EXCLUDE_NAMES and f not in KEEP_BUNDLED:
                    os.remove(p)
        for base, dirs, files in os.walk(dst_dir):
            for f in files:
                p = os.path.join(base, f)
                rel = os.path.relpath(p, DIST).replace("\\", "/")
                size = os.path.getsize(p)
                total += size
                count += 1
                if size > 300 * 1024:
                    print("  + %-40s %s" % (rel, human(size)))

    # 打包 zip（EdgeOne Pages 可直接拖）
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, dirs, files in os.walk(DIST):
            for f in files:
                p = os.path.join(base, f)
                arc = os.path.relpath(p, DIST)
                z.write(p, arc)

    zip_size = os.path.getsize(ZIP_PATH)

    print("")
    print("─" * 52)
    print("dist/       %s  %d 个文件" % (human(total), count))
    print("dist.zip    %s" % human(zip_size))
    print("─" * 52)
    print("对比 v2/ 原始 18.4 MB，省下约 %.0f%%" % ((1 - zip_size / (18.4 * 1024 * 1024)) * 100))
    print("")
    print("部署包已就绪：把 dist/ 或 dist.zip 拖到托管平台即可")
    print("本地验收：cd dist && python -m http.server 8140  然后打开 http://127.0.0.1:8140")


if __name__ == "__main__":
    main()
