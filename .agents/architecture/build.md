# 构建与发布

Covers: scripts/build.mjs, tsdown.config.mjs, package.json

构建是自包含的：`tsc` 产出 `lib/types`，`tsdown` 把两半各自打包成 `lib/index.js` 与 `lib/client.js`。全部构建依赖来自本地 devDependencies，不 vendored 宿主源码，也没有 sync 步骤。

## 两半的产物形状

Node 侧是普通 ESM 库，`tsc` 已产出 `lib/types`，`tsdown` 只做打包。浏览器侧是 CommonJS 闭包，首行必须是 `window.__ModuleLoader__.load({ id: "@local/dsh-session-settings", factory: (require) => {...} })`，否则 shell 无法装载。

`lib/` 在 `.gitignore` 内，不提交。发布走 `release.yml` 构建 `dist` 分支，不手工改 `dist`。

## 依赖变更的连带义务

改依赖必须同次提交 `pnpm-lock.yaml`，否则 CI 的 `--frozen-lockfile` 失败。改 `package.json` 的 `peerDependencies` 等于改宿主兼容门槛，按 [服务端与宿主生命周期](server.md) 那一节处理。

## 构建不感知框架

构建脚本、`tsdown.config.mjs` 与 `package.json` 不得提及 `AGENTS.md` 或 `.agents/`。删掉这两个受管路径后 `pnpm install && pnpm run build` 必须照常通过——由 `verify-detachable` 机器校验。
