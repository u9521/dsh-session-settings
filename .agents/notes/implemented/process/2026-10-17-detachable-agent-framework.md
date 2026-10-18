# Agent Note: 可剥离的 Agent 开发框架

Status: implemented

## Problem

工程模式预设生出的脚手架正在反噬宿主项目。

**常驻成本失衡。** 根 `AGENTS.md` 1497/1500，`## 不变量` 占 737（49%）。两个嵌套 `AGENTS.md` 再占 600，常驻合计 2097。

**披露层级缺失。** 预设只给一个总数字，没给触发时机。agent 写规则时唯一的信号是"哪个文件还没满"，于是规则均摊进根文件，"改 `src/server` 前该读什么"无处安放。

**项目与框架耦合。** `package.json` 定义 `verify:gates`，README 两张表各列一行，`tsdown.config.mjs` 注释引用 Note 路径；删掉受管目录后全部悬空。

**制度与执行背离。** 26 篇 implemented 按旧五节写，已上线能力挂着 Acceptance criteria；53 次新增对 2 次修改。

## Decision

### 1. 判据：依赖方向单向

框架可以读项目，项目不得提及框架。验收动作：删掉 `AGENTS.md`、`.agents/`、`docs/` 后，`pnpm install && pnpm run build` 与 `release.yml` 必须照常跑通。

### 2. 位置由触发时机决定

| 时机 | 载体 |
| :--- | :--- |
| 每次都在 | 根 `AGENTS.md`：项目状态与"去哪找" |
| 编辑某目录前 | 导航表的指针 → `docs/architecture/<模块>.md` |
| 某动作发生时 | `.agents/skills/<name>/SKILL.md` |
| 追理由时 | `.agents/notes/` |

"安全边界"因此不落文件：路径归属是事实（进根），要不要问是行为（进 `commit`）。"变更工作流"归 Note 与 pre-push 技能，它是 steps 而非 reference。

### 3. 根文件是入口投影

四个二级标题：项目定位、目录导航、命令矩阵、参考入口，实测 469 units。改它的唯一理由是项目长出新模块。

导航表三列：路径、内容、**改动前先读**。架构文档首行声明 `Covers:`，闸门双向闭合：每行指向的文件必须存在，每篇文档必须被引用，`Covers:` 的目录必须存在。

### 4. 闸门迁入 `.agents/gates/`

`scripts/gates/` 消失，`package.json` 删掉 `verify` 与 `verify:gates`，README 删对应两行。闸门不受 ESLint/Prettier 覆盖，零依赖自检是它自己的事。闸门脚本与模板逐字一致，项目专属数值抽进 `budgets.mjs`，模板不带它，`verify-preset` 守住两边不漂。

`verify-detachable` 遍历 git 跟踪的非受管文件，命中受管路径字样即失败，并以 `pnpm pack --dry-run` 断言产物不含框架文件。

### 5. 不设版本，只有创建与更新

没有版本号、迁移脚本、比对表。终态由闸门校验：重写整篇或局部改写，只要 scaffold、doc-budgets、md-links 全绿即等价。

`.agents/README.md` 不存档位快照，只记**扫描不出来的东西**：用户明确免掉的项（如"只要两态，不要 rejected"），事后与"预设本就不生成"无法区分。其余偏好由更新时扫描得出并回显确认。

职责两分：仓库闸门判**内部自洽**（导航表 ↔ 架构文档、`Covers:` ↔ 目录、`.gitignore` ↔ 豁免表、预算、链接、Note 骨架），**与预设一致**只能由预设内技能判。项目本体不知情，期望清单只活在预设里。

### 6. 预设重新定位

工程模式只做创建、更新、审计框架。persona 收窄为"脚手架维护者"，"不得改源码"由禁令改为职责边界；需求澄清移进 init。技能只留 `init-agent-native` 与 `audit-doc-slop`，其余四个从 `templates/` 生成，模板用 `<!-- repo:begin -->…<!-- repo:end -->` 圈出仓库槽位，覆盖只重写槽位外。预设源镜像在 `.agents/preset/`。

### 7. Note 骨架按状态分派

implemented 用 Problem/Decision/Alternatives/Consequences，proposed 保留五节；26 篇存量机械重写，仍有判定价值的验收条目并入 Decision。

**验证方式：** 在 `git archive` 副本里删掉三个受管路径，`build`、`lint`、`pack --dry-run` 均通过（已实测）。四个新闸门各经一次人为违规确认会失败：detachable 对 `.agents/` 字样、scaffold 对死链/孤儿/失效 `Covers:`/越权标题、context-cost 对 `src/AGENTS.md`、preset 对模板与仓内脚本的字面差异。

## Alternatives considered

- **平铺 `.agents/rules/`**：仍是"哪个文件没满"的思路，常驻成本照付。
- **目录级 `AGENTS.md`**：可能随包发布，且宿主按整条链注入，每层都在常驻成本上记账。
- **保留两个嵌套 `AGENTS.md`**：合计 600 units，与 notes README 重复约九成，独有四条约 80 units 可并入。
- **设版本号 + 迁移脚本**：终态已由闸门校验，版本只增维护面，且预设升级后仓库快照必然过期。
- **落 `scaffold.yml`**：与预设成两份事实源。
- **闸门留在 `scripts/gates/`**：项目 `package.json` 必须引用它，否定可剥离性。
- **授权边界全留根或全进技能**：前者是常驻负担，后者不可靠（动手前未必查技能）。
- **同名技能无条件覆盖**：抹掉仓库专属知识，故改为槽位覆盖。

## Consequences

- **一跳变多跳**：规则移出根后，读一条约束要先跳架构文档；代价用导航表第三列点名抵消，但仍是多一次查找。
- **机器不可见的一致性**：两次更新可能产出不同写法。结构与预算在闸门内，写法不在。
- **槽位标记依赖约定**：`repo:begin/end` 写错会静默丢内容，`verify-preset` 只校验成对。
- **常驻成本从 2097 降到 469**：收益来自删两层嵌套与根文件减重，代价是规则从"读根即得"变成"按目录查"。
- **安装目录尚未变更**：本轮只产出 `.agents/preset/` 镜像，`cp` 进 `~/.dsh/profiles/web/presets/engineering/` 需提权，留给评审后执行。
