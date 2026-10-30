# -*- coding: utf-8 -*-
"""生成「大展红途」线上演示入口二维码 + A4 点位牌（可打印，路演现场用）"""
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

URL = "https://dazhan-hongtu.app.workbuddy.host/?sharecode=EL5LQFTLBD"
OUT = r"D:\大展红途"

RED = (158, 42, 43)
DEEP = (110, 26, 26)
INK = (33, 28, 26)
GRAY = (130, 122, 118)
PAPER = (253, 250, 245)

BOLD = "C:/Windows/Fonts/msyhbd.ttc"
REG = "C:/Windows/Fonts/msyh.ttc"


def make_qr(fill=DEEP):
    q = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_M,
                      box_size=12, border=2)
    q.add_data(URL)
    q.make(fit=True)
    return q.make_image(fill_color=fill, back_color="white").convert("RGB")


def font(path, size):
    return ImageFont.truetype(path, size)


# ---------- 1. 纯净二维码（放 PPT / 直接扫码） ----------
qr = make_qr()
qr = qr.resize((720, 720), Image.NEAREST)
qr.save(f"{OUT}\\二维码_大展红途.png")
print("✓ 二维码_大展红途.png")

# ---------- 2. A4 点位牌（150dpi，1240x1754） ----------
W, H = 1240, 1754
img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

# 顶部红色装饰带
d.rectangle([0, 0, W, 18], fill=RED)

# 品牌行
d.text((90, 96), "大 展 红 途", font=font(BOLD, 44), fill=RED)
sub = "井冈山红色研学智能导览系统"
d.text((92, 156), sub, font=font(REG, 26), fill=GRAY)

# 分隔线
d.line([90, 214, W - 90, 214], fill=(220, 210, 200), width=2)

# 点位编号与名称
d.text((90, 258), "教学点位 01", font=font(REG, 30), fill=GRAY)
d.text((88, 306), "黄洋界哨口", font=font(BOLD, 96), fill=INK)

# 一行说明
d.text((92, 432), "1928年8月30日 · 黄洋界保卫战", font=font(REG, 30), fill=GRAY)

# 二维码（居中）
qz = 640
qr_big = make_qr().resize((qz, qz), Image.NEAREST)
qx = (W - qz) // 2
qy = 540
# 白底卡片 + 细边框，保证扫描对比度
d.rounded_rectangle([qx - 26, qy - 26, qx + qz + 26, qy + qz + 26],
                    radius=14, fill="white", outline=(226, 216, 206), width=2)
img.paste(qr_big, (qx, qy))

# 扫码提示
tip = "微信扫一扫  ·  开始讲解"
tw = d.textlength(tip, font=font(BOLD, 46))
d.text(((W - tw) / 2, qy + qz + 62), tip, font=font(BOLD, 46), fill=RED)

# 底部说明
lines = [
    "AI 讲解仅依据官方史料作答，超出范围会明确拒答。",
    "历史细节，讲错一句比不讲更糟。",
]
fy = qy + qz + 168
for ln in lines:
    lw = d.textlength(ln, font=font(REG, 26))
    d.text(((W - lw) / 2, fy), ln, font=font(REG, 26), fill=GRAY)
    fy += 42

# 底部细线 + 页脚
d.line([90, H - 120, W - 90, H - 120], fill=(226, 216, 206), width=2)
foot = "东华理工大学 · 软件学院"
d.text((90, H - 96), foot, font=font(REG, 24), fill=GRAY)

img.save(f"{OUT}\\点位牌_黄洋界_可打印.png", dpi=(150, 150))
print("✓ 点位牌_黄洋界_可打印.png")

# ---------- 3. 手机端扫码卡片（1080x1350，方便发群里） ----------
W2, H2 = 1080, 1350
c = Image.new("RGB", (W2, H2), (22, 18, 16))
dc = ImageDraw.Draw(c)
dc.rectangle([60, 70, W2 - 60, 96], fill=RED)
dc.text((70, 140), "大展红途", font=font(BOLD, 58), fill=(255, 244, 235))
dc.text((72, 218), "黄洋界哨口 · 教学点位 01", font=font(REG, 32), fill=(198, 182, 170))

qz2 = 620
q2 = make_qr().resize((qz2, qz2), Image.NEAREST)
c.paste(q2, ((W2 - qz2) // 2, 330))
t2 = "扫码体验 AI 讲解"
tw2 = dc.textlength(t2, font=font(BOLD, 44))
dc.text(((W2 - tw2) / 2, 1010), t2, font=font(BOLD, 44), fill=(240, 210, 190))
t3 = "超出史料范围的问题，它会拒答"
tw3 = dc.textlength(t3, font=font(REG, 28))
dc.text(((W2 - tw3) / 2, 1090), t3, font=font(REG, 28), fill=(160, 146, 136))
c.save(f"{OUT}\\扫码卡片_手机版.png")
print("✓ 扫码卡片_手机版.png")

print("\n入口：", URL)
