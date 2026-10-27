import zipfile, re, sys
p = r"D:\WorkBuddy\2026-10-24-19-43-02\output\rt20261024a\stage3\大展红途-井冈山红色研学智能导览系统项目计划书-定稿.docx"
z = zipfile.ZipFile(p)
xml = z.read("word/document.xml").decode("utf-8")
xml = xml.replace("</w:p>", "\n")
xml = xml.replace("</w:tr>", "\n")
xml = xml.replace("</w:tc>", " | ")
txt = re.sub(r"<[^>]+>", "", xml)
import html
txt = html.unescape(txt)
lines = [l.strip() for l in txt.split("\n")]
out = []
for l in lines:
    if l:
        out.append(l)
open(r"D:\大展红途\_plan.txt","w",encoding="utf-8").write("\n".join(out))
print("lines:", len(out))
