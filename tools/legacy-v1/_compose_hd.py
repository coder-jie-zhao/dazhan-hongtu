# -*- coding: utf-8 -*-
"""高清合成计划书插图：从 1398x2904 原始手机框截图合成，目标印刷级 300dpi+"""
from PIL import Image
import os

SRC = r"D:\大展红途\PPT素材\手机框"
OUT = r"D:\WorkBuddy\2026-10-24-19-43-02\output\rt20261024a\assets"
BG = (255, 255, 255, 255)          # 纯白，与纸面一致，避免浅灰块显脏
BORDER = (238, 242, 247, 255)
SHADOW = (208, 218, 230, 90)

os.makedirs(OUT, exist_ok=True)


def load(name):
    return Image.open(os.path.join(SRC, name + "-手机框.png")).convert("RGBA")


def fit_h(im, h):
    w = round(im.width * h / im.height)
    return im.resize((w, h), Image.LANCZOS)


def compose(names, canvas_w, gap, pad, out_name, radius_shadow=False):
    """等高手机横排，居中"""
    probe = load(names[0])
    ar = probe.height / probe.width                      # 2.077
    ph_w = (canvas_w - pad * 2 - gap * (len(names) - 1)) // len(names)
    ph_h = round(ph_w * ar)
    canvas_h = ph_h + pad * 2

    canvas = Image.new("RGBA", (canvas_w, canvas_h), BG)
    x = pad
    for n in names:
        im = fit_h(load(n), ph_h)
        canvas.alpha_composite(im, (x, pad))
        x += im.width + gap

    p = os.path.join(OUT, out_name)
    canvas.convert("RGB").save(p, "PNG", optimize=True)
    print(f"{out_name:14s} {canvas_w}x{canvas_h}  {len(names)}屏  "
          f"每屏宽 {ph_w}px  @15cm → {canvas_w / (15 / 2.54):.0f}dpi")
    return p


# 图2-1 三屏总览（整体形态）
compose(["入口页", "点位详情", "AI对话"], 1900, 40, 28, "fig-2-1.png")

# 图2-2 点位详情单屏（透明底，最大最清晰）
im = load("点位详情")
c = Image.new("RGBA", (im.width + 70, im.height + 70), BG)
c.alpha_composite(im, (35, 32))
p = os.path.join(OUT, "fig-2-2.png")
c.convert("RGB").save(p, "PNG", optimize=True)
print(f"fig-2-2.png    {c.width}x{c.height}  单屏  @7.5cm → {c.width / (7.5 / 2.54):.0f}dpi")

# 图2-3 AI 对话 + 现场任务
compose(["AI对话", "现场任务"], 1900, 48, 32, "fig-2-3.png")

# 图2-4 研学报告 + 教师端
compose(["研学报告", "教师端"], 1900, 48, 32, "fig-2-4.png")
