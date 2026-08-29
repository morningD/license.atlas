# LicenseAtlas

LicenseAtlas 是面向软件、数据、AI 模型与 Agent 的许可证探索器，覆盖 **2,713** 个许可证和服务条款——支持搜索、筛选、对比，并提供中英文双语界面。

**在线访问**：[LicenseAtlas](https://morningd.github.io/license.atlas)

[English](README.md) | 中文

## 功能特性

- **全文搜索** — 搜索许可证名称、SPDX ID、来源、正文，支持模糊匹配，并优先展示 SPDX/slug 精确或前缀匹配结果（基于 MiniSearch）
- **分类筛选** — 软件、模型、数据、智能体、服务条款
- **标签筛选** — 宽松许可、Copyleft、知识共享、硬件等
- **热度与趋势** — 基于 HuggingFace、GitHub、Kaggle 数据的迷你趋势图
- **[OSI 许可证审查追踪器](https://morningd.github.io/license.atlas/tracker)**（`/tracker`）— 194 个 OSI 许可证提交、审查状态、董事会投票、时间线与关联许可证文本历史的实时看板
- **OSADL 检查清单信号** — 为已匹配许可证展示义务/禁止项摘要、Copyleft/源码披露/专利提示，以及方向性兼容性数据
- **明星项目** — 在部分许可证详情页右侧展示按来源分组的 GitHub、HuggingFace 与 Kaggle 代表项目，并支持增量刷新
- **双语界面** — 中英文切换，自动检测浏览器语言
- **暗色模式** — 跟随系统偏好 + 手动切换
- **静态导出** — 2,713 个预渲染许可证页面，加载极速

## 技术栈

- [Next.js 16](https://nextjs.org)（App Router，静态导出）
- [MiniSearch](https://github.com/lucaong/minisearch)（客户端全文搜索引擎）
- [Tailwind CSS v4](https://tailwindcss.com)
- TypeScript

## 开发

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # 静态导出到 out/
```

数据源维护命令：

```bash
npm run update:data     # 完整增量更新：许可证原文 + tracker + OSADL + 明星项目
npm run sync:licenses   # 将 KB 已清洗的主许可证语料同步到 Atlas
npm run update:tracker   # 通过相邻 KB 仓库刷新 OSI license-review/license-discuss 数据
npm run update:osadl     # 通过相邻 KB 仓库刷新 OSADL 检查清单原始数据
npm run update:projects  # 通过相邻 KB 仓库刷新 GitHub/HuggingFace/Kaggle 明星项目 sidecar
npm run update:projects -- --source huggingface --force  # 只刷新某一个明星项目数据源
npm run sync:tracker     # 将已构建的 KB tracker 数据同步到 Atlas
npm run sync:osadl       # 将已构建的 KB OSADL 检查清单数据同步到 Atlas
npm run sync:projects    # 将已构建的 KB project-showcase 数据同步到 Atlas
```

日常更新优先使用 `npm run update:data`——整条链路已无人值守：KB 主许可证语料流程
（原文发现、清洗、热度）→ GLM 自动审核 HuggingFace/GitHub 新自定义许可证候选 →
语料同步 → README 总数刷新 → tracker、OSADL 与 project-showcase sidecar。上面的
局部命令主要用于定向调试或补跑。详见
[Data Update Workflow](docs/data-update-workflow.md)。
GLM 判定收录的自定义许可证进入 KB confirmed manifest 后自动同步；来自未审核来源的
全新 slug 仍会被拦截，需显式 `--allow-new-licenses`。旧的人工审核流程可用
`npm run update:data -- --interactive` 回退。

`npm run build` 会重新生成搜索索引，同步 tracker、OSADL 与 project-showcase sidecar 数据，然后执行 Next.js 静态构建。当前 build 脚本设置了 `NEXT_PRIVATE_BUILD_WORKER=0`，用于规避 Next.js 16 webpack build worker 在本地和 CI 中观察到的卡住问题。

## 数据来源

许可证原文聚合自：

| 来源 | 覆盖范围 |
|------|---------|
| SPDX | 695 个许可证 |
| TLDRLegal | 145 个许可证 |
| OSI | 123 个批准许可证 |
| GNU / FSF | 66 个许可证 |
| Creative Commons | 37 个许可证 |
| choosealicense.com | 47 个许可证 |
| ScanCode LicenseDB | 自定义许可证文本与元数据 |
| Blue Oak Council | 宽松许可证质量评级 |
| HuggingFace Hub | 自定义模型与数据集许可证 |
| GitHub | Agent 技能、MCP 服务器及工具许可证 |
| Open Data Commons | 3 个数据许可证 |
| RAIL | 负责任 AI 许可证 |
| 开放原子开源基金会 | 模型与硬件许可证（中英双语） |
| OpenMDW | AI 模型及关联制品的宽松开源许可证（Linux Foundation） |
| OSI Review Tracker | 194 个 OSI 许可证审查提交、时间线、首次提交/决议日期、董事会投票记录，以及来自公开审查/讨论记录的本地归档提交许可证文本 |
| OSADL Open Source License Checklists | 124 条检查清单记录，123 个匹配的 LicenseAtlas 页面，并提供由检查清单提取的义务/禁止项、Copyleft/源码披露/专利提示与方向性兼容性摘要 |
| Project Showcase | 32 个精选许可证的 GitHub 仓库、HuggingFace 模型与 Kaggle 数据集榜单，经标准化后作为详情页右侧 sidecar 展示 |

热度数据来自 HuggingFace Hub（280 万+ 模型）、GitHub（28 种许可证类型）和 Kaggle（通过 Meta-Kaggle 覆盖 71.4 万+ 数据集）。许可证卡片上的趋势火花线来自 HuggingFace models parquet 提取的月度 license-trends；GitHub 提供仓库计数和明星项目数据，Kaggle 提供数据集热度。Project Showcase 中 GitHub 按 stars 排序，HuggingFace 在许可证有活跃趋势信号时按本地 Hub `trendingScore` 排序（top 趋势分低于 5 的组回退到 likes 并展示 top 5，除非第 5 名 likes 超过 5 则展示 top 10），Kaggle 按 votes 排序；许可证会在 Atlas 聚合计数达标，或 raw 源数据里出现明确热门的 top item 时进入展示。更新流程在源级做增量刷新：GitHub 按 license key 做新鲜度窗口缓存，HuggingFace 用 parquet 指纹门控，Kaggle 用最新 Meta-Kaggle version id 以及缓存的 API 解析 URL/缩略图元数据门控，Atlas 侧同步再做 hash 检测。可用 `npm run update:projects -- --source <github|huggingface|kaggle> --force` 只刷新单个数据源。
网站页脚显示许可证语料的最新更新时间（`/tracker` 页除外，该页头部展示 tracker 自身的
数据时间），并与页面浏览量计数同排展示。
OSI Review Tracker 中的提交许可证原文来自公开 OSI 审查/讨论记录，仅用于研究和审查追踪；版权仍归原作者或许可证维护方所有。
OSADL 检查清单数据归属 Open Source Automation Development Lab (OSADL) eG，由 OSADL 以 CC-BY-4.0 原始数据形式发布；LicenseAtlas 将其作为信息性合规元数据展示，不构成法律意见。

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 许可。
