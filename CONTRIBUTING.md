# Contributing to LicenseAtlas

English | [中文](CONTRIBUTING.zh-CN.md)

Thanks for your interest in improving LicenseAtlas. This document covers what kinds of contributions are welcome, how to set up a local environment, and what to expect from the pull-request process.

## Ways to contribute

| You want to… | Where to go |
|---|---|
| Report a wrong or incomplete license text, tag, SPDX id, or permission / condition / limitation | Open an issue with the [License Feedback template](https://github.com/morningD/license.atlas/issues/new?template=license-feedback.yml) |
| Fix or improve the site's code | [Open a pull request](https://github.com/morningD/license.atlas/compare) |
| Improve the documentation or READMEs | [Open a pull request](https://github.com/morningD/license.atlas/compare) |
| Suggest a new data source or feature | [Open an issue](https://github.com/morningD/license.atlas/issues/new/choose) |

### License data versus code

LicenseAtlas keeps deployable data snapshots in `src/data/` and `public/data/`. They are produced by an upstream data pipeline and synced into this repository, so a data file edited by hand would be overwritten by the next sync.

If a license entry is wrong, please open an issue instead of editing the data files. Include the address of the license page and, where possible, the authoritative source that shows the correct value. Corrections are made in the pipeline and re-synced.

Code, styling, search, translations, and documentation live in this repository and can be changed here.

## Development setup

You need [Node.js](https://nodejs.org) 24 or later and npm.

```bash
git clone https://github.com/morningD/license.atlas.git
cd license.atlas
npm install
npm run dev       # http://localhost:3000/license.atlas
```

The site is a static export served under the `/license.atlas` base path, so local pages live at `http://localhost:3000/license.atlas/...`.

## Before opening a pull request

```bash
npm run lint         # ESLint
npx tsc --noEmit     # type check
npm run test:progress
npm run build        # static export to out/
```

`npm run build` regenerates the search index and syncs the tracker, OSADL, and project-showcase data. Without the upstream pipeline checked out, the sync steps keep the committed data and the build still succeeds.

For changes that affect the interface, also check the pages you touched in a browser: in English and in Chinese, in light and in dark mode.

## Guidelines

- Keep each pull request focused on one change.
- Follow the style of the surrounding code.
- Every piece of user-facing text goes through the dictionary in `src/lib/i18n.tsx`, with both the English and the Chinese entry.
- The site is statically exported. Anything that needs a server at request time will not work.
- Do not commit build output (`out/`, `.next/`) or regenerated data files that are unrelated to your change.

## License of your contributions

LicenseAtlas is licensed under the [Mulan Permissive Software License, Version 2](LICENSE) (MulanPSL-2.0).

By submitting a pull request, an issue, or any other contribution to this project, you agree that:

1. You have the right to make the contribution, and it does not violate the rights of anyone else.
2. Your contribution is and will be licensed under MulanPSL-2.0, the license of the rest of the project.

You keep the copyright of what you wrote. What you grant is a license, on the terms of MulanPSL-2.0, to everyone who receives the software. If you do not agree with these terms, please do not submit the contribution.

MulanPSL-2.0 has no clause that automatically licenses contributions under the project license (Apache-2.0, which this project used before, has one), which is why this statement is spelled out here.
