# -*- coding: utf-8 -*-
"""生成三个点位的深链二维码和 A4 点位牌。

用法：
    python _make_qr.py https://你的域名.edgeone.app/?eo_token=xxx

base URL 用当天 EdgeOne「预览」生成的链接（含 token），三个点位在它后面
各带 #/point?id=xxx。预览链接 3 小时过期，所以二维码要现场生成、当场用。
断网兜底时把 base 换成本机地址 http://127.0.0.1:8130/ 即可。
"""
import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8130/").rstrip("/") + "/"
OUT = r"D:\大展红途\materials"

POINTS = [
    ("01", "huangyangjie", "黄洋界哨口", "1928.8 · 黄洋界保卫战"),
    ("02", "bajiaolou", "八角楼毛泽东同志旧居", "1928.10 · 八角楼的灯光"),
    ("03", "longjiangshuyuan", "龙江书院", "1927 · 红军教导队旧址"),
]

RED = (158, 42, 43)
INK = (33, 28, 26)
GRAY = (130, 122, 118)
PAPER = (253, 250, 245)
BOLD = "C:/Windows/Fonts/msyhbd.ttc"
REG = "C:/Windows/Fonts/msyh.ttc"


def font(path, size):
    return ImageFont.truetype(path, size)


def make_qr(url):
    q = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_M,
                      box_size=12, border=2)
    q.add_data(url)
    q.make(fit=True)
    return q.make_image(fill_color=RED, back_color="white").convert("RGB")


for num, pid, name, sub in POINTS:
    url = BASE + "#/point?id=" + pid
    qr = make_qr(url)

    # 纯净二维码
    qr.resize((720, 720), Image.NEAREST).save(f"{OUT}\\二维码_{num}_{name}.png")

    # A4 点位牌
    W, H = 1240, 1754
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 18], fill=RED)
    d.text((90, 96), "大 展 红 途", font=font(BOLD, 44), fill=RED)
    d.text((92, 156), "井冈山红色研学智能导览系统", font=font(REG, 26), fill=GRAY)
    d.line([90, 214, W - 90, 214], fill=(220, 210, 200), width=2)
    d.text((90, 258), "教学点位 " + num, font=font(REG, 30), fill=GRAY)
    d.text((88, 306), name, font=font(BOLD, 72 if len(name) > 8 else 88), fill=INK)
    d.text((92, 432), sub, font=font(REG, 30), fill=GRAY)

    qz = 640
    qbig = qr.resize((qz, qz), Image.NEAREST)
    qx, qy = (W - qz) // 2, 540
    d.rounded_rectangle([qx - 26, qy - 26, qx + qz + 26, qy + qz + 26],
                        radius=14, fill="white", outline=(226, 216, 206), width=2)
    img.paste(qbig, (qx, qy))

    tip = "微信扫一扫  ·  开始讲解"
    tw = d.textlength(tip, font=font(BOLD, 46))
    d.text(((W - tw) / 2, qy + qz + 62), tip, font=font(BOLD, 46), fill=RED)

    foot_lines = [
        "AI 讲解仅依据官方史料作答，超出范围会明确拒答。",
        "历史细节，讲错一句比不讲更糟。",
    ]
    fy = qy + qz + 168
    for ln in foot_lines:
        lw = d.textlength(ln, font=font(REG, 26))
        d.text(((W - lw) / 2, fy), ln, font=font(REG, 26), fill=GRAY)
        fy += 42
    d.line([90, H - 120, W - 90, H - 120], fill=(226, 216, 206), width=2)
    d.text((90, H - 96), "东华理工大学 · 软件学院", font=font(REG, 24), fill=GRAY)

    img.save(f"{OUT}\\点位牌_{num}_{name}.png", dpi=(150, 150))
    print("OK", num, name, "->", url)

print("\nbase:", BASE)
