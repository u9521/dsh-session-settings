# AGENTS.md

本文件是本仓库的 agent 入口规范：**先读这里，再读代码**。事实的单一归属地见下表，本文件只写"如何工作"，不复述架构细节。

| 事实 | 归属 |
| :--- | :--- |
| 用户可见能力、安装与升级步骤 | [README.md](README.md) 与 [README.zh.md](README.zh.md) |
| 架构、构建、决策理由 | [.agents/notes/](.agents/notes/README.md) |
| 决策记录写法与生命周期 | [.agents/notes/README.md](.agents/notes/README.md) |
| 校验闸门实现 | [scripts/gates/](scripts/gates) |

## 项目定位

`@local/dsh-session-settings` 是 DeepSeek Harness（DSH）Web GUI 的会话设置插件，提供四项能力：按会话配置子代理模型与推理强度、集中管理 MCP 服务器、按会话启停 MCP 工具、按会话启停技能。插件以双半结构发布——Node 侧是 cordis 插件（`session-settings`），浏览器侧是 client-plugin 闭包，两半共享 `src/types.ts` 作为唯一契约。设计理由见 [双半插件架构](.agents/notes/implemented/architecture/2026-09-26-two-half-plugin-architecture.md)。

## 目录导航

| 路径 | 内容 |
| :--- | :--- |
| `src/types.ts` | 跨半共享的契约：`API_ENDPOINTS`、store schema、模式枚举 |
| `src/server/` | cordis 插件：`mcp/`、`session/`、`skills/`、`subagent-model/` 四个领域；`mcp/`、`session/`、`skills/` 含 `routes.ts`，`mcp/`、`skills/`、`subagent-model/` 含 `interceptor.ts`，`mcp/` 与 `skills/` 另有 `policy-projection.ts` 承担按 scope 的强制 |
| `src/client/` | client-plugin：插槽注册、hero chip、样式、双语文案 |
| `scripts/build.mjs`、`tsdown.config.mjs` | 构建入口与两段产物配置 |
| `scripts/gates/` | 零依赖校验闸门 |
| `.agents/notes/` | 决策记录；`implemented/` 是事实基线 |

## 命令矩阵

| 目的 | 命令 |
| :--- | :--- |
| 安装依赖 | `pnpm install` |
| 构建（`tsc` + `tsdown`） | `pnpm run build` |
| 类型检查 | `pnpm run check` |
| 格式检查 / 修复 | `pnpm run fmt:check` / `pnpm run fmt` |
| 规范闸门 | `pnpm run verify:gates` |
| 提交前聚合校验 | `pnpm run verify` |

本仓库**没有自动化测试框架**：回归 = 类型检查 + 构建 + 闸门 + GUI 冒烟。补测计划见 [回归验证策略](.agents/notes/proposed/testing/2026-09-26-regression-strategy.md)，冒烟清单见 [pre-push-checks](.agents/skills/pre-push-checks/SKILL.md)。

## 不变量

- **客户端纯净**：`src/client/**` 不得值导入非平台的 `@deepseek-ai/*` 模块；`tsdown.config.mjs` 的 purity gate 会在构建期终止构建。跨插件协作走 cordis 服务。
- **契约单一来源**：HTTP 路径只在 `src/types.ts` 的 `API_ENDPOINTS` 定义，方法只在 `API_METHODS` 定义（键集由类型强制与路径对齐），服务端注册与客户端调用都引用它们，不得写字面量。请求体形状由同文件的 `SaveSettingsRequest` 等类型表达，**服务端不做形状兼容**。
- **路由只挂官方鉴权闸门**：`src/server/**` 的 HTTP 路由一律经 `ctx.connection.fetch.register` 注册，不得直接用 `webServer.register`——后者注册的 exact 路由会命中 `webServer.match()` 的 exact 表而绕过官方 `/api` 的 Host/Origin fence 与浏览器鉴权。理由见 [HTTP 接口契约与官方鉴权闸门](.agents/notes/implemented/bug-fix/2026-10-01-http-contract-and-auth-fence.md)。
- **持久化位置**：配置只落 `$DSH_HOME/storages/` 下的 `session_settings.json` 与 `mcp_servers.json`，惰性加载、目录延迟创建。
- **双语文档同步**：`README.md` 与 `README.zh.md` 必须同一次变更内同步修改。
- **宿主兼容性硬门槛**：`peerDependencies["@deepseek-ai/dsh"]` 声明 `>= 0.2.0-rc.1`（DSH 0.2.0 起宿主不再读取 `engines.dsh`），保留零向后兼容垫片；不兼容时由宿主拒绝加载。理由见 [DSH 0.2.0 兼容性对齐](.agents/notes/implemented/architecture/2026-09-29-dsh-0-2-0-compatibility.md)。
- **DOM 装饰是补充而非替换**：能通过 `slots` 注册的一律走插槽，仅 shell 未开放插槽处才做 DOM 操作，并随 `ctx.effect` 清理。
- **子代理"自选路由"按差异判别**：`agent.options` 对每个子代理都含直接父代理的路由（宿主 `resolveChildAgentOptions` 无条件合并），不能当作自选信号；只能是"子代理有效路由 ≠ 直接父代理路由"。理由见 [子代理「自选路由」的判别基准](.agents/notes/implemented/bug-fix/2026-10-01-subagent-explicit-route-detection.md)。
- **挂载状态是瞬态观测**：`mountAttempted` / `registeredToolCount` 描述的是此刻，不是结论。任何由它派生的呈现必须带时间维度（`mountStartedAt`）或自清机制，且零工具的健康服务器不得被判为故障。挂载判定与可见性判定必须同源；配置未变时不得重挂载；策略缓存必须与解析出的 `workspaceId` 同存。理由见 [挂载判定、策略解析与状态呈现的一致化](.agents/notes/implemented/bug-fix/2026-10-01-mcp-mount-state-consistency.md)。
- **发现面是只读投影**：资源的列举与读取永不改变模型可见面；发现类数据可缓存，内容类不可持久化；能力位与空列表必须区分（SDK 对未声明能力返回空列表而非错误）。理由见 [MCP 资源与提示词面板](.agents/notes/implemented/feature/2026-10-02-mcp-resources-and-prompts-panel.md)。

## 安全边界

- 默认可直接修改：`AGENTS.md`、`.agents/**`、`docs/**`、`scripts/gates/**`。
- 修改 `src/**`、`package.json`、`tsdown.config.mjs`、`pnpm-workspace.yaml`、`.github/**` 前必须获得用户显式授权，并说明文件、diff 与理由。
- 不要提交 `lib/`（已在 `.gitignore`）；不要手工改 `dist` 分支。
- 依赖变更后必须提交 `pnpm-lock.yaml`，否则 CI 的 `--frozen-lockfile` 会失败。

## 变更工作流

1. 非平凡改动先写 Note：在 `.agents/notes/proposed/<kind>/` 落一篇，`Status: proposed`，格式见 [治理契约](.agents/notes/README.md)。
2. 实现完成后把 Note `git mv` 到 `implemented/`，改写为最终形态并更新 `Status:`。
3. 运行 `pnpm run verify`，全绿之后再提交。
4. 一次提交只做一件事；架构变更与格式化变更不要混在同一 diff 里。

## 文档预算

预算由 `scripts/gates/verify-doc-budgets.mjs` 强制（排除代码块与链接地址后的 counting units）：

| 文件 | 上限 |
| :--- | :--- |
| `AGENTS.md` | 1500 |
| `.agents/notes/README.md` | 900 |
| `.agents/notes/AGENTS.md` | 500 |
| `.agents/notes/implemented/AGENTS.md` | 400 |
| 单篇 Agent Note | 1500 |
| 单个项目技能 `SKILL.md` | 800 |

超预算时的正确做法是把理由拆分进 Note，而不是删掉不变量。一处事实一处归属：同一结论只写一次，其它位置用相对链接指过去。
