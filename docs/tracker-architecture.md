# OSI License Review Tracker — 集成架构

## 概述

license-atlas 集成 KB 的 OSI License Review Tracker，提供两种入口：

1. **独立入口** `/tracker` — React/Tailwind 完整复刻 KB tracker 全部功能。
2. **详情页内嵌** `LicenseReviewBlock` — 命中 OSI review 的许可证显示摘要 + 压缩 strip，点击跳 `/tracker?focus=<spdx>`。
3. **首页搜索旁路结果** — `src/lib/search.ts` 在用户搜索时动态加载轻量 `tracker-index.json`，把 pending / rejected / withdrawn / superseded 等未正式收录进 Atlas 的 OSI review submission 作为 `Review Tracker Match` 分组展示，点击跳 `/tracker?focus=<id>`；这些条目不会写入 `licenses-index.json` / `licenses.json`，也不会计入正式 LicenseAtlas 收录数。

## 数据流

KB（source of truth）→ license-atlas 单向同步：

- `public/data/tracker.json`（~3.2MB，全量，lazy-load）— cp 自 KB `data/osi/license-review-tracker-v2.json`
- `src/data/tracker-index.json`（轻量，build-time）— 供详情页查 spdx→submission 映射，并包含 `review_dates`（首次提交、批准/否决日期）
- `src/data/tracker-meta.json`（极轻量）— 仅含 `_meta` 摘要，供 footer/about 显示更新时间和 tracker 汇总数，避免全站为了 meta 导入整个 tracker index。

`/tracker` 页面本身也采用 index-first 策略：客户端先动态导入 `tracker-index.json` 渲染列表和筛选统计，再后台预热 `public/data/tracker.json`。在全量详情尚未返回时，卡片以 index 态显示；用户展开卡片或通过 `?focus=` 跳转时会主动 `ensureFullData()`，拿到完整 timeline / participants / board vote / license texts 后替换为完整态。`ensureFullData` 必须保持稳定 callback，并用 ref 防重入；不要把 `indexEntries` 放进它的依赖，否则 index setState 后会重复触发首屏加载 effect。

## 更新流程

| 命令 | 作用 |
|---|---|
| `npm run build` | search-index + tracker sync + OSADL sync（hash 检测，无变化跳过）+ `NEXT_PRIVATE_BUILD_WORKER=0 next build --webpack` |
| `npm run sync:tracker` | 只同步 tracker（不跑 KB 构建） |
| `npm run update:tracker -- --month YYYY-MM` | 全链路：刷新 OSI `license-review`/`license-discuss` 邮件归档 + 重建索引 + 发现 pending + 合并 LLM point + build/enrich + point/text coverage checks + sync |
| `npm run update:tracker -- --since YYYY-MM` | 从指定月份到当前月份增量刷新 |
| `npm run update:tracker -- --skip-mail` | 跳过邮件抓取，只跑已有 KB 数据的 build/enrich/sync |
| `launchctl kickstart gui/$(id -u)/com.momo.license-atlas.tracker` | 手动触发一次自动更新探测（每 3h 自动跑，RunAtLoad=true） |

**增量检测**：`sync-tracker.mjs` 对 KB v2 的稳定 payload 做 hash（忽略 `meta.generated_at` / `meta.enriched_at` 这类纯重建时间戳），并同时检查 `tracker-index.json._meta.index_schema_version` 和 `tracker-meta.json` 是否存在。不变则跳过（幂等）；schema 变化或 meta 文件缺失时即使 source hash 不变也会重建 index/meta。

**轻量 index 日期字段**：`tracker-index.json` 写入 `review_dates.first_submitted` / `review_dates.decision` / `review_dates.decision_status`。优先级：首次提交 = OSI API `submission_date` → timeline 首个 `submission` → `stats.date_range[0]`；批准/否决日期 = OSI API `approval_date` → `board_vote.date` → timeline `board_decision.date`。详情页 `LicenseReviewBlock` 显示 `First Submitted` 和 `Approved Date` / `Rejected Date`。

**轻量 index 文本字段**：`tracker-index.json` 写入 `text_meta.count` / `linked_count` / `duplicate_count` / `diff_count` / `series` / `latest_text_date`，供详情页和未来按需加载判断，不在轻量 index 放全文。

**两种更新场景**：
- KB 先更新 OSI 源 → atlas 下次 `build` 自动识别 hash/schema 变化同步。
- atlas 一条龙 → `update:tracker` 调 KB 增量刷新邮件和 tracker 数据后同步。

## 状态裁决（status adjudication）

多源数据（OSI API / board minutes / 邮件归档 / curated RWP）互相矛盾时，由 LLM 裁决最终状态。链路：`prepare-status-adjudication.mjs`（生成输入+input_hash）→ `run-status-adjudication.mjs`（调 glm-4.6）→ `apply-status-adjudications.mjs`（校验 hash 后写回 tracker）。

**传输通道**（2026-08-28）：默认走 OpenAI 兼容端点 `https://open.bigmodel.cn/api/coding/paas/v4`（env `ADJUDICATION_OPENAI_BASE_URL`）：`response_format: json_object` + `thinking: disabled`（`ADJUDICATION_THINKING=enabled` 可开），单次调用，单条 2-15s。此前用的 Anthropic 兼容端点（`/api/anthropic`）structured output 每次调用都失败再 fallback 到内联 schema 重发，双倍耗时且输出常被截断（`Unexpected end of JSON input` 皆源于此），现仅作兜底。**模型对照（同通道 qpl-1-0 实测）**：glm-4.6 保留（发现证据错配且不被 API 元数据带偏）；glm-5.3-flash 略快但判断质量差半档，暂不采用。

**增量裁决**（2026-08）：prepare 读取已落盘输出的 `{submission_id → input_hash}`，输入未变的条目不进 batch，manifest 记录 `skipped_unchanged`；apply 对 skipped 条目按记录的 hash 复验旧输出后直接沿用。效果：已裁决且无新证据的条目（约 190+ 条）永不重跑 LLM，每轮只裁决真正变化的条目（如 OpenMDW 新邮件）——已定终态不会被无关变化重掷。

**自动重裁决 + 基线放行**（2026-08-23，`update-tracker.mjs` 内嵌）：历史三轮阻塞的根因是①灰色地带 manual review 每轮都 blocking、②重建后 input_hash/evidence ref 失效的旧输出需人工 `--mode local --ids` 重跑、③glm-4.6 偶发输出 schema 自相矛盾（conflicts 非空但 `requires_manual_review=false`）。现在编排器：默认对 apply/verify 传 `--allow-manual-pending`；apply 后解析 `manual-review.json` 中 `Invalid/Missing adjudication output` 的条目，自动以 `--mode local --ids` 重跑 LLM 再 apply（最多 3 轮）；LLM env 缺失时自动从 `~/.config/opencode/opencode.json` 的 `zhipuai-coding-plan` 读 key。

**Manual-review 基线**（`scripts/tracker-manual-baseline.json`，已提交）：已知灰色地带 id 集合（84 项起步）。运行时基线内的 id 静默放行（保持现状），**基线外的新 manual-review 项硬失败**（保留旧的"新冲突留人工"安全边界）；成功运行后自动 prune 已解决的 id（如 ncsa、motosoto 在 2026-08-23 轮离开 manual review）。人工确认新冲突后跑 `npm run update:tracker -- --rebaseline` 采纳新集合。`--strict-manual-pending` 恢复最严格的"任何 blocking 即失败"模式。

**KB 侧 schema 矫正**（`KB/scripts/run-status-adjudication.mjs` 的 `validateOutput`）：模型输出 conflicts 非空但 `requires_manual_review≠true` 时直接矫正为 true（模型自己的规则就要求 conflicts ⇒ manual review，属输出纪律问题而非语义分歧），不再依赖重试碰运气。顺带补齐 native structured-output 路径缺失的 `schema_version` 字段。

**数据质量教训**（2026-08-28，qpl-1-0 事件）：`osi-api-matches.json` 的 `name_match` 自动匹配会把无关 thread 错配给 OSI 条目（qpl-1-0 被挂上 EPL-2.0 的 2017 年审查邮件 + board vote，裁决 LLM 如实报告"证据与许可证不匹配"并 blocking，反而揪出了这个潜伏 bug）。修复：错配条目清成 `thread_cluster: null` 形态。排查发现同类的可疑 name_match 还有 ~9 个（icu/isc/mit → Æsthetic Permissive 等，多为 approved/legacy 条目、无裁决阻塞，待逐一人工验证后清理）。

**approved 条目的 sibling-thread 合并**（`KB build-license-review-tracker.mjs`，2026-08-28）：OSI API 条目的 timeline 来自 curated summaries；`license-summaries.json` 条目现支持 `merge_clusters: [关键词]`（与 RWP 条目同名机制），把主题含关键词的全部 thread cluster 并入 timeline 并加为 alias。首例：python-2-0 并入 3 月 license-discuss 预讨论 + 2026-08 "Python licenses: ..." 重复提交 thread（4→20 封）。

**Golden 测试集 + 加速实验**（2026-08-28，`KB/data/osi/status-adjudication/test-set.json` + `KB/scripts/test-status-adjudication.mjs`）：19 个分层 golden case（approved×4 / legacy×3 / withdrawn×3 / superseded×2 / pending×3 / rejected×3 / 证据错配存活者 qpl-1-0），label 取人工确认的 v2 status + manual-review 保守标志（manual 字段仅表达"客观证据冲突"，人工保守留查的条目标 manual:false）。`prepare-status-adjudication.mjs --export-all-inputs` 导出全部输入 → 测试脚本评分 status/manual-flag 双指标。**批量档位实测**（glm-4.6，thinking off）：batch=1/并发=2 基线 19 条 256s（1 实质误判 whonix rejected→withdrawn，但 manual=true 正确兜住）；batch=4/并发=2 干净跑 8/8 全对、2 次调用 27.7s（3.5s/条，质量 100%）；batch=8/并发=2 19 条 63.6s、0 截断（有界最坏 8×max 单条 = 6.9K < 8192 输出预算，计算+实测双证）但质量 95%（cnri-python superseded→legacy，证据解读边界非互扰）。**结论：batch=4 为甜点档**（质量上限 + 速度与 8 持平 + 截断安全余量）；batch 上限真实约束是输出预算 8192（batch≥12 最坏越界）与多输出纪律，非 context window（200K，远未触顶）。生产脚本支持 `ADJUDICATION_BATCH`（默认 1=行为不变）与 `ADJUDICATION_CONCURRENCY`（默认 1），batch 失败自动降级逐条。GLM Coding Pro 并发官方口径"按套餐动态调整"（Pro 建议 1-2 项目并行），并发 2 为其他 session 预留余量；脚本对 429/1302 自动退避。维护：pending 案例出决议后更新 test-set label 并在 PR 里注明。

**输入构成**：每条 timeline 事件的摘要卡（subject/sender/1-2 句 point 摘要，非邮件原文）+ board minutes motion（截断 1800 字符）+ OSI API / curated RWP 元数据。取「关键事件（submission/withdrawal/board_decision/revision）+ 最近 8 条」上限 30。测试证明不能只保留投票/撤回事件（会丢失讨论中的隐含撤回线索，libpng-v2 会误判 rejected）。

**已知灰色地带**（manual review 长期 ~84 项：证据冲突类 + curated 唯一证据无邮件/board vote 佐证类，含 open-source-social-network、whonix、libpng-v2、c-fsl-v1-1、cal-beta-2、mosl、python-2-0、cnri-python 等；update:tracker 默认放行保持现状，条目仍登记在 `manual-review.json` 留人工复核）。新增证据冲突明显增多时在总结中报告并人工确认。

**Prompt 规则**（v2）：`approve in the legacy category` / `legacy approval` 的 motion 判 **legacy** 而非 approved（2026-08 修复：v1 缺此规则导致 cddl-1.1、wordnet、oldap-2.8、bsd-3-clause-lbnl、multics 被误判 approved）。PROMPT_VERSION 变更会使全部条目 hash 失效，触发一次性全量重裁决迁移。

## 自动更新（事件触发）

每 3 小时 launchd agent（`com.momo.license-atlas.tracker`）探测 OSI Pipermail 当月归档页（HEAD Last-Modified/Content-Length，毫秒级）：

- **无变化** → 短路退出，零 LLM 调用
- **有变化** → `opencode run` 非交互执行全链路（update:tracker，内嵌 stale 裁决自动重跑 + 质量门 → sync → lint）

**macOS TCC 约束**：launchd 的 bash 无法访问 `~/Documents`（macOS 26 对 LaunchAgent 的 exec/write 门控），因此 runner 全部放在 `~/.local/share/license-atlas-tracker/`（wrapper 脚本、探测脚本副本、prompt、日志），仓库只作为数据源由 opencode（有独立 TCC 授权）读写。atlas 仓库内的 `scripts/auto-update-tracker.sh` / `scripts/check-tracker-updates.mjs` 是 source of truth，wrapper 每次运行前尝试同步副本（被 TCC 拦截时用已装副本）。

**无人值守权限**：非交互 opencode 无法回答权限弹窗，wrapper 用 `OPENCODE_CONFIG=~/.local/share/license-atlas-tracker/opencode.json` 预授权 bash/edit/webfetch/external_directory（含 KB 目录）。

**安全边界**：质量门全绿 + lint 通过才 commit/push；任何失败 → 回滚 tracker 数据文件、日志记录原因、不 push。LLM 模型：`STATUS_ADJUDICATION_MODEL=glm-4.6`、`POINTS_MODEL=glm-4.6`（实测 schema 纪律最好；glm-4.6v 大输入产 malformed JSON，glm-5.3 不守 evidence_refs 对象形状，glm-4.5-air 输出围栏率高且无速度优势）。

## 组件

- `src/app/tracker/` — `/tracker` 路由（page + client）
- `src/components/tracker/` — tracker-card / timeline-strip / board-vote-card / participants-list / review-detail-tabs
- `src/components/license-review-block.tsx` — 详情页内嵌块
- `src/lib/search.ts` — 正式 Atlas MiniSearch 结果之外，在有搜索查询时动态加载 `tracker-index.json` 并生成 `Review Tracker Match` 搜索分组；只作为跳转入口，不把 review submissions 并入正式许可证库
- `src/components/footer.tsx` — 全站页脚显示最新数据更新时间，取 `src/data/stats.json.updated`、`src/data/tracker-meta.json.generated_at` 与 `src/data/osadl-meta.json.generated_at` 中最新者

## 当前同步快照

- `source_hash`: `51dd9bdf25e31325`
- `index_schema_version`: `4`
- 194 个 submissions：approved 102 / rejected 47 / withdrawn 8 / pending 14 / superseded 3 / legacy 20
- 86 个 submissions 含 `license_texts`（共 208 条记录），其中 155 条可直接回链 timeline event，43 条重复内容标记 `duplicate_of`，76 个同系列相邻版本 diff
- 89 个 `board_vote`：minutes 61 / timeline 4 / osi_api 24
- tracker → Atlas 正式许可证的映射数以 `resolveTrackerEntry()` 运行时计算为准（见 `src/lib/tracker-match.ts`），未映射的 submission 即首页 `Review Tracker Match` 搜索分组的 tracker-only 候选

### License text 抽取口径（2026-08 增强）

内联抽取的 marker 列表覆盖 `== Appendix: The license text ==`、`A PLAINTEXT VERSION OF THE LICENSE FOLLOWS:`、`A plain text version of the license is below`、`The full text of the licences follows,`（容忍复数 licences 与行中长引言）、折行 `here is the raw text\nof the license:`、`The license:` 等变体，并容忍 `Copyright ©/(c)/XXXX` 与行首 markdown 强调。marker 切片后若开头不是文档头（提交人签名、问候夹在引出语和正文之间），用 `skipToDocumentStart` 在前 25 行内找到第一个文档头行重切；找不到则放弃该切片。整邮件 `license-inline` 文件在 marker 缺失时回退到锚点隔离（`isolateEmbeddedLicenseStart`）。

所有非附件来源的候选必须通过 `hasLicenseDocumentStart`（首行必须是许可证文档头：Title Case 干净标题/Copyright/grant 开头/全大写标题/CJK 许可证名/markdown 标题），讨论 prose（"Socialtext has adopted..."、"It is almost a word-for-word clone..."）、回复头（`Subject:`/`Betreff:`）和部分引用一律拒绝。标题行判定要求 Title Case（显著词大写率 ≥90%，跳过短词/数字/符号词），防止把含版本号的 prose 句（"The SS Public License version 1.0 was put into production"）当标题。

许可证正文后附带的提交表单（`Rationale:`、`Proliferation category:` 等）会被 `stripTrailingSubmissionForm` 截断（表单在正文后半才截；截后剩余过少说明表单在开头，放弃截断）；提交模板专属标签 ≥2 视为表单邮件直接拒绝（许可证自带元数据头 `License name/Version/Date/License steward` 不算）。alias 匹配前剥除邮件主题前缀（`For approval:` 等）；同一候选文件被多个 submission 挂载时，若某 submission 以主名（name/spdx/id）挂载且通过了全部守卫，纯 alias 挂载会被后置仲裁剥夺——用于防御基础 tracker 的 thread 误合并（如 SSPL 线程挂在 Sun Public License 行上）。

已知残留：相邻版本 thread 歧义（ZPL 2.1 正文挂在 zpl-2-0 行）、ms-rl 行带一条 Ms-PL 文本、CERN OHL v2 三变体共享同一份含三份正文的 display（未按 SPDX 变体切分），属上游 thread 聚类/邮件结构问题；Moritz30、TOPPERS 等提交正文从未进入邮件归档（只有站外链接），无法恢复。

## Tracker-Only 搜索口径

首页搜索的 `Review Tracker Match` 是一个旁路入口，用于发现 OSI review 中出现、但不适合正式并入 Atlas 许可证库的 submission，例如 pending/rejected/withdrawn/superseded 的用户提交许可证。判定口径是：遍历 `licenses-index.json`，用 `resolveTrackerEntry()`（SPDX、slug、family、手工 alias/name map）找可映射的 tracker submission；剩余 unique `submission.id` 即 tracker-only 候选。

当前 tracker-only 候选包括：
- pending：Linkumori Free License 1.0、MutuaL v1.2、AI-MIT License 1.0、Public Benefit Zero Copyright License v2.0、Open Innovation License (OIN)
- rejected：Ritchey Permissive License v11、Open Source Social Network License 1.0、The Vaccine License、GPL-3+-with-whonix-additional-terms、Twente License、C-FSL v1.3、YetiForce Public License v3、ZENTAO PUBLIC LICENSE、Moritz30、NCCL、S-FSL v1.3.6 / v1.3.5、Tidepool、MOSL、Svoboda、Python License Changes、netX、WebM third-party submission、MXM、Open Source Hardware License、Educational Community License 1.0、Socialtext、Generic Attribution Provision、BIPL、TrueCrypt Collective、MindTree、Academic Citing License、NASA OSA 1.1、OSSAL、BXAPL、APOSSL、qmail License
- withdrawn/superseded：SSPL v2、License Zero Reciprocal Rewrite / L0-R、Open Logistics v1.2、CAL Beta 2、CAL Original Draft

注意：AGPL-3.0 和 LGPL-3.0 当前会出现在“未映射”审计中，是因为 Atlas 同时有 `*-only` 和 `*-or-later` 变体，而 tracker submission 使用无后缀名称；除非明确决定 canonical 绑定，否则不把它们作为 tracker-only 搜索卡片的主要用例。

## 设计约束

- KB 是 source of truth；Atlas 只同步和展示。状态色纳入 atlas 语义色板（见 `badge.tsx` `review-*` themes）。详见设计文档 `docs/superpowers/specs/2026-06-18-license-review-tracker-integration-design.md`。
- KB 数据构建细节见 `docs/OSI-TRACKER.md`。
- `public/data/tracker.json` 当前约 8MB，包含提交许可证文本正文和 diff hunks。文本来源是本地附件文件、Pipermail plain-text MIME part，以及 `Text of the license:` / `License text:` / “pasted full text/final draft” 上下文引出的强边界内联许可证块；中英文条款信号都会评分。整封提交邮件、FAQ、OSD notes、讨论回复、引用块、代码附件、diff、签名、转发块和 mailing-list footer 等被过滤。内联块必须通过强许可证边界检查（如 `Copyright YYYY` + title/version/definitions、干净 license title、`Redistribution and use`、`Permission is hereby granted`、中文许可证条款信号）；泛 BSD 基础 slug 不会跨挂 `BSD-3-Clause-Open-MPI` / `BSD-3-Clause-PPPL` 等变体。如果后续抓取更多附件导致 gzip 明显增长，应拆为 `public/data/tracker-texts/{submission_id}.json` 按需加载。合规口径：这些提交许可证原文来自公开 OSI review/discussion 记录，仅用于研究和审查追踪；版权仍归原作者或 license steward，UI 需持续展示来源链接和版权归属提示。
- 首页首屏不得静态导入全量 `public/data/tracker.json`。`Review Tracked` 首页标签允许通过轻量 `tracker-index.json`/`tracker-match` 在 module scope 同步计算，保证首屏就能显示；搜索旁路仍通过 `src/lib/search.ts` 动态 import `tracker-index.json`，避免无查询时加载 tracker-only 搜索数据；footer/about 只读取轻量 meta（`tracker-meta.json`、`osadl-meta.json`）。
- Tracker 可见 UI 文案走 `src/lib/i18n.tsx`。新增按钮、空态、tooltip、role label、vote tally、License Texts 控件时必须补 en/zh key；邮件 point/许可证正文属于数据内容，不在 UI i18n 字典内翻译。

## 近期 UI 行为

- `/tracker` 底部右侧有无文字的返回顶部按钮；页面滚动超过一屏后出现，点击平滑回到顶部。
- 左上 LicenseAtlas/Home 导航会清空首页搜索和筛选状态，避免回到首页后保留旧查询。
- Review detail 的 `[source ↗]` 链接使用 `whitespace-nowrap`，不会被截断或单独断开。
- Review detail 的 License Texts tab 显示结构化许可证原文历史：版本列表、series、日期、timeline 编号、提取可信度、重复标记、来源链接、本地正文和版权/来源提示；提取可信度以 `High` / `Medium` / `Low` 首字母大写标签展示，并通过 hover tooltip 解释其含义（附件/MIME part 为高可信，从正文 marker 截取为中等可信，边界较弱为低可信）。若同一 submission 有多个 series（如 ModelGo），左栏顶部显示 series filter（`All` / `MG0` / `MG-BY` / `MG-BY-OS` / `MG-BY-SA`），点击 timeline 的 `Text` 会自动切到对应 series。若选中版本有同系列上一版，`Diff from previous` 显示 line-level 增删 hunks。Timeline 事件若有关联 `text_ids`，事件行显示 `Text` 按钮可切到对应文本；文本详情中的 `timeline #N` 可跳回并高亮原事件。Timeline 事件列表和 License Texts 内容区保持相同的 560px 最大高度并内部滚动，避免切换 tab 时页面视口大幅跳动。
- Participants tab 使用紧凑 pill 展示参与者，角色标签统一为 title case（`Submitter` / `Board Member` / `Reviewer` / `Participant`），并用低饱和背景色区分 submitter、board member 和 reviewer；消息数紧跟在同一 pill 内，保持列表密度。
- ModelGo 在 tracker 中显示为 `ModelGo License Family v2.0`，不是单个 `Attribution` 变体；四个具体变体保留在 aliases 和 License Texts series 中：`MG0` / `MG-BY` / `MG-BY-OS` / `MG-BY-SA`。
- 当前 License Texts 保守口径来自 KB `enrich-license-tracker.mjs`：119 条文本、78 条直接回链 timeline、15 条重复内容标记。Linkumori 从 006108 的内联最终草案恢复为 1 条 `Linkumori Free License` 正文；ModelGo 保留 22 条高可信附件/MIME 文本；BSD-3-Clause-Open-MPI、普通 BSD、MS-PL、QPL、EPL 2.0、EFL 2.0 的讨论片段被过滤。
- 多个 tracker 卡片可同时展开；展开一个 license 不会折叠其他已展开 license。
- Timeline hover tooltip 的事件类型首字母大写，并在 `Feedback` 后紧跟 sentiment tag（如 `negative`）。
- 详情页内嵌 `LicenseReviewBlock` 显示 `First Submitted` 和最终 `Approved Date` / `Rejected Date`。
