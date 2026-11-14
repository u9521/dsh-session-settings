# 宿主包与占用面清单

本插件在运行期消费的宿主面。升级时按此表逐项核对：**表里每一项都是"必须仍然存在且语义未变"的契约**，多出来的通常是新增通道（值得采用），少一个就是破坏性变更。

## 直接 import 的宿主包

| 包 | 用途 | 变更风险 |
| :--- | :--- | :--- |
| `@deepseek-ai/cordis` | `Context`、`Fiber`、插件生命周期 | 结构性变更会让两半都编译失败 |
| `@deepseek-ai/dsh-client-ui-primitives` | 图标与基础组件（19 个图标） | **版本必须跟 shell 的实际 seed 走**，见 [构建与发布](../../../architecture/build.md) |

两者都是 devDependencies：产物不依赖它们，运行时由宿主提供。

## 运行期取用的 cordis 服务

| 服务 | 成员 | 用途 |
| :--- | :--- | :--- |
| `connection` | `fetch.register` | 所有 HTTP 路由；带 Host/Origin 与鉴权闸门 |
| `loader` | `import`、`unwrapExports` | 动态装载官方 `dsh-mcp-client` |
| `storageDomain` | 领域打开与 schema 校验 | `$DSH_HOME/storages` 下的持久化 |
| `sandboxPolicy` | `registerWritableRoot`、`overrideOf`、`defaultMode` | 会话额外可写目录 + 当前模式 |
| `systemPrompt` | `context`、`getContextOrder` | 追加运行期上下文条目 |
| `tools` | `schemas`、`restrict`、`guard` | 工具可见性与调用闸门 |
| `skills` | `register`、`snapshot` | 按会话启停技能 |
| `agents` | `get` | 从会话 id 取活 Agent |
| `agentPresets` | `acquireScope`、`serviceFor` | 读预设作用域内的技能注册表 |
| `sessions` | `list`、`get` | 枚举活会话以重装授权 |
| `sessionPersistence` | `stat` | 会话体积与持久化状态 |
| `workspaceRegistry` | 工作区解析 | 设置阶梯的 workspace 层 |
| `locale` | `register`、`bind` | 中英文文案 |
| `slots` | `register` | 浏览器侧插槽 |
| `remote` | `session` | 客户端远程调用 |

## 监听的事件

`agent/created`（装授权）、`agent/disposed`（撤授权）、`tools/change`（重算 MCP 投影）。

## 独立发布的宿主包

`@deepseek-ai/dsh-mcp-client` 不经 import，而是 `ctx.loader.import()` 按名装载。它导出的 `connectionStatusOf(fiber)` 是本插件唯一的连接态来源，升级时必须确认它仍导出且返回形状未变。

## 怎么核对新增/变化

升级文档只讲**破坏**，从不讲**新增**。要发现新增通道，需比对两侧的类型声明：

```sh
# 1. 取当前已安装版本，作为对照基线
npm pack @deepseek-ai/dsh-mcp-client@<old> @deepseek-ai/dsh-sandbox@<old> --pack-destination /tmp/old

# 2. 解包后 diff 类型声明
diff <(tar -xzOf /tmp/old/*.tgz package/lib/types/index.d.ts) \
     "$DSH_INSTALL_DIR/node_modules/@deepseek-ai/dsh-sandbox/lib/types/index.d.ts"
```

只在本插件已经能用、但"应该有更直接做法"时才做这一步；纯破坏性变更读升级文档即可。
