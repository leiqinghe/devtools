# 站点 SEO 与搜索引擎收录手册(SOP)

> 来源:2026-11 `tools.leiqinghe.cloud` 与 `www.leiqinghe.cloud` 实战全流程。
> 本项目任何新站点上线时,按本手册从上到下执行即可,不需要重新踩坑。
> 可复用脚本与资产清单见 §3,故障排查见 §4。

---

## 0. 核心认知(本项目踩过的坑,先读这个)

1. **百度蜘蛛基本不执行 JS**。纯客户端渲染的 React/Vite SPA,在百度眼里就是一个空壳 `<div id="root">`。必须做**构建期预渲染(SSG)**。Google 能渲染 JS,但预渲染对所有引擎都快。
2. **"静态 HTML 入口" ≠ SSR**。`index.html` 只有 `<div id="root">` 就是空壳。验证方法:`curl -s https://站点/某路由 | grep title`——看到的是"每个页面都一样的通用标题"就是没做预渲染。
3. **裸 IP / 非标端口 / HTTP 是信任度硬伤**。域名 + ICP 备案 + HTTPS 是一切 SEO 的前置条件。
4. **HTTPS 证书按 `-d` 列表签发,SAN 不会自动包含 www**。Let's Encrypt 证书漏了 `www.` 子域,整个 www 域名都打不开(curl exit 60)。新证书必须显式 `-d xxx.leiqinghe.cloud -d www.leiqinghe.cloud`。
5. **nginx `try_files` 三个坑**:
   - 预渲染文件用 `$uri.html` 匹配(`/json-format` → `/json-format.html`,无尾斜杠 301 问题);
   - 目录兜底必须 `$uri/`(否则首页 `/` 匹配不到目录,直接 404);
   - 未知路径要 `=404` 而不是兜底到 index.html(软 404 拉低全站质量分),配 `error_page 403 =404 /404.html` 把无 index 目录也归一成 404。
6. **`scp -r` 是合并、不删除**。服务器上残留的旧文件(如游戏迁走后的 `src/games/`)会让容器内构建失败(本地没有这些文件所以本地构建正常)。更新代码先 `rm -rf` 远端对应目录再传。
7. **百度普通收录 API**:token 是账号级(各站点 token 相同),靠 `site=` 参数区分站点;配额**账号共享,约 10 条/天**;整批 URL 超配额会**整单拒绝**(over quota,一条不进),所以必须分批(`--only` 参数)。
8. **百度的「自动推送 JS」已于 2023 年官方下线**,别再集成;API 主动推送 + sitemap 是正规通道。
9. **验证文件放两处**:线上根目录(立即生效)+ 项目 `public/`(以后重建镜像/重新部署不丢)。
10. **收录节奏预期**:新站百度 1~4 周开始收录,排名 2~3 个月起量;工具站是长尾模式,33 页 × 33 个精准词,靠量取胜。

---

## 1. 新站点 SEO 接入 SOP(按顺序执行)

### Phase A · 上线前置(域名 / 证书 / 托管)

- [ ] 规划独立子域名(如 `xxx.leiqinghe.cloud`),DNS 解析到服务器 `101.201.56.200`
- [ ] 宿主机 nginx vhost:
  - 80 端口:`location /.well-known/acme-challenge/ { root /var/www/html; }` + 其余 301 到 https(ACME 验证路径必须在 301 之前直出)
  - 443 端口:`proxy_pass http://127.0.0.1:端口`(容器站)或静态 `root`(纯静态站)
- [ ] 证书签发(webroot 方式,与现有工具一致):
  ```bash
  certbot certonly --expand --webroot -w /var/www/html -d xxx.leiqinghe.cloud --non-interactive
  nginx -t && systemctl reload nginx
  ```
- [ ] 验证:`curl -sI https://xxx.leiqinghe.cloud/` 返回 200 且证书有效

### Phase B · 站内 SEO(构建期一次配好,以后全自动)

- [ ] **预渲染**:参照 `devtools/scripts/build-seo.mjs` 移植(要点见 §3)。为每个路由生成 `dist/<route>.html`,内含专属 title/description/canonical/OG/JSON-LD + 可索引静态正文(React 挂载后替换 `#root` 内容,用户无感知)
- [ ] **TDK 关键词公式**(见 §2)写进页面数据结构,构建期自动生成,严禁"上线后再补 SEO"
- [ ] **robots.txt**(放 `public/`):`Allow: /`,屏蔽 `/api/` 等私有路径,末行 `Sitemap: https://xxx.leiqinghe.cloud/sitemap.xml`
- [ ] **sitemap.xml** 构建期生成,含全部路由,lastmod 用构建日
- [ ] **真实 404**:容器 nginx `try_files $uri $uri.html $uri/ =404` + `error_page 404 /404.html` + `error_page 403 =404 /404.html` + 品牌 404 页(noindex,带首页和热门页链接)
- [ ] **JSON-LD**:首页 `WebSite`,内容页 `SoftwareApplication`(或 `Article`)+ `BreadcrumbList`,构建期注入 + 运行时路由切换兜底

### Phase C · 站长平台与推送(上线当天完成)

- [ ] **百度资源平台** [ziyuan.baidu.com](https://ziyuan.baidu.com):
  1. 添加站点 → 文件验证 → 下载验证文件 → 放项目 `public/` + 传线上根目录 → 验证通过
  2. 提交 sitemap:`https://xxx.leiqinghe.cloud/sitemap.xml`
  3. 「普通收录」复制推送地址的 token → 追加到 `devtools/.env.baidu`:
     ```
     BAIDU_PUSH_TOKEN=xxxxxxxx
     BaiduSite_xxx=xxx.leiqinghe.cloud   # 如需区分多站点再扩展脚本
     ```
  4. 推送:`npm run submit:engines -- baidu`(URL 多时用 `--only` 分批,配额见 §0-7)
- [ ] **IndexNow(Bing/Yandex/Seznam/Naver)**:复用 `devtools/public/indexnow-key.txt`(账号级密钥,已在线),部署后 `npm run submit:engines -- indexnow`
- [ ] **Google Search Console** [search.google.com/search-console](https://search.google.com/search-console):验证 + 提交 sitemap(Google 对 CSR 兼容,预渲染后更快)
- [ ] 配额不足时:剩余 URL 按天分批(`--only`),可用定时任务自动跑(现有案例:「百度收录推送·每日一批直至推完」)

### Phase D · 内容与排名(长期运营)

- 每页除交互组件外必须有**可索引文字**:使用说明 + FAQ(3~5 条问答)+ 同类页面互链(内链网)
- **外链**:GitHub/Gitee 仓库 README 挂站、掘金/CSDN/知乎教程文章、提交程序员导航站/工具站导航
- 装百度统计,观察抓取频次与关键词
- 用 `site:xxx.leiqinghe.cloud` 随时查收录情况

---

## 2. 关键词与 TDK 规划方法论

### 原则:一个页面 = 一个主关键词

新建任何页面前先回答"用户会搜什么词到达这页",把这个词写进数据结构,构建期自动生成 TDK。**先想搜索词,再写代码。**

### TDK 公式(已在 devtools 验证)

| 位置 | 公式 | 示例 |
|---|---|---|
| 功能页 title | `{功能名}在线工具 - 免费使用 - {站点名}` | `JSON 格式化在线工具 - 免费使用 - DevTools`(≤30 字,关键词前置) |
| 功能页 description | `{功能名},{一句话功能}。在线免费使用,无需注册登录,数据本地处理不上传服务器。` | 突出"免费/在线/隐私"决策词 |
| 首页 title | `{站点名} 在线工具箱 - N个免费{领域}工具` | 数字增强点击率 |
| 首页 description | 列举 3~5 个最高频功能词 + 免费即用卖点 | 覆盖多个头部词 |

### 关键词分层

- **头部词**(首页承担):在线工具、免费工具箱、开发者工具
- **功能词**(每个功能页承担,主战场):时间戳转换、JSON 格式化、二维码生成、图片压缩……
- **长尾词**(内容页/FAQ 承接):"时间戳是什么怎么转换""JSON 报错怎么排查"
- 分类互链(同类工具列表)强化主题聚类,帮助搜索引擎理解站点结构

### 落地机制

页面元数据必须**单行结构化**(如 devtools 的 `{ path, Icon, title, desc }`),预渲染脚本、sitemap、推送脚本、AI 推荐清单全部从这一份数据派生——新增页面零额外 SEO 操作。

---

## 3. 可复用资产清单

| 资产 | 位置 | 用途 |
|---|---|---|
| 预渲染脚本 | `devtools/scripts/build-seo.mjs` | 构建期生成静态页(标题/正文/JSON-LD)+ sitemap + 404 页 + 旧路径迁移页。移植到新站时改:目录解析正则、TDK 公式、静态正文模板 |
| 推送脚本 | `devtools/scripts/submit-engines.mjs` | 百度普通收录 API + IndexNow;`--only p1,p2` 分批推送 |
| 百度 token | `devtools/.env.baidu`(chmod 600,已 gitignore) | `BAIDU_PUSH_TOKEN`,所有站点共用 |
| IndexNow 密钥 | `devtools/public/indexnow-key.txt` | 账号级,新站 public/ 复制同一份即可 |
| 百度验证文件 | 各站 `public/baidu_verify_*.html` | 每个站点单独验证时百度会发新文件,放两处(见 §0-9) |
| 定时任务 | 「百度收录推送·每日一批直至推完」 | 状态机式分批推送,进度在 `devtools/.baidu-push-state/`,推完自动暂停 |
| 服务器拓扑 | 101.201.56.200 | tools→容器 8100;play→容器 8200;www/裸域→宿主机静态 `/var/www/portfolio-site`;宿主 nginx 80 端口 ACME webroot `/var/www/html` |

### 新站移植 build-seo.mjs 的改点清单

1. 页面目录来源:替换对 `src/data/tools.tsx` 的正则解析为新站自己的路由/数据源
2. TDK 公式:§2 的模板按站点领域微调
3. 静态正文模板:h1/面包屑/互链结构按站点信息架构调整
4. JSON-LD 类型:工具类 `SoftwareApplication`,博客 `Article`,落地页 `WebPage`
5. `package.json` 的 `build` 接上:`vite build && node scripts/build-seo.mjs`

---

## 4. 故障排查速查表

| 症状 | 原因 | 处理 |
|---|---|---|
| curl 证书错误(exit 60) | 证书 SAN 缺该域名(常见:漏 www) | `certbot certonly --expand -d 域名 -d www.域名 --webroot -w /var/www/html` + reload |
| 首页或某路由 404/403 | `try_files` 缺 `$uri/` 或 `$uri.html` | 对照 §1-PhaseB nginx 三件套 |
| 所有页面同标题、正文为空 | 未预渲染(纯 CSR) | 移植 build-seo.mjs,`curl` 验证静态正文 |
| 容器构建 TS 报错但本地正常 | scp 残留旧文件被一起编译 | `rm -rf` 远端对应目录后全量重传 |
| 百度推送 `over quota` | 账号共享配额约 10 条/天,整批被拒 | `--only` 分批,次日续推(定时任务自动处理) |
| 百度推送 `not_same_site` | URL 不属于 `site=` 指定的站点 | 每个子域在资源平台单独验证,各拿各的推送地址 |
| 百度迟迟不收录 | JS 不可见 / 无外链 / 新站沙盒期 | `curl` 验证静态正文 → 提交 sitemap + 推送 → 加外链 → 耐心等 1~4 周 |
| 软 404(任意路径都 200) | nginx 全兜底到 index.html | 改 `=404` + `error_page`,补 404.html |

---

## 5. 上线后 30 天节奏

- **Day 0**:部署 → Phase A~C 全部走完 → 首轮推送(首页 + 最高价值页面优先)
- **Day 1~3**:定时任务分批推完剩余 URL
- **每周**:资源平台看「索引量 / 抓取频次」曲线;`site:域名` 查收录数
- **持续**:每月新增功能页/FAQ 内容页,积累外链;关键词数据回流后迭代 title

---

# 第二部分:GEO(生成式引擎优化)

> 目标:用户问 AI(豆包 / Kimi / 元宝 / DeepSeek / ChatGPT / Perplexity)时,
> AI 在回答里提到、推荐、引用 **DevTools / PlayHub 等作品**。
> 实战落地于 2026-11,三站已全部完成 L1 + L4(见下)。
>
> **⚠️ 曝光策略(2026-11 修正):推作品,不推人。**
> 公开页面统一使用开发者品牌 ID **leiqinghe**,不写真实姓名;不出现"可承接 / 定制开发 / 外包 / 合作"等
> 招揽表述。目标是"搜个人开发者时推荐到你的站",用户被作品打动后自行找联系方式即可。

## 6. 机制:AI 只有两条路径认识你

| 路径 | 机制 | 可控性 |
|---|---|---|
| **参数记忆** | 模型训练时读过全网语料,知名度烧进权重 | 低。需要第三方长期广泛讨论,周期以年计 |
| **联网检索(RAG)** | 收到问题后现场搜索网页,总结搜索结果 | **高**。搜到什么 = 传统 SEO + 平台内容存在感 |

**关键结论:目前主流 AI 助手默认联网搜索。用户问"推荐免费在线工具网站"时,答案基本是从搜索结果现拼的——
谁的页面/内容在检索结果里、谁被引用的概率就大。所以不需要先进模型权重,在检索层可见就够。**

## 7. AI 的引用偏好(内容怎么写才被摘)

1. **清单 / 问答结构**:"有哪些免费在线工具网站?——这 8 个亲测好用"远高于产品官网自述
2. **高权重中文平台**:知乎、掘金、CSDN、酷安被国产大模型大量抓取,**第三方讲你 > 你自己说**
3. **实体一致性**:同一 ID 在 GitHub / 知乎 / 官网 / App 署名反复一致出现,AI 才能把"人—作品"关联成实体
4. **可直接摘录的句子**:页面里要有"XX 是独立开发者雷庆贺开发的……"这种能被原句摘走的陈述

## 8. 四层打法(已落地状态)

### L1 实体层 ✅ 已完成

- `www.leiqinghe.cloud` 新增 **「关于」区块**(作品合集定位:身份/在做的事/技术栈/作品清单)
- 首页注入 **Person JSON-LD**(name=leiqinghe,`owns` 三个作品)+ WebSite JSON-LD
- `#root` 内置**静态可读正文**(不执行 JS 的爬虫也能读到作品描述与链接)
- 三个站 footer 统一实体句:`由 leiqinghe 独立开发`
- 联系方式:仅主站「关于」区最底部一行小字,不主动招揽
- 待补:GitHub Profile README 用同一套文案;知乎/掘金个人简介统一用 leiqinghe

### L2 内容层(主力,每周 1 篇)· 大纲见 `GEO-CONTENT-PLAN.md`

按用户真实提问场景写,发布在高权重平台,官网只做落点:

| 用户会问 AI 的 | 该发的内容 | 平台 |
|---|---|---|
| 推荐免费在线工具网站 | 《我独立开发了一个 33 工具的在线工具站》+ 回答"有哪些好用的在线工具网站" | 知乎 + 掘金 |
| 个人开发者能做出什么 | 《从零上线:React + Docker + 安卓 App 自动更新的完整过程》 | 掘金 / CSDN |
| 有什么手游/小游戏推荐 | 《我用摄像头手势做了个网页游戏》 | 酷安 + 知乎 |
| 谁能做定制网站/App | 作品集式回答 + 主站链接 | 知乎 |

### L3 生态层(持续)

工具导航站收录、GitHub awesome 列表 PR、酷安/应用商店发布页(商店页面会被 AI 引用)、技术社区签名统一。

### L4 技术层 ✅ 已完成

- 三站 `robots.txt` 显式放行 AI 爬虫:GPTBot / OAI-SearchBot / ChatGPT-User / ClaudeBot / PerplexityBot / Bytespider / Google-Extended / Applebot-Extended
- 三站新增 **`/llms.txt`**(新兴约定,给 AI 的站点摘要):
  | 站点 | 内容 |
  |---|---|
  | `www.leiqinghe.cloud/llms.txt` | 开发者 ID、作品清单、"适合被提及的提问场景" |
  | `tools.leiqinghe.cloud/llms.txt` | **构建期自动生成**,含全部 33 个工具的分类清单 + 触发词映射 |
  | `play.leiqinghe.cloud/llms.txt` | 手势游戏平台说明 + 游戏清单 + 触发词 |
- 三站 sitemap.xml(主站/playhub 新增,devtools 原有)

## 9. 怎么衡量 GEO 效果

建**固定问题清单**,每月在豆包 / Kimi / 元宝 / DeepSeek / ChatGPT / Perplexity 各问一遍,
记录:**是否提到 DevTools / PlayHub 作品** / 是否给出站点链接 / 引用了哪个来源。
答案变化可直接反推哪篇内容起效。

推荐监控问题(全部围绕"作品",不围绕"人"):

1. 有哪些免费的在线工具网站? 2. 好用的 JSON 格式化在线工具 3. 在线时间戳转换工具推荐
4. 有什么不用下载的网页小游戏 5. 摄像头手势控制的网页游戏推荐
6. 独立开发者做过哪些产品/作品 7. 有没有个人开发者做的工具站推荐 8. 免费在线工具箱哪个好用

## 10. 预期与红线

- **检索路径 2~4 周可见效**(内容被收录后);参数记忆路径需长期第三方声量,急不来
- **无法保证**任何 AI 一定推荐你,以上是提高概率
- **红线**:不批量灌水同质内容(平台会惩罚反伤);不伪造第三方评价;靠真实作品 + 真实内容积累
- **不做招揽**:公开页面不写"接单 / 定制开发 / 外包 / 欢迎咨询"——会削弱工具站的专业可信度,
  且与"作品被推荐"的目标相反。联系方式只留极低权重的一行入口

## 11. 新站 GEO 接入清单(与第一部分 Phase B 并列执行)

- [ ] 页面里有一段**可直接摘录的作品声明句**(谁做的 + 是什么产品 + 有什么特点)
- [ ] `Person`(name 用品牌 ID)/ `Organization` / `WebApplication` JSON-LD,`sameAs` 指向公开账号
- [ ] `/llms.txt`(可由构建脚本按页面数据自动生成,参照 devtools)
- [ ] `robots.txt` 放行 AI 爬虫 UA
- [ ] footer 统一实体句 + 官网互链(主站/工具站/游戏站三向链接,形成实体簇)
- [ ] 静态可读正文放进 `#root`(React 挂载后接管,爬虫读到的是静态内容)
- [ ] 全站不出现真实姓名、不放接单话术;联系方式仅低权重入口
