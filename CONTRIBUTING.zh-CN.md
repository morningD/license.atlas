# 参与 LicenseAtlas 贡献

[English](CONTRIBUTING.md) | 中文

感谢你愿意改进 LicenseAtlas。本文说明欢迎哪些贡献、如何搭建本地环境，以及提交 Pull Request 的流程。

## 贡献方式

| 你想…… | 去哪里 |
|---|---|
| 报告错误或不完整的许可证原文、标签、SPDX ID、权限 / 条件 / 限制 | 使用 [License Feedback 模板](https://github.com/morningD/license.atlas/issues/new?template=license-feedback.yml)提交 Issue |
| 修复或改进站点代码 | [提交 Pull Request](https://github.com/morningD/license.atlas/compare) |
| 改进文档或 README | [提交 Pull Request](https://github.com/morningD/license.atlas/compare) |
| 建议新的数据源或功能 | [提交 Issue](https://github.com/morningD/license.atlas/issues/new/choose) |

### 许可证数据与代码的区别

LicenseAtlas 在 `src/data/` 和 `public/data/` 中保存可部署的数据快照。这些文件由上游数据管线生成并同步进本仓库，手工修改的内容会在下一次同步时被覆盖。

如果某个许可证条目有误，请提交 Issue，而不是直接修改数据文件。请附上许可证页面的地址，并尽可能给出能说明正确内容的权威来源。修正会在数据管线中完成，然后重新同步。

代码、样式、搜索、界面翻译和文档都在本仓库中，可以直接修改。

## 搭建开发环境

需要 [Node.js](https://nodejs.org) 24 或更高版本，以及 npm。

```bash
git clone https://github.com/morningD/license.atlas.git
cd license.atlas
npm install
npm run dev       # http://localhost:3000/license.atlas
```

站点是以 `/license.atlas` 为基础路径的静态导出，本地页面位于 `http://localhost:3000/license.atlas/...`。

## 提交 Pull Request 之前

```bash
npm run lint         # ESLint
npx tsc --noEmit     # 类型检查
npm test             # 单元测试
npm run build        # 静态导出到 out/
```

`npm run build` 会重新生成搜索索引，并同步 tracker、OSADL、project-showcase 数据和来源规模数字。在没有上游数据管线本地检出的情况下，同步步骤会沿用已提交的数据，构建仍然可以完成。

如果改动涉及界面，请在浏览器中检查受影响的页面：中英文各一遍，浅色和深色模式各一遍。

## 约定

- 每个 Pull Request 只做一件事。
- 遵循周围代码的风格。
- 所有面向用户的文案都要经过 `src/lib/i18n.tsx` 中的字典，并同时提供英文和中文条目。
- 站点是静态导出的，任何在请求时需要服务器的功能都无法工作。
- 不要提交构建产物（`out/`、`.next/`），也不要提交与本次改动无关的重新生成的数据文件。

## 贡献的许可

LicenseAtlas 基于[木兰宽松许可证，第2版](LICENSE)（MulanPSL-2.0）许可。

向本项目提交 Pull Request、Issue 或任何其他贡献，即表示你同意：

1. 你有权作出该贡献，且它不侵犯任何其他人的权利。
2. 你的贡献是并将基于 MulanPSL-2.0 许可，与项目其余部分相同。

你保留你所写内容的版权。你授予的是一份许可：按照 MulanPSL-2.0 的条款，授予每一个收到该软件的人。如果你不同意这些条款，请不要提交贡献。

木兰宽松许可证没有“贡献自动按项目许可证授权”的条款（本项目之前使用的 Apache-2.0 有这样一条），所以这里把它明确写出来。
