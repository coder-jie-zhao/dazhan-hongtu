#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从井冈山革命博物馆官网抓取三个点位的实景照片，存入 v2/assets/img/。
官方站点正文图片通过 /robotAttach/showImg?id=... 提供，这里同时支持
  (a) <img src="...showImg?id=xxx"> 直接命中
  (b) 页面正文里裸出现的 id=xxx（图片以背景/富文本方式插入）
每张图同时写入 _credits.json，记录来源页与图片 URL，供答辩说明。
"""
import json
import os
import re
import ssl
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "v2", "assets", "img")
os.makedirs(OUT, exist_ok=True)

PROXY = "http://127.0.0.1:52889"
opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}),
    urllib.request.HTTPSHandler(context=ssl.create_default_context()),
)
opener.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WorkBuddyEdu/1.0")]

PAGES = [
    ("https://jgsgmbwg.com/list/article/1666995661924122651", "huangyangjie", "黄洋界哨口工事遗址"),
    ("https://jgsgmbwg.com/list/article/1666995661924122650", "huangyangjie", "黄洋界保卫战胜利纪念碑"),
    ("https://jgsgmbwg.com/list/article/1666995661924122649", "huangyangjie", "黄洋界红四军哨口营房旧址"),
    ("https://jgsgmbwg.com/list/article/1666995661924122648", "huangyangjie", "红军小路"),
    ("https://jgsgmbwg.com/list/article/1666995661924122647", "huangyangjie", "红军挑粮歇息处遗址"),
    ("https://jgsgmbwg.com/list/article/1666995708753526803", "huangyangjie", "茨坪革命旧址群介绍"),
    ("https://jgsgmbwg.com/list/article/1666995661924122678", "longjiang", "龙江书院"),
    ("https://jgsgmbwg.com/list/article/1666995661924122679", "longjiang", "毛泽东朱德会面旧址"),
    ("https://jgsgmbwg.com/list/article/1666995661924122680", "longjiang", "红四军建军广场旧址"),
    ("https://jgsgmbwg.com/list/article/1666995661924122676", "longjiang", "工农革命军军官教导队旧址"),
    ("https://jgsgmbwg.com/list/article/1666995661924122677", "longjiang", "红四军党的第一次代表大会会址"),
    ("https://jgsgmbwg.com/list/article/1666995661924122681", "longjiang", "中国红军第四军军部旧址"),
    ("https://www.jgsgmbwg.com/?ObRwSys=AbouT", "huangyangjie", "博物馆首页"),
]

# 站点正文的富文本里图片以 id=数字 出现（被 showImg 接口消费）
ID_RE = re.compile(r"showImg\?id=([0-9]+)")
BARE_ID_RE = re.compile(r"(?:^|[\s\"'(])id=([0-9]{15,25})")


def fetch(url, timeout=40):
    with opener.open(urllib.request.Request(url), timeout=timeout) as r:
        raw = r.read()
    for enc in ("utf-8", "gbk", "gb18030"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "ignore")


def download(url, timeout=45):
    with opener.open(urllib.request.Request(url), timeout=timeout) as r:
        data = r.read()
        ctype = (r.headers.get("Content-Type") or "").lower()
    return data, ctype


def main():
    credits = {}
    used_ids = set()
    for url, point, title in PAGES:
        try:
            html = fetch(url)
        except Exception as e:
            print("[FAIL page] %s -> %s" % (title, e))
            continue

        ids = []
        for m in ID_RE.finditer(html):
            ids.append(m.group(1))
        for m in BARE_ID_RE.finditer(html):
            ids.append(m.group(1))
        # 去重保序
        ordered = []
        for i in ids:
            if i not in ordered:
                ordered.append(i)

        saved_here = 0
        for idx, iid in enumerate(ordered[:14]):
            if iid in used_ids:
                continue
            img_url = "https://jgsgmbwg.com/robotAttach/showImg?id=" + iid
            try:
                data, ctype = download(img_url)
            except Exception as e:
                print("   [skip] id=%s -> %s" % (iid, e))
                continue
            if len(data) < 8000:
                continue
            if "html" in ctype or data[:20].lower().startswith(b"<!doc"):
                continue
            ext = ".jpg"
            if "png" in ctype:
                ext = ".png"
            elif "webp" in ctype:
                ext = ".webp"
            slug = re.sub(r"[^0-9A-Za-z\u4e00-\u9fa5]+", "", title)[:10]
            fn = "%s-%s-%02d%s" % (point, slug, idx, ext)
            with open(os.path.join(OUT, fn), "wb") as f:
                f.write(data)
            credits[fn] = {
                "point": point,
                "title": title,
                "page": url.split("?")[0],
                "image": img_url,
                "bytes": len(data),
            }
            used_ids.add(iid)
            saved_here += 1
            print("   saved %s (%d bytes)" % (fn, len(data)))
        print("[page] %s -> %d ids, %d saved" % (title, len(ordered), saved_here))

    with open(os.path.join(OUT, "_credits.json"), "w", encoding="utf-8") as f:
        json.dump(credits, f, ensure_ascii=False, indent=2)
    print("\nTOTAL saved: %d" % len(credits))


if __name__ == "__main__":
    main()
