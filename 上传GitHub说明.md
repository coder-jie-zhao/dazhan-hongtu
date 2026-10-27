# 上传到 GitHub · 操作说明

> 本地仓库已经准备好了：两个 commit、两个 tag、remote 已配好。
> 你只需要在**自己的终端**里跑三条命令。

---

## 一、先看一眼本地状态（确认一切就绪）

```bash
cd D:\大展红途

git log --oneline --decorate
```

应该看到：

```
c78a73a (HEAD -> main, tag: v2.0.0)  v2.0.0: 三点位全量重构
d440b09 (tag: v1.0.0)                 v1.0.0: 黄洋界单点位原型基线
```

## 二、推送

```bash
git push -u origin main
git push origin --tags
```

第二条会把 `v1.0.0` 和 `v2.0.0` 两个 tag 一起推上去。
在 GitHub 仓库的 **Releases** 页面可以给 tag 写说明、传 PPT 素材。

## 三、如果推送失败

### 情况 A：401 / 凭据错误

```bash
gh auth login          # 如果没登录过
gh auth setup-git      # 让 git 使用 gh 的凭据
git push -u origin main
```

### 情况 B：SSL / 证书错误（公司网络或代理常见）

```bash
git config --global http.sslBackend schannel
git config --global http.schannelCheckRevoke false
git push -u origin main
```

### 情况 C：网络慢或超时

```bash
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999
git push -u origin main
```

### 情况 D：想换 SSH

```bash
ssh -T git@github.com          # 确认 SSH key 已配置
git remote set-url origin git@github.com:coder-jie-zhao/dazhan-hongtu.git
git push -u origin main
git push origin --tags
```

---

## 仓库地址

https://github.com/coder-jie-zhao/dazhan-hongtu

仓库已创建好（public），当前是空的——推送后就有内容了。

---

## 推送后建议做的事

### 1. 补一个 README（仓库首页）

根目录目前没有 README，GitHub 首页会显示文件列表。建议在根目录加一个 `README.md`，
内容可以写：

```markdown
# 大展红途 · 井冈山红色研学智能导览系统

东华理工大学第九届创新创业基本技能大赛 · 项目路演赛道

- [v2.0.0 三点位重构版](v2/README.md) —— 完整说明、架构、验证方法
- v1.0.0 单点位原型（根目录）—— 作为路演兜底方案保留

## 快速开始
cd v2
node server.js        # 打开 http://127.0.0.1:8130
node _test.js         # 检索验收：34 项用例

## 图片出处
v2/assets/img/ 下 11 张实景照全部来自井冈山革命博物馆官网，
每张的原始 URL 与来源页记录在 v2/assets/img/credits.json
```

### 2. 建 Release

仓库右侧 **Releases → Draft a new release**：

- Tag: `v2.0.0`
- Title: `v2.0.0 · 三点位全量重构`
- 说明可以摘 `v2/README.md` 的「v2 相对 v1 改了什么」
- 附件上传 `v2/PPT素材/01-产品界面总览-深色.png` 和 `-浅色.png`

这样评委点进 Releases 就能看到版本对比和成品图。

### 3. 关于版本历史的展示

两个 tag 已经打好，GitHub 上会显示成时间线。提交信息里写清了每次改了什么，
包括几个关键的技术决策（检索逻辑单一化、停用词 bug、合规修正），
可以直接当作答辩时的"工程过程"讲。

---

## 附：本地已有的版本历史

| Tag | 内容 | 说明 |
|---|---|---|
| `v1.0.0` | 根目录 `index.html` / `app.js` / `styles.css` / `api/` / `data/` | 黄洋界单点位原型，6 视图，18 条语料。**保留作为路演兜底** |
| `v2.0.0` | `v2/` 目录 | 三点位，9 视图，37 条语料，34 项验收用例全通过。**主推版本** |

两版端口不同（v1: 8123，v2: 8130），互不干扰。
