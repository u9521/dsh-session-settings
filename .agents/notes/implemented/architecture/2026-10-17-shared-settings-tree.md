# Agent Note: 共享设置树

Status: implemented

## Problem

同一条 `session → workspace → global` 解析阶梯在两个半里各写了四份，共八份：服务端 `session/storage.ts` 与客户端 `utils/config.ts` 各四个，都是同一个 `resolved` 标志状态机，只在"从哪取三层"和"返回值多带哪些派生字段"上不同。`storage.ts` 的注释写着"deliberately identical"，客户端 sandbox 那份则承认是"duplicated rather than shared"。

默认值另有三套字面量：服务端的两个常量、`session/routes.ts` 的重置字面量、客户端 `useSessionActions` 与 `useSessionData` 的初始态。新增一个配置域要同时改阶梯八处、默认值三处，漏改不会报错，只会让面板显示与运行时强制不一致。

"来源页签显示哪一层"的判定也被四个面板各抄了一遍，同一处逻辑有四个副本。

## Decision

`src/shared/settings.ts` 是**唯一允许跨半共享的逻辑树**，且必须纯净：不 import `node:*`、宿主包或 React（`.agents/gates/verify-shared-purity.mjs` 在闸门里强制，只放行相对路径与 `import type`）。

它拥有：

- `SettingsLayers`：`{ session?, workspace?, global? }`，三层配置本身，与"从哪读"无关。
- `DEFAULT_GLOBAL_SETTINGS` / `DEFAULT_SESSION_SETTINGS`：默认值的唯一定义。
- `isSessionCustomized`、`sourceModeFor`、`isSourceReadonly`：来源判定。
- 四个解析函数，签名统一为 `(layers: SettingsLayers) => 该域的有效值`。

两半各留一个薄 adapter：

- 服务端 `layersFor(store, sessionId?, workspaceId?)` 把 store 投影成三层。`effectiveDisabledTools` 是"对 MCP 服务器列表的投影"而非 scope 决策，因此留在服务端由 `resolveEffectiveMcp` 自行计算。
- 客户端 `utils/config.ts` 保留原来的三参数签名，内部拼 `SettingsLayers` 后调用共享实现——所有调用点不变。

四个面板的来源页签改用 `sourceModeFor` / `isSourceReadonly`；服务端重置与客户端重置改用 `structuredClone(DEFAULT_GLOBAL_SETTINGS)`。

**落地约束：**

- `src/shared/settings.ts` 不 import `node:*`、`@deepseek-ai/*`、`react`；`verify-shared-purity` 通过，且故意加一行 `import fs from 'node:fs'` 会让它失败（已实测）。
- 两半不再各自实现阶梯；默认值只在共享模块定义一次。
- 四个面板与两个重置路径都引用共享实现。
- `pnpm run verify` 全绿；`lib/client.js` 仍以 `window.__ModuleLoader__.load` 开头。
- GUI 冒烟：四个面板的来源页签在三层下显示正确，保存与重置行为不变。

## Alternatives considered

- **只抽服务端四份**：否决。客户端四份才是漂移来源（面板显示要与强制一致），只抽一半等于保留两处事实。
- **让共享模块直接接收 `SessionSettingsStore`**：否决。那会把服务端存储形状变成跨半契约，客户端得伪造一个 store；分层输入才是两半都天然持有的东西。
- **把 `effectiveDisabledTools` 也放进共享**：否决。它要遍历 MCP 服务器列表，属于服务端投影。
- **一步到位把 `src/types.ts` 拆成线格式与宿主视图**：本轮不做。机械重命名，风险低但噪音大，单独一轮更清楚。

## Consequences

- **共享模块被塞进非纯代码**：靠 `verify-shared-purity` 兜底，但它只认 import 语句，不认全局对象（如 `process`）；后续若出现这类用法需扩规则。
- **adapter 漂移**：两个 adapter 都只拼三层，逻辑量极小；真正的阶梯只有一份。
- **公开导出面变化**：`src/server/index.ts` 的 `export *` 会带出共享函数，与旧的四个同名函数签名不同；仓库内调用点已全部更新。
