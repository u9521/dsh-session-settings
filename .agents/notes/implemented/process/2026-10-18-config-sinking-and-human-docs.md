# Agent Note: 配置下沉、受管边界收缩与人类文档协议

Status: implemented

## Problem

第一批框架落地后暴露出三类问题，根源都是"模板把母体项目当成唯一情况"：

**配置散落在闸门里。** `NAV_SECTION`、`STATUSES` 硬编码中文与四态，`SKIP_DIRS` 写死 `lib`（Dart/Elixir/Ruby 的源码目录），`verify-detachable` 无条件跑 `pnpm pack`。init 选的文档语言与 Note 强度，闸门不知道。

**框架占用了项目的通用目录名。** `MANAGED_PATHS` 含 `docs/`：VitePress、Sphinx、API 手册全部误报。

**交接纪律藏在二级文档里。** 工程模式建完就退出，接手的是只读根 `AGENTS.md` 的其他预设；"何时写 Note、提交前跑闸门"全在 `.agents/` 深处。

另有缺陷：`pre-push-checks` 模板整段重复，下半段硬编码了 `tsdown`、`dsh web`、`$DSH_HOME`。

## Decision

### 1. `config.mjs` 成为唯一的项目槽位

`budgets.mjs` 改名 `config.mjs`，收录全部仓库相关值：`DOC_LANG`、`NOTE_MODE`、`SEPARATION`、`CI`、`FRAMEWORK_AWARE_FILES`、`ENABLED_GATES`、`IGNORE_DIRS`、`PACK_CHECK`、`HUMAN_MAP`、`LOCAL_BUDGET` 与各项预算。闸门与模板逐字一致，`verify-preset` 校验不漂；模板侧提供 `config.mjs.tmpl`。

这推翻了第一批"`.agents/README.md` 只记豁免"的说法：那是给人看的解释，机器读 `config.mjs`，分工是**选择进配置、期望留在预设**。`verify-all` 改按 `ENABLED_GATES` 执行。

### 2. 受管边界收缩为 `AGENTS.md` + `.agents/`

架构文档从 `docs/architecture/` 迁到 `.agents/architecture/`。`docs/` 完全归还项目，`verify-detachable` 删除 `docs/` 标记与正则。

`PACK_CHECK` 可配置：本项目用 `pnpm pack --dry-run --json`，无发布面的项目设 `null` 即跳过。`SKIP_DIRS` 改由 `IGNORE_DIRS` 提供，默认跨语言且不含 `lib`。

### 3. `verify-human-docs`：只核真，不索求

新增闸门做两件事：

- **符号活性锚点**：反引号包裹的链接声明目标文件仍含该标识符，改名即失败。它证明"名字没消失"，不证明"仍被导出"。
- **声明的图谱要成立**：`HUMAN_MAP` 非 `null` 时须含四节、一个 mermaid 图或一行 `→`、一段带真实文件的有序精读路线，且不得落在受管路径。

`HUMAN_MAP === null` 时不要求任何图。

### 4. `AGENTS.local.md` 是宿主读的，不是 `.agents/local.md`

宿主 `agent-instructions` 的候选表是 `AGENTS.md` 与 `AGENTS.local.md`（每目录 join），`.agents/local.md` 永不被加载。故覆写层落在仓库根，与 `AGENTS.md` 同级，享受宿主的"更具体者优先"。

约束：`.gitignore` 忽略它且 `verify-detachable` 拒绝被跟踪；`LOCAL_BUDGET` 独立预算不计入团队基线，但 `verify-context-cost` 打印条件行；受控文档集排除它以免协作者断链；init 不创建、不提问。越界条款由 `audit-doc-slop` 提示，不阻断。

### 5. CI 是可选数据表，不是开关

`SEPARATION` 取 `team`/`stealth`；`CI` 取 `null` 或 `{ platform, path }`，模板按平台各一份（GitHub `hashFiles`、GitLab `rules: exists:`、自研 `[ -f ... ]`）。`verify-detachable` 放行 `CI.path` 与 `FRAMEWORK_AWARE_FILES`，**但必须匹配到守卫**——"允许提及"与"删掉框架后优雅跳过"是两件事。

### 6. 根文件加三条纪律

改路径前读模块文档、非平凡改动同变更写 Note、提交前跑闸门。三条是触发条件与指针而非规则正文，占 65 units，根文件 469 → 533。

## Alternatives considered

- **按文件数切 L0/L1/L2**：与"精读路线 > 15 文件触发"矛盾，12 文件的项目会落进两档。改为"单篇能否讲清"+"是否一眼看穿"。
- **`.agents/local.md` 靠根文件声明引导**：宿主不加载它，等于要求多跑一次 read 且靠自觉。换成 `AGENTS.local.md` 后两者都不需要。
- **本地覆写层写 `.git/info/exclude`**：每克隆独立，重新拉取即丢；"允许存在"是团队政策，应写 `.gitignore`。
- **人类文档也归框架**：它讲的是项目概念与读法，删掉框架后仍有价值，归项目。
- **符号活性校验到导出级别**：需要类型解析，零依赖前提不成立；名字存活已覆盖实际漂移。
- **CI 做成布尔开关**：平台差异无法用一个开关表达。
- **本地覆写层计入团队基线**：个人习惯会顶爆 ratchet；独立池加条件行兼顾可见性与稳定性。

## Consequences

- **两份 config 靠手工保持导出集一致**：`verify-preset` 只校验闸门脚本，不校验仓内 `config.mjs` 与 `.tmpl` 的导出集。
- **符号锚点零存量**：四篇架构文档仍是文字描述，闸门先保证"写了就必须真"；改写留待后续。
- **覆写层与 `AGENTS.md` 共享宿主注入预算**：个人层过长会挤占团队入口的 `maxBytes`，闸门只能限单文件体积。
- **`docs/` 归还后文档分居两处**：约束在 `.agents/architecture/`、全景图在 `docs/MAP.md`；根导航表只闭合前者。
- **CI 守卫靠字符串匹配**：四条正则，平台改语法需同步；漏匹配表现为误报。
- **模板必须用目标仓库验证，不能只看闸门**：一次从模板初始化空仓库的演练暴露四个缺陷——根模板缺第五节、空技能目录被判违规、框架说明模板自身超预算、导航表解析器被 `repo:begin` 注释截断。它们在本仓库全是绿的，因为本仓库的实例没有槽位注释、没有空目录、且早已修过。结论：模板的正确性只有"复制到别处再跑"能证明，`verify-preset` 只能证明两边不漂。
- **安装未执行**：镜像已就绪，`cp` 进 `~/.dsh` 前需用户评审。
