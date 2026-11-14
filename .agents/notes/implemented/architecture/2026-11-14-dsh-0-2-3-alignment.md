# Agent Note: DSH 0.2.2-rc.3 对齐

Status: implemented

## Problem

宿主主线到 `0.2.2-rc.3`，`0.2.2-rc.1` 的官方升级文档（19 条）对本仓库**没有一条破坏性变更**：本插件实际消费的宿主面（`connection.fetch`、`storageDomain`、`agents.get`、`agentPresets`、`systemPrompt.context`、`tools.restrict/guard`、`loader.import`、`slots.register`、`locale.register`）在 rc.2/rc.3 全部保留且签名兼容。真正该改的三件事都不在升级文档里：

**软链授权会让整条会话硬失败。** `resolveAllowSet` 用 `statSync` 判目录，它会跟随软链，于是"指向目录的软链"被当作合法根送进 `additionalWritableRoots`。宿主 `additionalRoot()` 对每个额外根比较 `relative(path, realpathSync.native(path))`，不等就抛 `SandboxInvalidRootError`——不是忽略该根，而是该会话每一次受限调用都失败，报错还读起来不像沙箱配置。

**沙箱加宽有官方通道了。** rc.2 给 `ctx.sandboxPolicy` 加了 `registerWritableRoot(session, directory)`（rc.1 完全没有）：按活跃 Session 隔离、返回原始 effect disposer、`resolve()` 把注册与配置根一起快照。本插件 0.2.2 对齐时包装 `resolve()` 并自建 prime 缓存，正是这条 API 要取代的做法。

**MCP 连接状态有权威值了。** rc.2 的 `dsh-mcp-client` 导出 `connectionStatusOf(fiber)`，返回 `connecting/connected/reconnecting/failed{reason}/waiting-credentials/closed`。本插件原先用 `registeredToolCount` + 挂载时间戳推断，永远无法区分"给了 N 次后放弃"与"清理未确认、需重启宿主"。

**版本面落后运行时。** `dsh-client-ui-primitives` 钉在 `0.2.0-rc.1`（peer 是 cordis `~4.0.4`），而 shell 静态模块表实际注入的是 rc.3 构建；`README` 还写着"宿主不读 `engines.dsh`"，与自 `0.2.1-alpha.3` 起的实情相反。

## Decision

**兼容门槛抬到 `>=0.2.2-rc.3`**，并同写 `engines.dsh`（宿主优先读它）与 `peerDependencies`（包管理器只认它）。`dsh-client-ui-primitives` 升到 `0.2.2-rc.3`：实际注入的 seed 就是它，19 个在用图标在 rc.3 全部存在。

**软链在此解决，不交给宿主报错**：`resolveAllowSet` 先 `realpathSync.native()` 再 `statSync`，授予物理路径。这既满足宿主的比较，也保留用户语义（"这个目录，不管它实际在哪"）。

**沙箱改用 `registerWritableRoot()`**，`resolve()` 包装与 prime 缓存整体删除。授予按 `agent/created` 安装（resume 会给出新 Session 对象，宿主按对象键控，所以必须重装）、按 `agent/disposed` 与插件卸载撤销。因为宿主把 disposer 建在**策略服务自己的 context** 上，插件卸载不会自动解注册，故显式跟踪 live Session 并 `releaseAll()`。

**MCP 状态只读 `connectionStatusOf()`**，推断层整体删除：`registeredToolCount`、`mountAttempted`、`mountStartedAt`、`waitForTools()` 轮询与 settle 宽限期全部消失。`McpServerRuntimeStatus` 只剩 `mounted`/`connection`/`cleanup`/`lastError`，面板据此区分"正好在重连"与"清理未确认，remount 无用需重启"。类型按结构复制而非导入，server 半边仍不解析宿主包。

**不留任何兼容分支**：只写当前宿主的最简实现。不判 API 是否存在、不为旧宿主降级、不保留推断或旧码路径；宿主版本不匹配由 `engines.dsh` 直接拒绝加载。`systemPrompt.context`/`getContextOrder`、`loader.import`/`unwrapExports`、`agentPresets.acquireScope`/`serviceFor`、`registerWritableRoot`、`connectionStatusOf` 一律按必需成员声明。

**`tools.restrict()` 先问再删**：rc.2 起对未注册的工具名抛错（rc.1 同样），而 `list_subagent_models` 只在 preset 开启 `modelDiscovery` 时挂载。原实现只判方法存在，未开该选项的 preset 会在 `agent/created` 抛错。现以 `schemas()` 全局层是否含该名为门。

## Alternatives considered

- **只修软链 bug，其余记账**：否决。用户已把宿主更新到 rc.3，`registerWritableRoot` 与 `connectionStatusOf` 都是本次可用的官方通道；继续包装 `resolve()` 是明知有官方实现还自维护一套缓存。
- **保留 `resolve()` 包装作为兜底**：否决。两条路同时存在时"哪条生效"不可验证，且包装一个共享宿主服务的 own property 在卸载/重载下有遗留风险。
- **把 `ModelSelectionPolicy`（宿主 "子代理可挑哪些模型"）写进策略**：否决。与既有决策一致，那是部署轴，不是本插件的按会话强制轴。
- **让 `describedRootsFor` 在 prompt 回调里现算**：否决。`systemPrompt.context` 的 text provider 是同步的，而设置阶梯解析是异步的；改为在安装时把带描述的解析结果存进注册记录。
- **保留推断层作为旧宿主兜底**：否决。宿主总是提供真实连接态，两条来源同时存在时必然分歧；实例在 publish 首帧前没有状态由 `connection` 缺失表达即可，不需要一套影子推断。

## Consequences

- **`0.2.2-rc.1/rc.2` 被拒绝**：`engines.dsh` 单独裁决，rc.3 以下的预发布区间不匹配。`registerWritableRoot` 在 rc.1 上根本不存在，本插件不会退化成"部分可用"。
- **额外根在 resume/fork 后需重装**：注册是运行时的，宿主不持久化，`agent/created` 是重装点。
- **卸载路径更重**：必须显式 `releaseAll()`，否则已卸载插件留下在效的授权。
- **没有兼容分支**：只保留当前宿主的最简实现——不判 API 是否存在、不留推断兜底、不为更旧宿主降级。`engines.dsh` 是唯一门槛，不匹配即拒绝加载。
- **`primitives` 版本随宿主走**：每次宿主升级要重读 shell 的 `getStaticModules()` 与图标清单。
