# Agent Note: DSH 0.2.0 兼容性对齐

Status: implemented

## Problem

宿主主线升级到 DSH 0.2.0 后，本插件的依赖与兼容性声明需要重新对齐。核查中发现两件事：

1. **`engines.dsh` 已失效。** 0.2.0 的宿主不再读取 `engines.dsh`；唯一的 DSH 兼容闸门改为 `peerDependencies` 中的 `@deepseek-ai/dsh*` 键。本插件声明了 `engines.dsh` 却没有 `peerDependencies`，而 `evaluatePluginCompatibility()` 在 manifest 缺该键时立即返回 `undefined`（`dsh-app-boot/lib/index.js:289`），因此任何版本的宿主都会照常加载本插件。AGENTS.md 的「宿主兼容性硬门槛」不变量因此处于空转状态。
2. **安装树里存在陈旧同名包，会误导排查。** `@deepseek-ai/dsh-client-web@0.1.0-rc.6` 是无人依赖的历史遗留包，其 `PLATFORM_MODULES` 与运行时真实平台种子不同，按它推断客户端 externals 会改错方向。

## Proposal

**`src/**` 未作任何修改。** 逐项核对确认 0.2.0 中本插件依赖的全部宿主接口签名未变：Node 侧 `connection.fetch.register`、`loader`、cordis、`ctx.tools`、宿主服务名与事件名，以及浏览器侧 `slots` 与 `locale`。`dsh-client-ui-slots` 在 0.1.7-rc.2 与 0.2.0-rc.1 之间逐字节相同，`CLIENT_EXTERNALS` 的九个条目与 0.2.0 真实平台种子集合完全相等。`src/**` 在本次对齐之后另有变更（路由迁移到官方鉴权闸门），见 [HTTP 接口契约与官方鉴权闸门](../bug-fix/2026-10-01-http-contract-and-auth-fence.md)。

依赖升级对构建产物零影响：`pnpm install && pnpm run build` 产出的 `lib/index.js`（92,839 字节）与 `lib/client.js`（294,457 字节）与升级前逐字节相同，`lib/types/**` 无差异。

变更只落在声明层面：

- `devDependencies["@deepseek-ai/dsh-client-ui-primitives"]` 从 `0.1.7-rc.2` 升到 `0.2.0-rc.1`。
- 删除 `engines.dsh`（宿主已不读取），改为 `peerDependencies: { "@deepseek-ai/dsh": ">=0.2.0-rc.1" }`，让硬门槛真正生效；并加 `peerDependenciesMeta["@deepseek-ai/dsh"].optional: true`。
- `pnpm-workspace.yaml` 增补 `autoInstallPeers: false`，并把 `minimumReleaseAgeExclude` 指向 `@deepseek-ai/dsh-client-ui-primitives@0.2.0-rc.1`。

**peer 声明的安装副作用必须显式抑制。** 未设 `autoInstallPeers: false` 时，pnpm 会为满足新声明的 peer 把整棵 `@deepseek-ai/dsh` 装进 `node_modules`，`pnpm-lock.yaml` 从 1,093 行膨胀到 9,145 行；开启后回到 1,093 行。对照实验表明起决定作用的是 `autoInstallPeers: false`，仅设 `peerDependenciesMeta.optional` 不足以阻止安装。宿主 profile 模板本就固定写入该行（`dsh-app-boot/lib/index.js:563`），本仓库的补充是为独立安装场景对齐同一行为。

区间取 `>=0.2.0-rc.1`，与既有 `engines.dsh` 写法同构，且能接纳后续 0.3.x。

**真实平台种子的唯一来源**是运行中的 shell `@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js`（其 `QS()` 函数），不是 `@deepseek-ai/dsh-client-web` 包。

## Alternatives considered

- **保留 `engines.dsh` 并额外加 `peerDependencies`**：否决。0.2.0 无任何代码读取 `engines.dsh`，并列保留会让读者误以为两道闸门都有效，应直接删除。
- **区间用 `^0.2.0-rc.1`**：否决。实测在 `includePrerelease` 下该区间排除 0.3.x，会让插件在下一个次要版本列车被无谓拒绝。
- **只声明 `peerDependencies` 而不设 `autoInstallPeers: false`**：否决。对照实验显示本仓库默认配置下加 peer 声明会把整棵 dsh 树装进 `node_modules`（不加则不装），`pnpm-lock.yaml` 从 1,093 行涨到 9,145 行；且仅设 `peerDependenciesMeta.optional` 不足以阻止安装。
- **借本次升级重构 hero chip，改用插槽注册**：否决。hero 行只有三个 `single` 槽，`conversation.hero.agentPreset` 已被 `ui-agent-preset` 以默认优先级占用——同优先级再注册抛异常，换优先级则遮蔽官方预设控件而非并存。DOM 注入是结构性必需，且锚点在 0.2.0 中仍在。重构应单独立项。
- **按 `@deepseek-ai/dsh-client-web` 的 `PLATFORM_MODULES` 调整 `CLIENT_EXTERNALS`**：否决。该包陈旧且非运行时种子，照改会破坏当前可用的 externals。

## Acceptance criteria

- `package.json` 不含 `engines.dsh`，含 `peerDependencies["@deepseek-ai/dsh"]`。
- `pnpm install` 后 `node_modules` 中不出现 `@deepseek-ai/dsh`，`pnpm-lock.yaml` 保持约 1,093 行。
- `pnpm install --frozen-lockfile` 通过，且 `pnpm-lock.yaml` 已提交。
- `pnpm run verify`（`check` + `verify:gates`）全绿。
- `pnpm run build` 产出的 `lib/client.js` 首行为 `window.__ModuleLoader__.load({ id: "@local/dsh-session-settings", ... })`，且与升级前逐字节相同。
- 在运行中的 0.2.0-rc.1 宿主上，`/api/session-settings/get-settings`、`/skills`、`/mcp-servers/list` 均返回 `200` 且带真实数据；`/plugins/??@local/dsh-session-settings/client.js&rev=<当前 artifact rev>` 返回 `200` 且内容为本插件客户端闭包。
- README 双语兼容表与本 Note 的结论一致，`AGENTS.md` 的宿主兼容性不变量改述为 `peerDependencies` 闸门。
- GUI 冒烟（人工）：会话设置 tab、MCP 服务器页、技能页、侧边栏导航图标、hero chip 正常渲染；改子代理模型后下一次请求即生效；禁用某 MCP 工具后被调用即被拒；全程无需重启 `dsh web`。

## Risks

- **陈旧包误导**：`@deepseek-ai/dsh-client-web@0.1.0-rc.6` 与真实 shell 的平台种子不同，未来排查接口变化时若以它为据会得出错误结论。判断平台行的唯一权威是运行中 shell 的构建产物。
- **hero chip 依赖私有 DOM 锚点**：hero 行与 agent-preset 座位的类名带哈希私有前缀（如 `wSkVaW_`、`cubgiG_`），官方未承诺稳定性。0.2.0 中锚点仍存在，但宿主若改动结构，hero chip 会静默失效。
- **`peerDependencies` 的安装副作用**：抑制它的是 `pnpm-workspace.yaml` 的 `autoInstallPeers: false`。若该行被移除，本仓库会重新拉入整棵宿主依赖树；本仓库依赖这一行属于对宿主 profile 行为的镜像，宿主若改变该默认值需同步复核。
- **hero chip 的视觉回归只能靠人工冒烟**：客户端装饰（插槽渲染、hero chip 挂载、侧边栏图标）无自动化覆盖，接口兼容不等于渲染正确，升级后必须人工确认。
- **`engines.node` 保持独立**：Node 版本要求与 DSH 兼容性是两条轴，删除 `engines.dsh` 不影响 `engines.node`。
