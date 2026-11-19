#!/usr/bin/env node
/**
 * 课题组网站构建脚本 —— 零依赖，只需要 Node 18+
 *
 *   node build.mjs        # 生成 docs/ 目录（GitHub Pages 直接托管这个目录）
 *
 * 内容全部在 content/ 里，改完重新运行即可。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const CONTENT = path.join(ROOT, "content");
const ASSETS = path.join(ROOT, "assets");
const OUT = path.join(ROOT, "docs");
const NAV = [
  ["index.html", "首页", "Home"],
  ["research.html", "研究方向", "Research"],
  ["people.html", "成员", "People"],
  ["publications.html", "论文", "Publications"],
  ["news.html", "新闻", "News"],
  ["join.html", "加入我们", "Join Us"],
];

/* ----------------------------- 基础工具 ----------------------------- */

const read = (p) => fs.readFileSync(p, "utf8");
const listMd = (p) =>
  fs.existsSync(p)
    ? fs.readdirSync(p).filter((f) => f.endsWith(".md")).sort()
    : [];

function parseFrontMatter(text) {
  const m = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text.trim() };
  const data = {};
  let lastKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i < 0) {
      if (lastKey) {
        const cur = data[lastKey];
        const t = line.trim();
        const sep = isCJK(cur.slice(-1)) && isCJK(t[0]) ? "" : " ";
        data[lastKey] = (cur + sep + t).trim();
      }
      continue;
    }
    const key = line.slice(0, i).trim();
    lastKey = key;
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    data[key] = val;
  }
  return { data, body: text.slice(m[0].length).trim() };
}

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isCJK = (ch) => /[\u3000-\u9fff\uff00-\uffef]/.test(ch || "");

/** 行内语法：链接、加粗、斜体、行内代码 */
function inline(raw) {
  let s = escapeHtml(raw);
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  return s;
}

/** 段落内换行：中文之间直接拼接，西文之间补空格 */
function joinLines(lines) {
  return lines.reduce((acc, line, idx) => {
    const l = line.trim();
    if (idx === 0) return l;
    if (!l) return acc;
    const prev = acc.slice(-1);
    const next = l[0];
    const sep = isCJK(prev) && isCJK(next) ? "" : " ";
    return acc + sep + l;
  }, "");
}

/** 极简 Markdown：二级标题、无序列表、引用、段落 */
function md(raw, level = 2) {
  const blocks = raw.split(/\r?\n\s*\r?\n/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (!lines.length) continue;
    if (/^##\s+/.test(lines[0])) {
      out.push(`<h${level}>${inline(lines[0].replace(/^##\s+/, ""))}</h${level}>`);
      const rest = lines.slice(1);
      if (rest.length) out.push(...md(rest.join("\n\n"), level));
    } else if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
      out.push(
        `<ul>${lines
          .map((l) => `<li>${inline(l.trim().replace(/^[-*]\s+/, ""))}</li>`)
          .join("")}</ul>`
      );
    } else if (lines.every((l) => l.trim().startsWith(">"))) {
      out.push(
        `<blockquote>${inline(
          lines.map((l) => l.trim().replace(/^>\s?/, "")).join(" ")
        )}</blockquote>`
      );
    } else {
      out.push(`<p>${inline(joinLines(lines))}</p>`);
    }
  }
  return out.join("\n");
}

/** 解析 "a | b | c" 行，跳过标题行 */
function pipeLines(body) {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("##") && !l.startsWith("-"))
    .map((l) => l.split("|").map((x) => x.trim()));
}

/* ----------------------------- 读取内容 ----------------------------- */

const site = parseFrontMatter(read(path.join(CONTENT, "site.md")));
const S = site.data;

const research = (() => {
  const { data, body } = parseFrontMatter(read(path.join(CONTENT, "research.md")));
  const blocks = body.split(/\r?\n##\s+/).filter(Boolean);
  const items = blocks.map((b) => {
    const lines = b.split(/\r?\n/);
    const title = lines[0].trim().replace(/^#+\s*/, "");
    let i = 1;
    let titleEn = "";
    if (lines[1] && !lines[1].trim().startsWith("-") && !lines[1].includes("。")) {
      titleEn = lines[1].trim();
      i = 2;
    }
    const rest = lines.slice(i).join("\n");
    const kwLine = rest.split(/\r?\n/).find((l) => l.trim().startsWith("- 关键词"));
    const keywords = kwLine
      ? kwLine
          .replace(/^-\s*关键词[:：]\s*/, "")
          .split("·")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const text = rest
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith("- 关键词"))
      .join("\n");
    return { title, titleEn, html: md(text), keywords };
  });
  return { data, items, intro: data.lead || "" };
})();

const publications = (() => {
  const { data, body } = parseFrontMatter(
    read(path.join(CONTENT, "publications.md"))
  );
  const groups = [];
  let cur = null;
  let n = 0;
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("##")) {
      cur = { year: t.replace(/^##\s*/, ""), items: [] };
      groups.push(cur);
      continue;
    }
    const [cite, url] = t.split("|").map((x) => x.trim());
    if (!cur) continue;
    n += 1;
    cur.items.push({ n, cite, url });
  }
  return { data, groups, total: n };
})();

const projects = (() => {
  const { data, body } = parseFrontMatter(read(path.join(CONTENT, "projects.md")));
  const groups = [];
  let cur = null;
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("##")) {
      cur = { name: t.replace(/^##\s*/, ""), items: [] };
      groups.push(cur);
      continue;
    }
    if (!cur) continue;
    const [name, source, period] = t.split("|").map((x) => (x || "").trim());
    cur.items.push({ name, source, period });
  }
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  return { data, groups, total };
})();

const people = listMd(path.join(CONTENT, "people")).map((f) => {
  const { data, body } = parseFrontMatter(read(path.join(CONTENT, "people", f)));
  return { ...data, html: md(body, 3), file: f };
});
people.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

const news = listMd(path.join(CONTENT, "news"))
  .map((f) => {
    const { data, body } = parseFrontMatter(read(path.join(CONTENT, "news", f)));
    return { ...data, html: md(body, 3), file: f };
  })
  .sort(
    (a, b) =>
      (Number(b.year) || 0) - (Number(a.year) || 0) ||
      (Number(a.order) || 99) - (Number(b.order) || 99)
  );

const STATS = [
  [publications.total, "篇", "代表性论文"],
  [projects.total, "项", "科研项目"],
  [research.items.length, "个", "研究方向"],
];

/* ----------------------------- 页面骨架 ----------------------------- */

const pageUrl = (f) => (f === "index.html" ? "" : f);

function layout({ file, title, description, body }) {
  const fullTitle =
    file === "index.html"
      ? `${S.name} · ${S.tagline}`
      : `${title} · ${S.name}`;
  const nav = NAV.map(([href, zh, en]) => {
    const active = href === file ? ' class="active" aria-current="page"' : "";
    return `<li><a href="${pageUrl(href)}"${active}><span>${zh}</span><em>${en}</em></a></li>`;
  }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description || S.tagline)}">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${escapeHtml(description || S.tagline)}">
<meta property="og:type" content="website">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<a class="skip-link" href="#main">跳到正文</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="./">
      <span class="brand-mark" aria-hidden="true">${S.name.slice(0, 1)}</span>
      <span class="brand-text">
        <strong>${escapeHtml(S.name)}</strong>
        <em>${escapeHtml(S.name_en || "")}</em>
      </span>
    </a>
    <nav aria-label="主导航"><ul class="nav">${nav}</ul></nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-name">${escapeHtml(S.name)}</p>
      <p class="footer-meta">${escapeHtml(S.university || "")} · ${escapeHtml(S.lab || "")}</p>
    </div>
    <div class="footer-meta">
      <p>${escapeHtml(S.address || "")}</p>
      <p><a href="mailto:${escapeHtml(S.email || "")}">${escapeHtml(S.email || "")}</a>${S.phone ? `　电话 ${escapeHtml(S.phone)}` : ""}</p>
    </div>
    <div class="footer-meta footer-right">
      <p>© ${new Date().getFullYear()} ${escapeHtml(S.name)}</p>
      <p>更新于 ${escapeHtml(S.updated || "")}</p>
    </div>
  </div>
</footer>
</body>
</html>`;
}

/* ----------------------------- 首页 ----------------------------- */

const firstSentence = (html) => {
  const t = html.replace(/<[^>]+>/g, "").trim();
  const m = t.match(/^[^。]{20,120}。/);
  return m ? m[0] : t.slice(0, 110) + "…";
};

const homeBody = `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">${escapeHtml(S.university || "")}　·　${escapeHtml(S.lab || "")}</p>
    <h1>${escapeHtml(S.name)}<span class="h1-en">${escapeHtml(S.name_en || "")}</span></h1>
    <p class="hero-tagline">${escapeHtml(S.tagline || "")}<span>${escapeHtml(S.tagline_en || "")}</span></p>
    <div class="hero-lead">${md(site.body)}</div>
    <p class="hero-actions">
      <a class="btn btn-primary" href="research.html">研究方向</a>
      <a class="btn" href="publications.html">代表性论文</a>
      <a class="btn btn-ghost" href="join.html">加入我们 →</a>
    </p>
  </div>
  <div class="hero-wave" aria-hidden="true">
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" role="presentation">
      <path d="M0,70 C60,70 60,40 120,40 C180,40 180,95 240,95 C300,95 300,55 360,55 C420,55 420,110 480,110 C540,110 540,30 600,30 C660,30 660,80 720,80 C780,80 780,45 840,45 C900,45 900,100 960,100 C1020,100 1020,60 1080,60 C1140,60 1140,70 1200,70" />
    </svg>
  </div>
</section>

<section class="wrap stats">
  ${STATS.map(
    ([v, unit, label]) =>
      `<div class="stat"><span class="stat-num">${v}</span><span class="stat-unit">${unit}</span><span class="stat-label">${label}</span></div>`
  ).join("")}
</section>

<section class="wrap section">
  <div class="section-head">
    <h2>研究方向<span>Research</span></h2>
    <a class="more" href="research.html">全部方向 →</a>
  </div>
  <div class="cards">
  ${research.items
    .map(
      (r, i) => `
    <article class="card">
      <p class="card-num">0${i + 1}</p>
      <h3>${escapeHtml(r.title)}</h3>
      <p class="card-en">${escapeHtml(r.titleEn)}</p>
      <p class="card-text">${firstSentence(r.html)}</p>
      <p class="chips">${r.keywords.slice(0, 3).map((k) => `<span>${escapeHtml(k)}</span>`).join("")}</p>
    </article>`
    )
    .join("")}
  </div>
</section>

<section class="wrap section">
  <div class="section-head">
    <h2>最新动态<span>News</span></h2>
    <a class="more" href="news.html">全部动态 →</a>
  </div>
  <ul class="news-list">
  ${news
    .slice(0, 4)
    .map(
      (n) => `
    <li>
      <span class="news-year">${escapeHtml(n.year || "")}</span>
      <div>
        <h3>${escapeHtml(n.title || "")}</h3>
        <p>${inline((n.html || "").replace(/<[^>]+>/g, "").slice(0, 90))}${(n.html || "").replace(/<[^>]+>/g, "").length > 90 ? "…" : ""}</p>
      </div>
    </li>`
    )
    .join("")}
  </ul>
</section>

<section class="wrap section">
  <div class="section-head">
    <h2>代表性论文<span>Selected Publications</span></h2>
    <a class="more" href="publications.html">完整列表 →</a>
  </div>
  <ol class="pub-list pub-list--compact">
  ${publications.groups[0].items
    .slice(0, 3)
    .map(
      (p) => `<li>
      <p class="pub-cite">${escapeHtml(p.cite)}</p>
      ${p.url ? `<a class="pub-doi" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">DOI ↗</a>` : ""}
    </li>`
    )
    .join("")}
  </ol>
</section>

<section class="cta-band">
  <div class="wrap">
    <h2>招收研究生与博士后</h2>
    <p>欢迎地球物理、地质、计算机与人工智能背景的同学加入，一起做深部地球的故事。</p>
    <p><a class="btn btn-primary" href="join.html">查看招生方向 →</a></p>
  </div>
</section>`;

/* ----------------------------- 研究方向页 ----------------------------- */

const researchBody = `
<section class="wrap page-head">
  <p class="eyebrow">Research</p>
  <h1>研究方向</h1>
  <p class="lead">${inline(research.intro)}</p>
</section>
<section class="wrap">
${research.items
  .map(
    (r, i) => `
  <article class="scope">
    <div class="scope-head">
      <span class="scope-num">0${i + 1}</span>
      <div>
        <h2>${escapeHtml(r.title)}</h2>
        <p class="scope-en">${escapeHtml(r.titleEn)}</p>
      </div>
    </div>
    <div class="scope-body">${r.html}
      <p class="chips">${r.keywords.map((k) => `<span>${escapeHtml(k)}</span>`).join("")}</p>
    </div>
  </article>`
  )
  .join("")}
</section>
<section class="wrap section">
  <div class="section-head"><h2>科研项目<span>Projects</span></h2></div>
  ${projects.groups
    .map(
      (g) => `
  <h3 class="sub-head">${escapeHtml(g.name)}<span>${g.items.length} 项</span></h3>
  <ul class="proj-list">
    ${g.items
      .map(
        (p) => `<li>
        <p class="proj-name">${escapeHtml(p.name)}</p>
        <p class="proj-meta">${escapeHtml(p.source)}<span>${escapeHtml(p.period)}</span></p>
      </li>`
      )
      .join("")}
  </ul>`
    )
    .join("")}
</section>`;

/* ----------------------------- 成员页 ----------------------------- */

const peopleBody = `
<section class="wrap page-head">
  <p class="eyebrow">People</p>
  <h1>课题组成员</h1>
  <p class="lead">课题组目前以负责人为核心组建中，研究生与博士后岗位持续开放。</p>
</section>
<section class="wrap">
${people
  .map(
    (p) => `
  <article class="person">
    <aside class="person-aside">
      <div class="avatar" aria-hidden="true">${escapeHtml((p.name || "").slice(0, 1))}</div>
      <p class="person-role">${escapeHtml(p.role || "")}</p>
      <p class="person-title">${escapeHtml(p.title || "")}</p>
      <p class="person-mail"><a href="mailto:${escapeHtml(p.email || "")}">${escapeHtml(p.email || "")}</a></p>
      ${p.tags ? `<p class="chips small">${p.tags.split("|").map((t) => `<span>${escapeHtml(t.trim())}</span>`).join("")}</p>` : ""}
    </aside>
    <div class="person-main">
      <h2>${escapeHtml(p.name || "")}<span>${escapeHtml(p.name_en || "")}</span></h2>
      ${p.html}
    </div>
  </article>`
  )
  .join("")}
  <article class="person person--open">
    <aside class="person-aside">
      <div class="avatar avatar--open" aria-hidden="true">+</div>
      <p class="person-role">开放岗位</p>
      <p class="person-title">硕士 / 博士 / 博士后</p>
    </aside>
    <div class="person-main">
      <h2>这里留给下一位成员<span>Open Positions</span></h2>
      <p>成员信息待补充。招收地球物理学、勘查技术与工程、地球信息科学与技术、地质学、
      海洋地质学、资源勘查工程、计算机与人工智能等相关专业的研究生。</p>
      <p><a class="btn" href="join.html">了解招生方向 →</a></p>
    </div>
  </article>
</section>`;

/* ----------------------------- 论文页 ----------------------------- */

const publicationsBody = `
<section class="wrap page-head">
  <p class="eyebrow">Publications</p>
  <h1>代表性论文</h1>
  <p class="lead">${escapeHtml(publications.data.note || "")}</p>
</section>
<section class="wrap">
${publications.groups
  .map(
    (g) => `
  <div class="pub-group">
    <h2 class="pub-year">${escapeHtml(g.year)}</h2>
    <ol class="pub-list" start="${g.items[0].n}">
      ${g.items
        .map(
          (p) => `<li value="${p.n}">
        <p class="pub-cite">${escapeHtml(p.cite)}</p>
        ${p.url ? `<a class="pub-doi" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">DOI ↗</a>` : ""}
      </li>`
        )
        .join("")}
    </ol>
  </div>`
  )
  .join("")}
</section>`;

/* ----------------------------- 新闻页 ----------------------------- */

const newsBody = `
<section class="wrap page-head">
  <p class="eyebrow">News</p>
  <h1>新闻动态</h1>
  <p class="lead">课题组的论文、获奖与活动记录。</p>
</section>
<section class="wrap">
  <ul class="news-list news-list--full">
  ${news
    .map(
      (n) => `
    <li>
      <span class="news-year">${escapeHtml(n.year || "")}</span>
      <div>
        <h2>${escapeHtml(n.title || "")}</h2>
        ${n.html}
        ${n.link ? `<p><a class="pub-doi" href="${escapeHtml(n.link)}" target="_blank" rel="noopener">原文 DOI ↗</a></p>` : ""}
      </div>
    </li>`
    )
    .join("")}
  </ul>
</section>`;

/* ----------------------------- 招生页 ----------------------------- */

const joinBody = `
<section class="wrap page-head">
  <p class="eyebrow">Join Us</p>
  <h1>加入我们</h1>
  <p class="lead">课题组长期招收硕士、博士研究生与博士后，也欢迎本科生提前进组参与科研训练。</p>
</section>
<section class="wrap join-grid">
  <div>
    <h2>招生方向</h2>
    <p>招收<strong>地球物理学、勘查技术与工程、地球信息科学与技术、地质学、海洋地质学、
    资源勘查工程、计算机与人工智能</strong>等相关专业的硕士和博士研究生。</p>
    <h2>你会做什么</h2>
    <ul>
      <li>处理流动台阵与连续波形数据，做接收函数、剪切波分裂等成像工作；</li>
      <li>用深度学习做震相拾取与反演加速，把大数据变成结构图像；</li>
      <li>参与海上与陆上野外观测，从数据采集一路做到论文投稿。</li>
    </ul>
    <h2>我们希望你</h2>
    <ul>
      <li>对地球内部如何运作有真实的好奇心，愿意长期投入一个问题；</li>
      <li>具备编程基础（Python 即可），或愿意在半年内学会；</li>
      <li>英文读写没有障碍，敢于写、敢于讲。</li>
    </ul>
    <h2>怎么联系</h2>
    <p>把成绩单、简历和一封说明研究兴趣的邮件发到
    <a href="mailto:${escapeHtml(S.email || "")}">${escapeHtml(S.email || "")}</a>，
    标题注明"研究生申请 + 姓名"。我们通常在一周内回复。</p>
  </div>
  <aside class="join-card">
    <h3>联系方式</h3>
    <dl>
      <dt>邮箱</dt><dd><a href="mailto:${escapeHtml(S.email || "")}">${escapeHtml(S.email || "")}</a></dd>
      ${S.phone ? `<dt>电话</dt><dd>${escapeHtml(S.phone)}</dd>` : ""}
      <dt>地址</dt><dd>${escapeHtml(S.address || "")}</dd>
      <dt>单位</dt><dd>${escapeHtml(S.university || "")}<br>${escapeHtml(S.lab || "")}</dd>
    </dl>
    ${S.lab_url ? `<p class="join-lab"><a href="${escapeHtml(S.lab_url)}" target="_blank" rel="noopener">实验室主页 ↗</a></p>` : ""}
  </aside>
</section>`;

/* ----------------------------- 输出 ----------------------------- */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });

const pages = [
  ["index.html", "", "", homeBody],
  ["research.html", "研究方向", research.intro, researchBody],
  ["people.html", "成员", "课题组成员", peopleBody],
  ["publications.html", "代表性论文", "代表性论文列表", publicationsBody],
  ["news.html", "新闻", "新闻动态", newsBody],
  ["join.html", "加入我们", "招收研究生与博士后", joinBody],
];

for (const [file, title, desc, body] of pages) {
  fs.writeFileSync(
    path.join(OUT, file),
    layout({ file, title, description: desc, body })
  );
}

// 404
fs.writeFileSync(
  path.join(OUT, "404.html"),
  layout({
    file: "404.html",
    title: "页面不存在",
    description: "页面不存在",
    body: `<section class="wrap page-head"><p class="eyebrow">404</p><h1>页面不存在</h1>
<p class="lead">链接可能已经调整，请从<a href="./">首页</a>重新进入。</p></section>`,
  })
);

// 静态资源
for (const f of fs.readdirSync(ASSETS)) {
  fs.cpSync(path.join(ASSETS, f), path.join(OUT, "assets", f), {
    recursive: true,
  });
}

// GitHub Pages 相关文件
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
const domain = (S.domain || "").trim();
if (domain && !/your-domain|example/i.test(domain)) {
  fs.writeFileSync(path.join(OUT, "CNAME"), domain + "\n");
  console.log(`   CNAME → ${domain}`);
}

fs.writeFileSync(
  path.join(OUT, "robots.txt"),
  "User-agent: *\nAllow: /\n" + (domain ? `Sitemap: https://${domain}/sitemap.xml\n` : "")
);

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${NAV.map(
  ([f]) =>
    `  <url><loc>https://${domain}/${pageUrl(f)}</loc><lastmod>${today}</lastmod></url>`
).join("\n")}
</urlset>
`
);

console.log(
  `✔ 生成完成：${pages.length + 1} 个页面 → docs/\n  论文 ${publications.total} 篇 · 项目 ${projects.total} 项 · 新闻 ${news.length} 条 · 成员 ${people.length} 人`
);
