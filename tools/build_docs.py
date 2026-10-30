# -*- coding: utf-8 -*-
"""
生成 docs/ 门面素材：把中文命名的截图压成纯 ASCII 路径的展示图。

为什么单独生成一套而不是直接引用 v2/_shots/：
1. v2/_shots 里的文件名是中文，Markdown 图片链接遇到中文和全角括号容易解析失败；
2. 12 张原图 5.15MB，GitHub 首屏加载太慢，访客没耐心等；
3. 展示图需要统一宽度，避免 README 里图片高低不齐。

用法：python tools/build_docs.py
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "v2", "_shots")
PPT = os.path.join(ROOT, "v2", "PPT素材")
OUT = os.path.join(ROOT, "docs")

# (源文件, 目标文件名, 目标宽度, JPEG 质量)
SCREENS = [
    ("01-首页.png", "01-home.jpg", 780, 84),
    ("02-点位-黄洋界.png", "02-point-huangyangjie.jpg", 780, 82),
    ("03-点位-八角楼.png", "03-point-bajiaolou.jpg", 780, 82),
    ("04-点位-龙江书院.png", "04-point-longjiangshuyuan.jpg", 780, 82),
    ("12-AI对话-真实提问.png", "05-chat.jpg", 780, 86),
    ("06-现场任务.png", "06-task.jpg", 780, 82),
    ("07-研学报告.png", "07-report.jpg", 780, 84),
    ("08-教师端.png", "08-teacher.jpg", 780, 84),
    ("09-审核管线.png", "09-audit.jpg", 780, 82),
    ("10-检索自测.png", "10-selftest.jpg", 780, 82),
    ("11-AR规划.png", "11-ar.jpg", 780, 80),
]

OVERVIEW = [
    ("01-产品界面总览-深色.png", "overview-dark.jpg", 1600, 86),
    ("01-产品界面总览-浅色.png", "overview-light.jpg", 1600, 86),
]


def shrink(src, dst, width, quality):
    if not os.path.exists(src):
        print("  [skip] 源文件不存在:", os.path.relpath(src, ROOT))
        return 0
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")

    if im.width > width:
        height = round(im.height * width / im.width)
        im = im.resize((width, height), Image.LANCZOS)

    im.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)
    return os.path.getsize(dst)


def main():
    screens_dir = os.path.join(OUT, "screens")
    os.makedirs(screens_dir, exist_ok=True)

    total = 0
    count = 0

    print("界面截图 ->", os.path.relpath(screens_dir, ROOT))
    for rel, name, width, quality in SCREENS:
        size = shrink(os.path.join(SHOTS, rel), os.path.join(screens_dir, name), width, quality)
        if size:
            print("  %-34s %5.0f KB" % (name, size / 1024))
            total += size
            count += 1

    print("产品总览 ->", os.path.relpath(OUT, ROOT))
    for rel, name, width, quality in OVERVIEW:
        size = shrink(os.path.join(PPT, rel), os.path.join(OUT, name), width, quality)
        if size:
            print("  %-34s %5.0f KB" % (name, size / 1024))
            total += size

    print("-" * 46)
    print("共 %d 张，合计 %.2f MB" % (count, total / 1024 / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
