# LicenseAtlas

A comprehensive license collection website — software, AI model, and data licenses.

## Tech Stack

- Next.js 16 (App Router, static export)
- Tailwind CSS v4
- TypeScript
- Data sourced from KB project

## Commands

- `npm run dev` — local dev server (http://localhost:3000/license.atlas)
- `npm run build` — static export to `out/`
- `npm run lint` — ESLint

## Deployment

- GitHub repo: `morningD/license.atlas`
- GitHub Pages: https://morningd.github.io/license.atlas
- `basePath: "/license.atlas"` configured in `next.config.ts`
- GitHub Actions auto-deploys on push to main (`.github/workflows/deploy.yml`)

## SEO

- `public/robots.txt` — 允许所有爬虫，指向 sitemap.xml
- `public/sitemap.xml` — 由 `scripts/build-sitemap.mjs` 从 `licenses-index.json` 生成（URL 数随语料增长，勿在此写死数字）
- **数据更新后必须重跑**：`node scripts/build-sitemap.mjs`
- `src/app/layout.tsx` — metadata 含中英 keywords、Open Graph、Twitter Card、JSON-LD 结构化数据
- `src/app/licenses/[slug]/page.tsx` — `generateMetadata` 为每个许可证生成独立 title/description
- Google Search Console 已验证（`public/googlef98d0f412dcfb895.html`），sitemap 已提交

## Data Pipeline

0. **全自动更新入口**（2026-08-24 起无人值守）：`npm run update:data` 默认走 GLM 自动审核
   （HF/GitHub custom temp 候选 → glm-4.6 判 include/discard，discarded.json 持久化），
   confirmed manifest 中的 slug 由 `sync-license-corpus.mjs` 自动信任，README 总数由
   `update-readme-counts.mjs` 自动刷。`--interactive` 回退旧人工审核流。人工出口仅剩：
   LLM 3 次未解决的 temp 候选、未审核来源的新 slug（sync 拦截需 `--allow-new-licenses`）。

1. KB `scripts/clean-licenses.mjs` reads crawled data → outputs `data/licenses/cleaned/`
   - `licenses.json` — full data with body text (for detail pages, build-time only)
   - `licenses-index.json` — lightweight without body (for homepage, ~0.6MB vs 11MB)
   - `stats.json` — aggregate statistics
2. `cp` cleaned JSON to `license-atlas/src/data/`
3. CC multilingual bodies: extracted to `public/data/cc-bodies/{slug}.json`, lazy-loaded by client

No data processing scripts in this project — KB is the single source of truth.

### KB 爬取来源（8 个）

| 来源 | 数据类型 | 说明 |
|------|----------|------|
| SPDX | 许可证正文 + 元数据 | 695+ 许可证 |
| OSI | OSI 批准标记 | 122 个 |
| TLDRLegal | P/C/L 徽章数据 | 145 个 |
| choosealicense.com | 描述 + P/C/L | 47 个 |
| HuggingFace Hub | 模型/数据集许可证 | 自定义 + gated |
| Open Data Commons | 数据许可证 | 3 个 |
| Creative Commons | CC 许可证正文 | 37 个 |
| **OpenMDW** | AI 模型许可证 | GitHub API 版本发现 + openmdw.ai 页面爬取 |

**OpenMDW 特殊处理**：KB `crawlers/licenses_crawl.js` 的 `crawlOpenMDW` 函数通过 GitHub API 监控 `OpenMDW/OpenMDW` repo 的版本目录，自动发现新版本并爬取许可证正文。P/C/L 元数据通过静态映射维护（`OPENMDW_METADATA` 对象）。FAQ 和 About 等参考资料保存在 `KB/data/licenses/openmdw/`。

## OSI License Review Tracker

集成 KB 的 OSI License Review Tracker，提供 `/tracker` 独立入口 + 详情页内嵌 review 块。

- 数据：`public/data/tracker.json`（全量，lazy-load）+ `src/data/tracker-index.json`（轻量映射，按需/dynamic 使用）+ `src/data/tracker-meta.json`（footer/about 用极轻量摘要）
- 同步：`npm run sync:tracker`（hash 增量检测，幂等）
- 全链路：`npm run update:tracker [--full]`（调 KB build/enrich/LLM + sync）
- `npm run build` 已内嵌 sync，每次构建自动检测同步
- KB 侧构建细节：`docs/OSI-TRACKER.md`（KB 仓库内，若缺失以 `KB/scripts/*.mjs` 头注释为准）；集成架构：`docs/tracker-architecture.md`

### 状态裁决（LLM）

多源状态矛盾由 glm-4.6 裁决。**默认走 OpenAI 兼容单次调用通道**（2026-08-28 起）：`ADJUDICATION_OPENAI_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4` + `response_format: json_object` + `thinking: disabled`，单条裁决 ~2-15s；旧的 Anthropic 兼容端点（`open.bigmodel.cn/api/anthropic`）structured output 每次都失败再 fallback，双倍耗时且易截断，仅作兜底（不设 `ADJUDICATION_OPENAI_BASE_URL` 时启用）。key 读自 opencode 全局配置 provider `zhipuai-coding-plan`。**A/B 结论（2026-08-28）**：glm-4.6 保留为裁决模型（不被 API 元数据带偏，判断准）；glm-5.3-flash 略快但判断质量欠一次样本验证，暂不采用。**增量裁决**：输入 hash 未变的条目直接沿用旧输出，每轮只裁决有新证据的条目。Prompt v2 定义了 "approve in the legacy category" → legacy 规则。

**编排器自动化**（2026-08-23，`update-tracker.mjs`）：灰色地带 manual review 按 `scripts/tracker-manual-baseline.json` 基线放行，**基线外新项硬失败**留人工（确认后 `--rebaseline` 采纳，成功运行自动 prune 已解决 id）；invalid/missing 裁决自动 LLM 重跑最多 3 轮（key 缺失自动读 opencode 配置）；KB run 脚本对 "conflicts 未置 requires_manual_review" 的输出直接矫正。`--strict-manual-pending` 恢复任何 blocking 即失败的旧模式。

### 自动更新（事件触发，2026-08）

launchd `com.momo.license-atlas.tracker` 每 3 小时 HEAD 探测 OSI 当月归档页：无变化秒退（零 LLM）；有变化则 `opencode run` 非交互跑全链路（质量门全绿才 push，失败回滚）。

- runner 在 `~/.local/share/license-atlas-tracker/`（绕开 macOS 26 对 launchd bash 的 Documents TCC 门控）；仓库 `scripts/auto-update-tracker.sh` + `scripts/check-tracker-updates.mjs` 是 source of truth
- 非交互 opencode 权限预授权：runner 目录下 `opencode.json`（bash/edit/webfetch/external_directory 全 allow）
- 日志：`~/.local/share/license-atlas-tracker/logs/auto-update-YYYYMMDD.log`
- LLM 模型固定 glm-4.6（实测最稳；4.6v/5.3/4.5-air 各有纪律问题，详见 tracker-architecture.md）

### 更新 tracker Checklist

修改 KB OSI 数据后：
1. `npm run sync:tracker`（或直接 `npm run build`，会自动同步）
2. 若要重跑 KB 全链路：`npm run update:tracker`（增量 LLM）/ `--full`（全量）
3. 详情页 review 块自动从 `tracker-index.json` 读取；footer/about 从 `tracker-meta.json` 读取更新时间和汇总数，无需额外操作

## i18n

Lightweight client-side i18n via `src/lib/i18n.tsx`:
- `LangProvider` context wraps the app (in `layout.tsx`)
- `useLang()` hook returns `{ lang, setLang, t }`
- `t(key, params)` for string interpolation with `{param}` placeholders
- Auto-detects language: `localStorage("lang")` → `navigator.language.startsWith("zh")` → fallback "en"
- Language toggle in navbar shows "中"/"EN"
- 已翻译范围：navbar/footer 品牌、type/tag/FSF-tag pills、P/C/L 徽章、Blue Oak 评级、语言标签、正文区（Full Text/Copy/Copied/Language）、About 页面、搜索分组、Tracker 搜索卡、Tracker timeline / participants / board vote / License Texts 可见控件
- 新增 Tracker UI 文案必须走 `src/lib/i18n.tsx` en/zh key；邮件 point 和许可证正文是数据内容，不进 UI 字典

Server components (`licenses/[slug]/page.tsx`) are split into:
- `page.tsx` (server) — data fetching + `generateStaticParams`
- `license-detail-client.tsx` (client) — rendering with `useLang`

## Performance

- 首页首屏避免静态导入 `tracker-index.json`：Review Tracked 标签通过 mount 后动态加载 `tracker-match`，搜索旁路在实际查询时动态 import tracker index。
- `/tracker` 页面先动态导入轻量 `tracker-index.json` 渲染列表，再后台预热 `public/data/tracker.json`；展开卡片或 `?focus=` 时再强制确保全量详情可用。`ensureFullData` 用 ref 防重入，不能依赖 `indexEntries`，否则 index setState 后会重复触发首屏加载 effect。
- footer/about 只导入 `tracker-meta.json`，不要为了更新时间或汇总数把整个 tracker index 放进全站 bundle。

- Homepage imports `licenses-index.json` (0.6MB) instead of full `licenses.json` (11MB)
- Detail pages are SSG — 11MB JSON only used at build time, users get pre-rendered HTML
- CC multilingual bodies (~500KB) lazy-loaded from `public/data/cc-bodies/` on demand
- Card hover triggers `<link rel="prefetch">` for faster navigation
- Nav progress bar (`nav-progress.tsx`) for page transition feedback

## Design

- Fonts: Geist Sans / Geist Mono (no Inter)
- Primary accent: Violet `#7c3aed`
- OSI brand: `#3DA639`, FSF brand: `#B11107`
- Type badge colors: Software=violet, Model=sky, Data=orange, Agent=purple, Terms=teal
- tl;drLegal Verified badge: gradient `linear-gradient(102deg, #289e6d, #0096e2)`
- Frosted glass card design with hover effect
- Detail page: staggered fade-in entrance animation (`fadeIn` keyframes, 50ms intervals)
- Dark mode via class toggle (localStorage + system preference)
- Visitor counter: busuanzi (dynamically loaded)
- Filter state persisted to URL via `history.replaceState` (no `router.replace` — causes infinite refresh in static export)
- Badge tooltips use opaque Tailwind colors (e.g. `bg-green-50` for OSI, `bg-red-50` for FSF)
- Detail page header has `z-20` so badge tooltips render above Permissions section
- Blue Oak rating section has `relative z-10` so tooltip renders above License Text section
- Homepage tag pills use `border border-transparent` when active (same border width as inactive) to prevent flex-wrap reflow

## Key Components

- `src/lib/i18n.tsx` — LangProvider, useLang hook, en/zh translation dictionary
- `src/components/badge.tsx` — Badge with variants: osi, fsf, type, tag, permission, condition, limitation, verified, language, fsf-tag, blue-oak. `themeKey` prop separates style lookup from display text
- `src/components/license-card.tsx` — Frosted glass card with hover prefetch + sparkline
- `src/components/navbar.tsx` — Nav with language toggle + dark mode toggle + GitHub link
- `src/components/footer.tsx` — Footer with busuanzi counter (dynamic script injection)；"Latest Data Update" 只显示许可证语料时间，且在 `/tracker` 路由隐藏（该页有自己的数据时间）
- `src/components/nav-progress.tsx` — Top progress bar for page transitions
- `src/components/license-body-section.tsx` — License text renderer with lazy-loaded CC family nav
- `src/components/cc-family-nav.tsx` — Language switcher for CC multilingual bodies
- `src/app/page.tsx` — Homepage with search, filters, license grid (uses licenses-index.json)
- `src/app/about/page.tsx` — About page with sources, stats, links
- `src/app/licenses/[slug]/page.tsx` — Server wrapper (SSG, uses full licenses.json)
- `src/app/licenses/[slug]/license-detail-client.tsx` — Client detail view with i18n
- `.github/ISSUE_TEMPLATE/license-feedback.yml` — GitHub issue 模板（Report Issue 按钮链接到此模板）

## 添加许可证 Checklist

`npm run update:data` 全自动链路会完成第 1-6 步（含 `update-readme-counts.mjs` 自动刷 README 总数）；手工修改 `licenses.json` 时，**必须同步更新以下文件并全部提交**：

1. `src/data/licenses.json` — 完整数据（含 body），详情页用
2. `src/data/licenses-index.json` — 轻量版（无 body），**主页直接 import**，tag pills 从此文件读取
3. `src/data/stats.json` — 重新计算 by_type、by_tag、by_source 等统计
4. `public/search-index.json` — 运行 `node scripts/build-search-index.mjs` 重建
5. `public/sitemap.xml` — 运行 `node scripts/build-sitemap.mjs` 重建
6. `README.md` / `README.zh-CN.md` — 运行 `node scripts/update-readme-counts.mjs` 刷总数；数据源表仅在新增来源时手改
7. `src/app/about/page.tsx` — 如有新数据源，添加到 sources 列表 + i18n
8. `src/lib/i18n.tsx` — 如有新 tag/描述，添加翻译

**最容易遗漏的是 `licenses-index.json`**：主页 filter pills 的 tags 来自这个文件，而非 `licenses.json`。如果只改后者，线上 pills 不会更新。

## Tag 系统

- Tag 定义：`src/components/badge.tsx` 的 `themes` 对象（颜色、desc、tooltip 样式）
- Tag 排序：`src/app/page.tsx` 的 `tagOrder` 数组
- Tag 翻译：`src/lib/i18n.tsx` 的 `tag.*`（标签名）和 `tagdesc.*`（悬浮描述）
- Badge 组件优先查 i18n key `tagdesc.{key}`（key 为 resolveKey 结果），回退到 themes 里的英文 desc
- 新增 tag 需同时更新：themes（badge.tsx）、tagOrder（page.tsx）、i18n 翻译（zh/en）
- 不随意新增 tag，只有数量足够多（建议 ≥3）才有筛选意义
- `languages` 字段是独立的语言筛选，与 tags 无关

## 暗色模式

- Tailwind v4 class-based dark mode：`@custom-variant dark (&:where(.dark, .dark *))`
- `ThemeToggle` 组件需要在 hydration 后用 `useEffect` 重新应用 `dark` class（否则 React hydration 会覆盖 `<html>` 上的 class）
- 持久化：`localStorage("theme")` + `matchMedia("(prefers-color-scheme: dark)")`

## 常见陷阱

- **静态导出 + CDN 缓存**：GitHub Pages 有 `max-age=600`（10分钟），部署后需等待缓存过期或强制刷新
- **Safari favicon 缓存**：独立于浏览器缓存，存储在 `~/Library/Safari/Favicon Cache/*`，需要完全磁盘访问权限才能清除
- **ICO 格式**：必须是 proper multi-size ICO，不能是重命名的 PNG
- **Badge 翻译 vs 样式分离**：Badge 的 `themeKey` prop 用于查找样式和 tooltip，`children` 用于显示文本。翻译后的中文文本（如 "软件"）在 themes 里没有对应样式，必须传原始英文值（如 "software"）作为 `themeKey`。Blue Oak badge 传 `themeKey={license.blueoak_tier}`（如 "Silver"），children 传翻译文本（如 "银级"）
- **i18n key normalize**：tag 名转 i18n key 时需去掉特殊字符（分号等），用 `tag.toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9-]/g, "")`。themes 字典的 key 也必须与 normalize 结果一致（如 `"tldrlegal-verified"` 无分号）
- **Badge tooltip i18n 查找**：使用 `tagdesc.${key}`（key 为 resolveKey 结果），不再用 normalizeKey(themeKey)。Blue Oak 的 tooltip key 为 `tagdesc.bo-silver` 等
- **Hydration mismatch**：客户端语言检测会导致 SSR 内容（英文）与客户端渲染（中文）不匹配。品牌名用 `mounted` state 守卫，其余 `t()` 文本接受 mismatch（不影响功能）

## Blue Oak 评级

Blue Oak Council 对 225+ SPDX 宽松许可证提供质量评级（Model/Gold/Silver/Bronze/Lead）。

### 数据来源

- KB `clean-licenses.mjs` 在构建时自动获取 `https://blueoakcouncil.org/list.json`（~20KB）
- 按 `spdx_id` 匹配，匹配到的许可证添加 `blueoak_tier` 字段
- 合规：Blue Oak ToS 明确允许自动化获取 JSON 数据文件

### 数据模型

- `blueoak_tier?: string` — 可选字段，值为 "Model" / "Gold" / "Silver" / "Bronze" / "Lead"
- 仅 ~225 个 SPDX 许可证有此字段，其余许可证无此字段（不显示评级区域）

### 详情页展示

- 评级区域在 P/C/L 之后、License Text 之前，父容器有 `relative z-10` 确保 tooltip 不被遮挡
- Badge 用 `variant="blue-oak" themeKey={tier}`，`resolveKey` 映射到 `bo-{tier}` 的 theme key
- 每个等级有独立的金属质感配色：Model=紫、Gold=金、Silver=银、Bronze=铜、Lead=铅灰
- Badge 文本通过 `bo.{tier}` i18n key 翻译（Model→模板, Gold→金级, Silver→银级 等）
- Pill 后描述文字通过 `detail.blueOak.{tier}` i18n key 翻译（简练概括版）
- Pill 悬浮窗通过 `tagdesc.bo-{tier}` i18n key 翻译（Blue Oak Council 官方完整描述）

## 中文品牌名

- 英文：`LicenseAtlas`，中文：`许可图鉴`（衬线体 `font-serif`）
- 切换逻辑在 `navbar.tsx`、`footer.tsx`、`page.tsx` 中，通过 `useLang()` 的 `lang` 判断
- 使用 `mounted` state 守卫避免 hydration mismatch（SSR 默认渲染英文）
- About 页标题："关于许可图鉴（LicenseAtlas）"（中英文对照）

## Terms 设计

Terms 是一种特殊的条目类型，用于记录被许可证正文引用的服务条款（Acceptable Use Policy、Terms of Use 等），本身不是独立的许可证。当前共 16 个 Terms 条目，覆盖 Anthropic、Meta/Llama、NVIDIA、xAI、Databricks、Stability AI、EvolutionaryScale、OpenAI、Moonshine AI 等组织。

### 数据模型

- `type: "agent"` — 不新增 type，复用现有类型
- `tags: ["Terms", "Custom", "Proprietary"]` — 通过 "Terms" tag 标识
- `terms?: { name: string; url: string; slug?: string }[]` — 许可证条目上的可选字段，引用相关 Terms 文档
  - `slug` 存在时渲染为站内 `<Link>` 跳转（如 `/licenses/anthropic-consumer-terms`）
  - `slug` 不存在时渲染为外部 `<a>` 链接（带 ↗ 箭头）
- 命名规则：`{Organization} {Type} Terms of Service` 或 `{Organization} {Product} Acceptable Use Policy`

### 详情页展示规则

Terms 条目的详情页与普通许可证不同：

- **Badges 区块**：Terms 条目只显示一个 pill —— "Terms"（teal 色系）。不显示 type badge、OSI/FSF、语言、其他 tag pills。这是显式展示 Terms pill，不是隐藏其他 pill
- **正文标题**：统一用 "Full Text"（非 "License Text"），因为 Terms 不是 license
- **Permissions/Conditions/Limitations**：正常渲染（Terms 条目通常为空数组）
- **Related Terms 区块**：仅在含 `terms` 字段的许可证条目上显示，在 Sources 区块之后，支持站内跳转

### 爬取与清洗

推荐使用 Jina Reader API（`https://r.jina.ai/{url}`）爬取，或 webReader MCP 工具。爬取后必须清洗：

1. 去掉 Jina meta headers（`Title:`、`URL Source:`、`Markdown Content:`）
2. 去掉导航菜单（识别标题/正文起始点，截断之前的菜单内容）
3. 去掉页面 footer（Cookie 政策、公司信息等）
4. 去 markdown 格式（`**`、`__`、`##`、`[](url)`、`![](url)`、`*   ` 列表标记）
5. 清理多余空白行和行尾空格

### 添加 Terms 条目 Checklist

1. 爬取 Terms 页面正文，按上述规则清洗为纯文本
2. 添加到 `licenses.json`：`tags: ["Terms", "Custom", "Proprietary"]`，`proprietary: true`
3. 在引用 Terms 的许可证条目上添加 `terms` 字段（含 `name`、`url`、`slug`）
4. 同步 `licenses-index.json`、`stats.json`、`search-index.json`、README 总数
5. 如爬取失败（404、超时），跳过不创建条目，该许可证的 `terms` 字段也不添加
5. 如有新 tag 需更新：badge.tsx themes、page.tsx tagOrder、i18n.tsx 翻译
