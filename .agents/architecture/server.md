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

`peerDependencies["@deepseek-ai/dsh"]` 声明最低宿主版本（宿主不读 `engines.dsh`）。不写兼容垫片：不兼容时由宿主拒绝加载，而不是运行中途抛错。

升级宿主时先改这一个字段，再跑构建与 GUI 冒烟。理由见 [DSH 0.2.2 对齐](../../.agents/notes/implemented/architecture/2026-11-05-dsh-0-2-2-alignment.md)。

## 状态是观测，不是结论

`mountAttempted`、`registeredToolCount` 描述此刻而非结论：派生呈现须带时间维度或自清，零工具的健康服务器不得判为故障，挂载与可见性同源。

理由见 [挂载判定与状态呈现的一致化](../../.agents/notes/implemented/bug-fix/2026-10-01-mcp-mount-state-consistency.md)。

## 子代理自选路由按差异判别

`agent.options` 对每个子代理都含直接父代理的路由（宿主无条件合并），不能当作"自选"信号，判据只能是有效路由 ≠ 直接父代理路由。强制路由只经 `agent.model.select()` 记录——`agent/request` 已废弃，步进准备后提出不同路由会被判错。

## 沙箱加宽走策略，不改 argv

额外可写目录只经 `SandboxPolicy.additionalWritableRoots` 传给 `ctx.sandboxPolicy.resolve()` 的返回值；不得改 `confine()` 产出的 argv（后端语法各异，runner 的参数表边界不属于本插件）。同一通道覆盖 bash、终端与文件系统 fence。

理由见 [DSH 0.2.2 对齐](../../.agents/notes/implemented/architecture/2026-11-05-dsh-0-2-2-alignment.md)。

## 发现面只读

资源的列举与读取永不改变模型可见面；发现类可缓存，内容类不可持久化。能力位与空列表须区分——SDK 对未声明能力返回空列表而非错误。

理由见 [MCP 资源与提示词面板](../../.agents/notes/implemented/feature/2026-10-02-mcp-resources-and-prompts-panel.md)。
