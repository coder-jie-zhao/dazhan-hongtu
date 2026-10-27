#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 file:// 兜底数据文件。

背景：双击 index.html 用 file:// 打开时，fetch("data/corpus.json") 会被浏览器
的 CORS 策略拦掉，页面就白了。这条铁律是路演现场的最后一道保险
（需求书第一节：「最坏情况下用笔记本本地双击 index.html 也能演」）。

做法：把 corpus.json 转成一个普通 <script> 引入的 JS 文件，挂到 window.DZHT_DATA。
app.js 先 fetch，失败就回落到它。

用法：python tools/build_fallback.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "v2", "data", "corpus.json")
DST = os.path.join(ROOT, "v2", "data", "corpus.fallback.js")

with open(SRC, encoding="utf-8") as f:
    data = json.load(f)

body = json.dumps(data, ensure_ascii=False, indent=2)

out = (
    "/* 本文件由 tools/build_fallback.py 自动生成，请勿手工编辑。\n"
    "   作用：file:// 直接双击打开 index.html 时，fetch 读不到 corpus.json，\n"
    "   由这个内联副本兜底。数据来源与 data/corpus.json 完全一致。\n"
    "   重新生成：python tools/build_fallback.py */\n"
    "window.DZHT_DATA = " + body + ";\n"
)

with open(DST, "w", encoding="utf-8") as f:
    f.write(out)

print("written: %s (%d bytes)" % (DST, len(out.encode("utf-8"))))
