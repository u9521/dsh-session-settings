# Agent Note: MCP 导入导出改用 .mcp.json 格式

Status: implemented

## Problem

导入导出两端各自构造 JSON，格式契约没有单一来源，于是它自己的输出读不回来：

- **导出不写 `type`**，只写 `command/args/cwd/env` 或 `url/headers`。导入侧只在"无 type 但有 url"时推断 HTTP，stdio 条目既无 type 又无 url，被 `normalizeServer` 拒绝后 `continue` 吞掉——**往返丢失全部 stdio 服务器**，界面仍提示导入成功。
- **导出不写 `name`**，导入把 name 回落为 id，`GitHub Tools` 回来变成 `github`。
- **逐条失败完全静默**：`importServers` 对单条错误 `continue`，整批返回 `ok: true` + 写入次数，前端据此关弹窗。用户没有任何办法知道丢了什么。
- **`count` 是写入次数不是服务器数**：两个键解析到同一 id 时报 2 实存 1。
- **非法 id 被静默清洗**：`测试` → `_____`，与同文件注释和 [注册表 Note](../architecture/2026-10-17-mcp-server-registry.md) 声称的"跳过而非改写"相反。
- 其余：非 `mcpServers` 形状静默 `count:0` 成功；空对象仍写盘；`__proto__` 键写进 store 原型（计数 +1、列表不可见、不落盘）；400 时路由用 `message`、通用 badRequest 用 `error`，前端只读其一。

## Decision

**格式取 Claude Code 的 `.mcp.json`**：`{ "mcpServers": { <name>: <entry> } }`，条目以 `type` 判别（`stdio|sse|http|ws`）。

选它而不是 `settings.json`：schema 所指的 `settings.json` 根本不定义服务器（只有 `enabledMcpjsonServers`/`allowedMcpServers` 这类批准名单），服务器定义在独立的 `.mcp.json`，那份文件的顶层就是这个映射。

- **单一构造器**：新增 `src/shared/mcpDocument.ts`，`toDocument`/`toDocumentEntry` 由浏览器侧导出使用，Node 侧 `parseDocument`/`entryToConfig`/`transportOf` 使用同一套类型常量。导出与会话里不再各写一份。
- **`type` 是判别字段**：导出按 `detectedTransport` 精确写 `sse`/`http`；导入把两者都收敛回内部唯一的 `streamable-http`，`ws` 明确拒绝（宿主无该客户端）而不是降级成别的东西。
- **无 type 时按形状推断**（有 command → stdio，有 url → http）。这不是兼容旧格式，是格式自身的规则——拒绝它等于读不了别人手写的合法 `.mcp.json`。
- **本插件独有字段作为额外键同行**：`id`、`name`、`description`、`cwd`、`toolCallTimeoutMs`、`failOnStartupError`、`maxInstructionBytes`、`reconnect`、`disabledTools`、`createdAt/updatedAt`。格式未禁止 additional properties，Claude Code 忽略它们，我们靠它们做无损往返。
- **`id` 单独存**：格式用键当名字，而我们的 id 可与 name 不同（也可改名），只靠键会丢。
- **发现缓存不导出**：那是"某次连接观察到的事实"，不是配置；恢复一份旧缓存等于描述一台本进程从未连过的服务器。
- **不写 `$schema`、不写版本号**（用户决定）：文件就是纯 `.mcp.json`，能被 Claude Code 直接使用。
- **逐条记账**：导入返回 `{ count, skipped: [{key, reason}], overwritten }`，`count` 是去重后的实际写入数；有 skip 时弹窗不关闭并列出每条原因。非法 id 直接拒绝并报原因，不再清洗。
- **`__proto__`/`constructor`/`prototype` 拒绝**；没有任何写入时跳过 persist。
- **UI**：导出文件名 `mcp.json`，导出后提示"env/headers 为明文"；导入弹窗增加文件选择，textarea 保留为粘贴通道。

## Alternatives considered

- **导出完整 settings.json**：MCP 服务器不在其中，只有批准名单；12 台服务器里 8 台是远程，塞进去只能携带名字，不携带连接信息。
- **把 DSH 字段放进 `x-dsh` 扩展段**：文件交给 Claude Code 时这些字段会看起来"存在但无效"，比同行额外键更隐蔽。
- **内部模型扩成四值 transport**：`sse`/`http` 在客户端侧是同一传输的不同协商结果，已有 `detectedTransport` 承载，扩模型会波及挂载与策略投影。
- **主动拒绝旧导出文件**：旧文件的形状恰好是合法 `.mcp.json` 子集，拒绝它等于拒绝手写文件；"不再兼容"落在"不保证往返无损"，而非"故意读不了"。
- **保留清洗非法 id**：清洗后无法向用户解释 `_____` 是哪台服务器，宁可拒绝。

## Consequences

- **同名服务器**：导出的映射键在重名时回落为 id（映射不能有重复键），条目的 `name` 字段仍保留原名，导入后名字不丢。
- **`count` 语义变了**：现在等于去重后的服务器数，重复键不再虚增。
- **旧文件可导入但仍有损**：旧导出没有 `name` 与连接参数以外的字段，往返后 name 回落为 id——这是旧文件本身缺信息，不是新导入的缺陷。
- **无法导出的东西**：发现缓存、运行时状态、`disabledTools` 之外的会话级启停（那是 `session_settings`，不属本格式）。
- **`ws` 条目会出现在 skipped 里**：这是有意的可见失败。
