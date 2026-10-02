# Agent Note: 自包含构建与 dist 分发流水线

Status: implemented

## Problem

插件需要产出两种性质不同的产物：给 Node 宿主加载的 ESM 库，以及给浏览器 shell 加载的闭包。早期做法是在仓库里 vendor 一份 DSH 源码树（`external/deepseek-harness/`）并写脚本从它同步构建配置。这带来三个问题：构建依赖与本仓库的 `devDependencies` 版本会漂移；vendor 树让仓库体积随宿主增长；同步脚本本身成为需要维护的代码。

## Proposal

构建完全自包含，不 vendor 宿主源码，也不再有同步步骤。

- `scripts/build.mjs` 是唯一构建入口：先删 `lib/`，再跑 `tsc -p tsconfig.json`（类型检查 + 输出 `lib/types` 声明），最后跑 `tsdown -c tsdown.config.mjs`；任一步非零退出即整体失败。`--check` 只跑 `tsc --noEmit`，不产出文件。
- `tsdown.config.mjs` 定义两段产物：Node 段把 `lib/types/index.js` 打成 ESM 的 `lib/index.js`；浏览器段把 `src/client/index.ts` 打成 CJS 的 `lib/client.js`，用 `banner`/`intro`/`footer` 包成 `window.__ModuleLoader__.load({ id, factory })` 闭包。
- **客户端纯净门（purity gate）**是构建期不变量：`clientPurityGate` 拦截任何 `@deepseek-ai/*` 的裸标识符，只放行 `CLIENT_EXTERNALS` 里的平台模块表项，其余一律抛错终止构建。类型导入被擦除，不会触发该门。`CLIENT_EXTERNALS` 保持与宿主平台种子逐字一致（宁多勿少），以免升级宿主时误伤合法平台行。
- 分发走 GitHub Actions：`.github/workflows/release.yml` 在 `main` 推送时构建，把 `lib/index.js`、`lib/client.js`、`cordis.patch.yml`、`LICENSE` 与净化后的 `package.json` 推到 `dist` 分支；使用者以 `dsh plugin --profile web add github:u9521/dsh-session-settings#dist` 安装，无需本地构建。CI 的 pnpm 由 `pnpm/setup@v3` 以 `version: latest` 安装，**必须 ≥ 10.12.0**：本仓库把 `autoInstallPeers: false` 这类 settings 写在 `pnpm-workspace.yaml`，而 pnpm 9 只从该文件读 `packages` 与 `catalog(s)`、不读 settings，于是取默认 `true`，与锁文件记录的 `false` 冲突，`--frozen-lockfile` 以 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` 失败。其余步骤用 `actions/checkout@v7` 与 `actions/setup-node@v7`（Node 22、`cache: pnpm`）。
- 宿主兼容性是硬门槛而非兼容层：`peerDependencies["@deepseek-ai/dsh"]` 声明 `>= 0.2.0-rc.1`，`main` 分支不保留任何向后兼容垫片；不兼容时由宿主拒绝加载，而不是半可用地跑起来。闸门机制的变更理由见 [DSH 0.2.0 兼容性对齐](2026-09-29-dsh-0-2-0-compatibility.md)。

## Alternatives considered

- **继续 vendor `external/deepseek-harness/` + `scripts/sync-tsdown.mjs` 同步**：否决。同步脚本需要人工触发、易漏，且构建结果取决于 vendor 树与本地 `devDependencies` 谁的版本更新。
- **只跑 `tsc`，不做 bundle**：否决。浏览器产物必须是单个 CJS 闭包并经模块表 `require` 解析平台模块，`tsc` 无法生成该形态。
- **客户端产物允许导入其它插件的模块**：否决。模块表只提供平台行，跨插件值导入在运行时必然解析失败；改为通过 cordis 服务协作，构建期即拦截。
- **CI 里额外发布 npm 包**：否决。目标使用者是 DSH 用户，`dist` 分支 + `#dist` 说明符已足够，且省去发布凭据与版本号管理。

## Acceptance criteria

- `pnpm install && pnpm run build` 在本仓库内完成，不读取任何 vendor 宿主源码树。
- `pnpm run check` 在类型错误时以非零码退出。
- 在 `src/client/**` 中引入一个非平台 `@deepseek-ai/*` 值导入时，`pnpm run build` 失败并给出 purity 提示；改为 `import type` 后构建通过。
- `lib/index.js` 为 ESM、`lib/client.js` 为 CJS 且首行为 `window.__ModuleLoader__.load({ id: "@local/dsh-session-settings", ... })`。
- 推送 `main` 后 `dist` 分支仅包含运行时必需文件（`lib/`、`cordis.patch.yml`、`LICENSE`、净化后的 `package.json`）。
- 推送 `main` 后该 workflow 的 `Install dependencies` 步骤通过，`dist` 分支被更新。

## Risks

- **平台模块表漂移**：`CLIENT_EXTERNALS` 是手工镜像宿主平台种子的清单。宿主新增平台行而本仓库未同步时，构建会抛 purity 错误——失败方向安全，但需要人工同步。判定平台行的权威来源见 [DSH 0.2.0 兼容性对齐](2026-09-29-dsh-0-2-0-compatibility.md)。
- **`dist` 分支是构建产物**：不要直接在其上提交；`release.yml` 每次推送都会覆盖，手工修补会丢失。
- **本地与 CI 的依赖差异**：CI 用 `pnpm install --frozen-lockfile`，本地若锁文件未同步会得到不同依赖树；改依赖后必须先提交 `pnpm-lock.yaml`。CI 的 pnpm 版本浮动（`version: latest`），跨大版本的语义变更会在下一次推送时直接生效；本地 12.3.4 与 CI 的次版本差不影响锁文件校验，因两者都 ≥ 10.12.0。
- **CI 工具的版本漂移**：`release.yml` 里各 action 的版本是手写常量，需人工跟进。上游随 Node 运行时弃用推进大版本时，会以运行日志里的弃用警告（如 `actions/checkout@v4`、`actions/setup-node@v4` 的 node20 警告）或强制升级的形式暴露；当前三者均指向 node24 运行时。
