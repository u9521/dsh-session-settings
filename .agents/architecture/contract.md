# 契约与线格式

Covers: src/types.ts, src/shared/**

跨越 Node 与浏览器两侧的一切形状都从这里出发。改这两个路径中的任何一个，先读完本页。

## 契约单一来源

HTTP 路径只在 `src/types.ts` 的 `API_ENDPOINTS` 定义，方法只在 `API_METHODS` 定义。服务端注册与客户端调用都引用它们，不得出现路径或方法的字面量。请求体形状由同文件的 `SaveSettingsRequest` 等类型表达，**服务端不做形状兼容**：不合契约的请求直接拒绝，而不是猜测意图。

理由见 [HTTP 接口契约与官方鉴权闸门](../../.agents/notes/implemented/bug-fix/2026-10-01-http-contract-and-auth-fence.md)。

## 共享树纯净

跨半共享只有 `src/types.ts`（线格式）与 `src/shared/**`（纯逻辑）。后者不得值导入 `node:*`、宿主包或 React——它要在浏览器闭包里运行。`verify-shared-purity` 强制这一条，类型导入被擦除所以放行。

scope 阶梯与默认值只有一份，住在这里。浏览器与 Node 各自复制一份是明确的缺陷，不是性能优化。

理由见 [共享设置树](../../.agents/notes/implemented/architecture/2026-10-17-shared-settings-tree.md)。

## 对外文档双同步

`README.md` 与 `README.zh.md` 必须在同一次变更内同步修改。只改一边视为未完成——两份文档的读者不同，但事实只有一个。

命令与安装步骤属于 `README`，不抄进本目录；本目录只写约束与理由。
