# Agent Note: hero chip 的 selector hook 误用

Status: implemented

## Problem

新会话页的"会话设置"按钮整个消失。

根因在 `0c98531`（改用 slot 标准 props 的那次）引入的调用方式。宿主把插槽的标准选择器声明为

```ts
export type SnapshotSelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S
```

并如此合成：

```js
function bindSnapshotSelector(w) {
  return function useSelector(sel, eq) {
    return useSyncExternalStoreWithSelector(subscribe, getSnapshot, void 0, sel, eq)
  }
}
```

`useSyncExternalStoreWithSelector` 在每次渲染时调用 `selector(snapshot)`。chip 却按"给我整个快照"的直觉零参数调用：

```ts
const sessionsState = (useSessions ?? (() => undefined))()
```

于是抛出 `TypeError: selector is not a function`。chip 是无条件渲染按钮的组件，抛错即整棵子树卸载，按钮一起消失。

**这个 bug 能通过类型检查，是因为本仓库自己的镜像类型把参数写成了可选**：

```ts
export type UseSessionsHook = (selector?: (state: SessionsState) => unknown) => unknown
```

宿主契约里没有零参数重载，镜像类型比真实契约松，正好放过了这一处。

## Decision

**调用处传 `identity`。** 新增模块级 `const identity = <T,>(state: T): T => state`，chip 改为 `useSessions?.(identity)`。这既满足契约，也把"我要整个快照"写成显式意图。

**镜像类型收紧为必填泛型。** `UseSessionsHook` / `UseWorkspacesHook` 改为 `<T>(selector: (state: S) => T) => T`，与宿主的 `SnapshotSelectorHook` 同形。参数一旦必填，同样的零参数调用会直接编译失败。

**弹层适配层同步修正。** chip 向 `SessionSettingsViewPage` 传的 `useSessions`/`useWorkspaces` 里原来写着 `selector ? selector(state) : state`，属于同一误用的另一半；改为无条件 `selector(state)`。

## Alternatives considered

- **保留 `?? (() => undefined)` 的兜底并改传 `identity`**：否决。`useSessions` 在 session 作用域座位上必然存在，兜底只会掩盖第二个同类错误。保留 `?.` 是因为组件也可能在座位之外被单独渲染。
- **在 chip 内部用 `useSyncExternalStore` 直接订阅**：这是迁移前的写法，否决。它重实现宿主的"当前会话"规则，正是 `0c98531` 要消除的那份重复。
- **只改调用处，不动镜像类型**：否决。类型比契约松是这个 bug 得以通过的**原因**，只修调用点等于留着同一个陷阱。
- **加一条闸门**：否决。这需要静态识别"对选择器 hook 的零参数调用"，而闸门只能看形状不能看语义；收紧类型已经让它在编译期暴露。

## Consequences

- **镜像类型必须与宿主契约同严格**：可选参数是静默放过调用错误的常见来源，本仓库的 `src/types.ts` 是宿主面的唯一镜像，放松它就是放松全部调用点。
- **`identity` 是重复的**：`settings-controller.ts` 已有 `identitySelector`。两处各自定义是有意的——共享它需要跨文件导入，而十余行的常量不值得为此拉一条依赖边；若出现第三处，再合并。
- **chip 仍未覆盖 GUI 冒烟**：本次修复只经类型检查与机械复现验证，真实浏览器里的可见性需要在重启 `dsh web` 后目视确认。
