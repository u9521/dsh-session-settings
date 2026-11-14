# 服务端与宿主生命周期

Covers: src/server/**, cordis.patch.yml

Node 侧是 ordinary cordis 插件，按 `mcp/`、`session/`、`skills/`、`subagent-model/` 四域切分。

## 路由只挂官方鉴权闸门

`src/server/**` 的 HTTP 路由一律经 `ctx.connection.fetch.register` 注册，不得用 `webServer.register`：后者命中 `webServer.match()` 的 exact 表，绕过官方 `/api` 的 Host/Origin fence 与浏览器鉴权。

理由见 [HTTP 接口契约与官方鉴权闸门](../../.agents/notes/implemented/bug-fix/2026-10-01-http-contract-and-auth-fence.md)。

## 持久化走宿主 domain

配置落在 `$DSH_HOME/storages/` 的 storage domain 上，校验、版本、单写链由宿主提供（`defineDomain` 在模块加载期校验声明）。插件不做文件 IO，不写兼容读取——读到旧形状就报错。

理由见 [迁到 storage domain](../../.agents/notes/implemented/architecture/2026-10-17-storage-domain-migration.md)。

## 宿主兼容是硬门槛

`engines.dsh` 与 `peerDependencies["@deepseek-ai/dsh"]` 同写一个区间：宿主优先读 `engines.dsh`，包管理器只认 peer。不写兼容垫片——不兼容时由宿主拒绝加载。升级宿主先改这两处，再跑构建与冒烟。

理由见 [DSH 0.2.3 对齐](../../.agents/notes/implemented/architecture/2026-11-14-dsh-0-2-3-alignment.md)。

## 状态是观测，不是结论

连接态只读宿主的 `connectionStatusOf()`：本插件不再从工具计数或挂载时间戳推断，两个来源必然分歧。状态是此刻的观测而非结论，`connecting`/`reconnecting` 不算故障；只有 `failed`、`waiting-credentials`、`closed` 与激活失败才呈现为不可用。

理由见 [挂载判定与状态呈现的一致化](../../.agents/notes/implemented/bug-fix/2026-10-01-mcp-mount-state-consistency.md)。

## 子代理自选路由按差异判别

`agent.options` 对每个子代理都含父代理路由（宿主无条件合并），不能当作"自选"信号，判据只能是有效路由 ≠ 父代理路由。强制路由只经 `agent.model.select()` 记录。

## 沙箱加宽走注册，不包装 resolve

额外可写目录按 Session 经 `ctx.sandboxPolicy.registerWritableRoot()` 注册，随 `agent/created` 装、随 `agent/disposed` 与卸载撤。`resolve()` 由宿主折入注册，插件不得包装它，也不得改 `confine()` 的 argv。注册以 Session 对象为键，子代理与无会话调用不继承根会话授权；授予必须是物理路径。

理由见 [DSH 0.2.3 对齐](../../.agents/notes/implemented/architecture/2026-11-14-dsh-0-2-3-alignment.md)。

## 发现面只读

资源列举与读取永不改变模型可见面；发现类可缓存，内容类不可持久化。能力位与空列表须区分。

理由见 [MCP 资源与提示词面板](../../.agents/notes/implemented/feature/2026-10-02-mcp-resources-and-prompts-panel.md)。
