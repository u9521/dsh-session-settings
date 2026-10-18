# Agent Note: 两份配置迁到 storage domain

Status: implemented

## Problem

`session_settings.json` 与 `mcp_servers.json` 由本插件自己读写：`common/paths.ts` 拼路径并延迟 `mkdir`，两个 `storage.ts` 各自 `JSON.parse` / `writeFileSync(tmp) + rename`。

三个问题：没有 schema 校验（文件被外部改坏时错误在几十行之后才以 `Cannot read property` 出现）、没有版本（格式变化只能"尽量认"）、与宿主不一致（宿主已挂 `storage` hub + `storage-json`（根目录 `$DSH_HOME/storages`）+ `storage-domain`，提供校验、变更事件与单写链）。

## Decision

`src/server/storage/domains.ts` 声明两个 domain：

| domain | 布局 | 表 | global |
| :--- | :--- | :--- | :--- |
| `session_settings` | single | `sessions`、`workspaces` | 部署级配置 |
| `mcp_servers` | single | `servers` | — |

关键决定：

- **记录 schema 用 zod `looseObject`**：校验已知字段类型，保留未知字段。严格模式会在每次读时丢掉归一化不认识的键。
- **store 对象身份稳定**：manager、registry、各投影都持有引用，因此写盘只更新内存对象的内容，绝不替换对象本身。
- **按差异落盘**：`single` 布局每次 `put` 重写整个文档，所以 flush 先与上次快照比对，只写变化的记录；一次保存不能变成十几次文件重写。
- **打开时机**：`apply` 里通过 `ctx.inject(['storageDomain'], …)` 异步打开，`ctx.effect` 关闭。组合行顺序不携带加载语义，同步 `ctx.get` 会在宿主挂载前读到 `undefined`。
- **缺失即失败**：`ctx.storageDomain` 不存在时直接抛错，让插件不加载。这是旧文件读取器从未有过的响亮失败。
- 删除 `common/paths.ts` 与 `mcp/storage.ts`；`src/server/**` 不再有配置持久化的 `writeFileSync` / `renameSync` / `mkdirSync`。

**不写兼容读取**：不探测旧文件、不双写、不留迁移分支。迁移由 `scripts/migrate-storages.mjs` 一次性完成（不在运行时加载）：

```sh
# 停 dsh web，备份原文件，然后：
node scripts/migrate-storages.mjs --dry-run   # 先看
node scripts/migrate-storages.mjs             # 再写
```

脚本把 `sessions` / `workspaces` / `servers` 分别放进对应 domain 的 `tables`，把 `globalConfig` 放进 `session_settings` 的 `global` 槽；同时把旧条目里的 `streamable-http-or-sse` / `sse` 归一为 `streamable-http`，因为新 schema 只接受两个规范值。

**落地约束：**

- `src/server/**` 不再出现配置持久化的 `writeFileSync`/`renameSync`/`mkdirSync`（已 grep 确认为零）；`common/paths.ts` 与 `mcp/storage.ts` 删除。
- 两个 domain 在 `apply` 中打开、在 `ctx.effect` 中关闭；`ctx.storageDomain` 缺失时插件加载失败。
- 记录 schema 为 `looseObject`：已用真实数据验证——36 条会话记录全部被接受，10 条 MCP 记录在归一化 transport 后全部被接受，且未知字段在往返后仍在。
- `pnpm run verify` 全绿；迁移后 GUI 冒烟中 MCP 列表、会话设置、工作区默认值、重置行为与迁移前一致。

## Alternatives considered

- **保留自写 IO 只加校验**：否决。宿主的 domain 层已同时提供校验、版本戳、单写链与变更事件，再实现一遍是维护第二套语义。
- **记录 schema 用严格 `z.object`**：否决。会丢掉未知字段。
- **在插件里写一次性迁移**：否决。用户明确要求手工迁移；把"读旧格式"留在仓库里等于永久兼容负担。
- **每次写全量落盘**：否决。`single` 布局全量重写，一次保存会变成十几次文件写入。

## Consequences

- **数据形态变化**：文件从自定义形状变成 `{unit, global, tables}`。迁移脚本覆盖原文件，必须先备份；出错会丢配置。
- **domain 打开失败 = 插件加载失败**：这是意图（fail loud），但一次手滑的编辑会让插件不加载，而不是悄悄丢数据。
- **迁移脚本未在真实宿主上跑过**：我只做了 `--dry-run` 与 schema 层面的探针；真正写盘后需要启动宿主确认。
- **`domain/changed` 不触发策略重算**：宿主的变更事件只说明磁盘状态变了；运行时失效仍只由 `PolicyBus` 承担，两者不合并。
