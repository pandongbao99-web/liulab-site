# 刘琳课题组 · 网站

纯静态站点：Markdown 写内容 → 一条命令生成 `docs/` → GitHub Pages 直接托管。
没有数据库、没有服务器、没有需要续费的建站套餐，一年的支出只有域名费。

- 站点地址：**待绑定**（见「绑定自有域名」）
- 托管：GitHub Pages（`docs/` 目录，main 分支，无需 CI）
- 域名：阿里云注册，DNSPod/万网解析（`dns1/dns2.hichina.com`）

---

## 一、本地预览

```bash
# 需要 Node 18+
node build.mjs                    # 生成 docs/
python3 -m http.server 8788 --directory docs
# 浏览器打开 http://127.0.0.1:8788
```

改了 `content/` 里的文件后重新跑 `node build.mjs` 即可，页面是纯 HTML，刷新就生效。

## 二、目录结构

```
content/            所有内容（只改这里）
  site.md           课题组名称、标语、邮箱、电话、地址、域名 ← 首页文案也在这
  research.md       研究方向（每个 `## 标题` 是一个方向）
  publications.md   论文（每年一个 `## 年份`，每篇一行）
  projects.md       项目（`## 主持` / `## 参与`，每项一行）
  people/           成员，一人一个 .md 文件
  news/             新闻，一条一个 .md 文件
assets/             样式表、图标
build.mjs           构建脚本（零依赖，不用 npm install）
docs/               生成结果 ← GitHub Pages 托管这个目录，不要手改
```

### 内容格式

**论文**（`content/publications.md`）：`引用信息 | DOI链接`，竖线前可省略链接。

```
## 2025
Liu, L.*, Shi, D., & Klemperer, S. L.* (2025). 标题. 期刊, 卷(期), 页码. | https://doi.org/10.1038/xxxx
```

**项目**（`content/projects.md`）：`名称 | 来源 | 起止时间`。

**成员**（`content/people/姓名拼音.md`）：文件头写基本信息，正文用 Markdown。

```markdown
---
name: 张三
name_en: San Zhang
role: 博士研究生
title: 2024 级
email: zhangsan@stu.ouc.edu.cn
order: 2
join: 2024
tags: 地震学 | Python
---
一两句研究方向介绍。
## 学习经历
- 2024.09 – 至今　中国海洋大学，博士在读
```

`order` 决定成员排序，数字小的在前。

**新闻**（`content/news/2026-05-01-xxx.md`）：文件名随意，`year` 决定年份分组。

```markdown
---
year: 2026
title: 标题
link: https://doi.org/xxx   # 可选
---
正文一两段。
```

## 三、发布（首次，约 10 分钟）

1. 在 GitHub 新建仓库，例如 `liulab-site`，**Public**（免费账号的 Pages 只支持公开仓库）。
2. 在本目录执行：

```bash
git remote add origin git@github.com:<你的账号>/liulab-site.git
git push -u origin main
```

3. 仓库 **Settings → Pages**：Source 选 `Deploy from a branch`，Branch 选 `main` / 目录选 **`/docs`**，Save。
4. 等 1–2 分钟，访问 `https://<你的账号>.github.io/liulab-site/`。
   同时把 `content/site.md` 的 `domain` 改掉、重新 `node build.mjs`，
   让 `CNAME`、`sitemap.xml` 里的地址正确。
5. 打开 Settings → Pages → Custom domain，填入域名，勾选 **Enforce HTTPS**。

### 绑定自有域名（阿里云 DNS）

在阿里云「云解析 DNS」里加这几条记录（`@` 表示主域名本身）：

| 记录类型 | 主机记录 | 记录值 |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<你的账号>.github.io` |

（可选）IPv6：再加 4 条 `AAAA`，值分别为
`2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153`。

解析生效后回到 Settings → Pages 点 **Enforce HTTPS**（证书由 GitHub 自动签发，通常 15 分钟内）。

## 四、日常维护（每年 4–8 小时）

| 场景 | 操作 | 用时 |
|---|---|---|
| 发一篇新论文 | 在 `publications.md` 对应年份下加一行 | 1 分钟 |
| 加一位新成员 | 复制一个 `content/people/*.md`，改内容 | 5 分钟 |
| 发一条新闻 | 新建 `content/news/年份-标题.md` | 3 分钟 |
| 改首页介绍 | 改 `content/site.md` 正文 | 2 分钟 |

改完运行 `node build.mjs`，提交并推送：

```bash
git add -A && git commit -m "更新：新增一篇论文" && git push
```

推送后 1–2 分钟自动上线。

### 管理员（1 主 1 备）

| 角色 | 职责 |
|---|---|
| 主管理员 | 日常更新、构建、发布 |
| 备管理员 | 持有 GitHub 与域名账号的恢复手段；主管理员失联时接管 |

账号原则：仓库挂在 **GitHub Organization** 而不是个人账号下（人走仓库留）；
注册邮箱用课题组公共邮箱；开双因素认证并打印恢复码存档；
域名开自动续费，到期前 90/30/7 天会邮件提醒。

### 交接清单（毕业前 1 个月）

1. 移交 GitHub Org、域名注册商、公共邮箱的登录权限；
2. 用新管理员账号跑一次 `node build.mjs` 并推送，确认能发布；
3. 核对域名到期日与自动续费状态，写进课题组年度日历；
4. 把本 README 的「管理员」一栏改成新的人名；
5. 仓库打 tag，导出 zip 存学院网盘一份。

## 五、常见问题

**构建报错找不到文件？** 确认在项目根目录执行，且 `content/` 结构没被改名。

**图片放哪？** 放 `assets/` 下，Markdown 里写 `![说明](../assets/img/xxx.jpg)`。
上线前压缩到 300 KB 以内；视频不要放仓库，用 B 站外链。

**页面上线后还是旧的？** GitHub Pages 有 1–10 分钟缓存，浏览器强刷（Cmd/Ctrl+Shift+R）。

**要不要备案？** 托管在 GitHub Pages（境外）不需要 ICP 备案；
但如果之后换成国内服务器或国内 CDN，就必须备案，且备案主体是学校。

**内容红线：** 研究区地图用自然资源部标准地图或标注审图号；
实测数据、精确坐标、未公开项目不上网；论文插图版权属出版社，不要直接截图上传。
