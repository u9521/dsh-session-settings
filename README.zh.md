# dsh-session-settings

[English](README.md) | 中文

**DeepSeek Harness (DSH) Web GUI 会话设置、MCP 服务器与 Skill（技能）管理插件。**

支持在 Web 界面中为各个会话独立或全局统一配置：
1. **子代理模型与思考等级**：包含 `subagent`、`subagent_fork`、`workflow` 等调用的底层模型（Provider / Model）与推理思考等级（Reasoning Effort）。
2. **MCP 服务器集中管理**：在设置左侧栏独立管理 Model Context Protocol (MCP) 服务器，支持 2 阶段兼容性探测、自动协议降级接入、工具列表查看与入参检查，以及资源与提示词的只读浏览。
3. **会话级 MCP 工具细粒度控制**：为特定会话按需启用/禁用 MCP 服务及单独禁用指定工具，或选择跟随全局默认。
4. **会话级 Skill（技能）启停与管控**：支持为各个会话单独启用/禁用内置、用户及项目 Skill，自动过滤提示词 `<available_skills>` 目录与快捷指令，严格阻断已禁用技能的执行。

---

## 目录

- [功能特性](#功能特性)
- [主线兼容说明](#主线兼容说明)
- [插件安装](#插件安装)
  - [🚀 一行命令安装（推荐）](#-一行命令安装推荐)
  - [从源码安装教程（开发者）](#从源码安装教程开发者)
- [插件更新与升级](#插件更新与升级)
  - [方式 1：在线安装更新（推荐）](#方式-1在线安装更新推荐)
  - [方式 2：本地源码升级（开发者）](#方式-2本地源码升级开发者)
- [插件卸载](#插件卸载)
- [常用开发与维护命令](#常用开发与维护命令)
- [常见问题 (FAQ)](#常见问题-faq)
- [开源协议](#开源协议)

---

## 功能特性

- **设置侧边栏独立入口**：位于 Web 界面「设置」左侧导航栏一级菜单（专属图标），一键直达 MCP 服务器集中管理。
- **会话独立 Tab 标签页**：位于会话详情页右侧顶部（轨迹旁），方便针对当前会话进行模型、MCP 与技能隔离配置。
- **开关式子代理控制**：三个显式开关——允许 Agent 选择子代理模型、替换 subagent fork 的模型、指定子代理模型与思考等级。
- **即时动态生效**：配置保存后对下一次子代理调用、MCP 工具执行及技能调用立即生效，无需重启服务或刷新页面。
- **三个作用域显式区分**：会话、工作区、全局是页面上显式选择的写入目标，不再依据请求恰好带了哪些字段来推断。
- **新会话页直接写入活会话**：在新会话页选定工作区即已连上该工作区的空白会话，弹窗把会话级配置直接写入该会话，下一次请求即生效。没有会话的页面没有可写入的会话作用域，该页签会禁用并说明原因。
- **接口契约单一来源**：路径、HTTP 方法与请求体形状各自只在 `src/types.ts` 声明一次；前端按此发送，服务端按此校验，不保留服务端兼容分支。
- **接口经官方鉴权**：所有路由注册在官方 connection 载体上，请求先经 Host/Origin 信任栅栏与浏览器鉴权，才会进入处理器。
- **资源与提示词只读浏览**：MCP 服务器弹窗内提供「资源 / 提示词」页签。资源按 资源 / 模板 分组，模板可填参后由服务端展开读取；提示词按 role 分块展示并支持复制全文与 Raw JSON。列表缓存优先、内容不落盘，读取仅在点击时发生，且只读视图不影响模型可见的工具与资源（模型侧仍由会话策略决定）。

---

## 主线兼容说明

| 插件分支 | 兼容的 DeepSeek Harness (DSH) 主线版本 | 架构与机制支持 |
| :--- | :--- | :--- |
| **`main` 分支** | **`>= 0.2.0-rc.1`** | 原生对齐 **Session Format V4**、**Cordis 4.0.4**、`subagent/descriptor` v3 契约、`AgentPresetRegistry` 作用域 API，以及 0.2.0 版 `ui-primitives` 图标集。 |

> **⚠️ 注意**：本插件的 `main` 分支仅针对 DSH 0.2.0-rc.1 及以上主线版本原生对齐，**不保留任何向下兼容垫片**，不支持更早的 DSH 版本线。自 DSH 0.2.0 起宿主不再读取 `engines.dsh`，兼容性改由 `peerDependencies` 中的 `@deepseek-ai/dsh` 区间强制，因此不兼容的宿主会直接拒绝加载本插件，而不是加载出半可用状态。

---

## 插件安装

### 🚀 一行命令安装（推荐）

本仓库已配置 GitHub Actions 自动构建最小发布分支（`dist` 分支包含完整编译产物与元数据，无多余源码与依赖）。

直接运行以下命令即可一行安装，无需本地编译：

```sh
dsh plugin --profile web add github:u9521/dsh-session-settings#dist
```

> **提示**：安装完成后，启动或重启 Web 服务即可生效：
> ```sh
> dsh web
> ```

---

### 从源码安装教程（开发者）

#### 第 1 步：获取源码

将插件代码克隆到本地：

```sh
mkdir -p ~/.dsh/plugins
cd ~/.dsh/plugins

git clone https://github.com/u9521/dsh-session-settings.git
cd dsh-session-settings
```

#### 第 2 步：安装依赖与构建

```sh
pnpm install
pnpm run build
```

#### 第 3 步：安装到 DSH Web Profile

```sh
dsh plugin --profile web add .
```

##### 验证安装状态
列出 Web Profile 中的已安装插件，确认包含 `@local/dsh-session-settings`：

```sh
dsh plugin --profile web list
```

#### 第 4 步：启动并验证

```sh
dsh web
```

---

## 插件更新与升级

### 方式 1：在线安装更新（推荐）

若通过 GitHub dist 分支一行命令安装，可直接使用 `dsh plugin --profile web update` 更新至最新发布：

```sh
dsh plugin --profile web update github:u9521/dsh-session-settings#dist
```

> **提示**：更新完成后，启动或重启 Web 服务即可生效：
> ```sh
> dsh web
> ```

---

### 方式 2：本地源码升级（开发者）

若从本地源码克隆安装，请拉取 `main` 分支最新提交并重新构建：

```sh
# 第 1 步：进入插件源码目录
cd ~/.dsh/plugins/dsh-session-settings

# 第 2 步：拉取 main 分支最新代码
git pull origin main

# 第 3 步：更新依赖并重新编译生成产物
pnpm install
pnpm run build

# 第 4 步：重启 Web 服务生效
dsh web
```

---

## 插件卸载

若需停用并彻底移除本插件，可使用 DSH CLI 从 `web` profile 中移除：

```sh
dsh plugin --profile web remove @local/dsh-session-settings
```

> **提示**：若安装时使用的是 github 别名源形式，亦可执行：
> ```sh
> dsh plugin --profile web remove github:u9521/dsh-session-settings#dist
> ```
> 卸载完成后，启动或重启 `dsh web` 即可恢复 DSH 默认原生界面。

---

## 常用开发与维护命令

| 命令 | 描述 |
| :--- | :--- |
| `pnpm run build` | 完整构建（TypeScript 类型检查 + 生成 `lib/` 构建产物） |
| `pnpm run check` | 仅执行类型检查（`tsc --noEmit`），不生成文件 |
| `pnpm run fmt` | 使用 Prettier 自动格式化源码与配置文件 |
| `pnpm run fmt:check` | 检查代码格式规范 |
| `pnpm run verify:gates` | 运行零依赖的文档与规范闸门 |
| `pnpm run verify` | 提交前聚合校验（`check` + `verify:gates`） |

---

## 常见问题 (FAQ)

### Q1: 修改会话配置或禁用工具/技能后，需要重启 `dsh web` 吗？
**A**: 不需要。插件把每个 agent 的策略声明在其自身的 scope 层上（工具限制、执行闸门与按 scope 遮蔽的 prompt 段），并在保存时重新声明，因此保存后下一次请求即生效。

### Q2: 会话尚未创建时保存会话级设置会怎样？
**A**: 新会话页在选定工作区的当下就已连上该工作区的空白会话，因此会话级配置直接写入该会话，下一次请求即生效。而完全没有会话的页面没有可写入的目标：「会话」页签会禁用，并在页签旁给出可见说明；此时工作区与全局默认仍可编辑。配置不会暂存，也不会被改道——保存只落在你选定的那个作用域。

### Q3: 插件的接口有鉴权吗？
**A**: 有。所有路由都注册在官方 connection 载体上，未鉴权请求会在进入任何处理器之前收到 `401`。插件自身不持有任何凭据。

### Q4: 如何卸载或移除本插件？
**A**: 请参考 [插件卸载](#插件卸载) 章节，使用 `dsh plugin --profile web remove` 命令从对应 profile 中移除即可。

---

## 开源协议

本项目基于 [MIT License](LICENSE) 授权开源。
