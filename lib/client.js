window.__ModuleLoader__.load({
	id: "@local/dsh-session-settings",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_dom_client = require("react-dom/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_dom = require("react-dom");
		//#region src/client/locales/zh.ts
		const zh = {
			sessionSettings: {
				title: "会话设置",
				heroChipHint: "配置此会话的子代理模型、MCP服务器与技能",
				idCopied: "已复制",
				nav: {
					modelTitle: "子代理模型",
					mcpTitle: "MCP 服务器",
					skillsTitle: "技能"
				},
				section: {
					modelTitle: "子代理模型",
					modelDesc: "此会话执行子代理（Subagent、Subagent Fork、Workflow 等）时所使用的模型与思考等级。",
					behaviorControlTitle: "子代理调用与路由控制",
					behaviorControlDesc: "控制主 Agent 为子代理选择模型的权限，以及分叉子代理（Fork）的模型继承行为。",
					mcpTitle: "MCP 服务器",
					mcpDesc: "管理当前会话可调用的 Model Context Protocol (MCP) 服务器。",
					skillsTitle: "技能 (Skills)",
					skillsDesc: "管理当前会话可调用的技能（Skills），包括内置、用户定义和项目专属技能。"
				},
				switch: {
					allowAgentSelectModel: {
						title: "允许 Agent 选择子代理模型",
						desc: "覆盖官方的「允许 Agent 为 Subagent 选择模型」选项。开启时 Agent 可自主在支持的模型中选择并使用 list_subagent_models；关闭时使用强制模式，从工具列表剔除 list_subagent_models 与 subagent 的 model 参数。",
						summaryAuto: "Agent自选: 开启",
						summaryForced: "Agent自选: 关闭(强制模式)"
					},
					overrideForkModel: {
						title: "替换 subagent fork 的模型",
						desc: "默认关闭。DSH 原生禁止基于分叉的子代理（subagent_fork）更换模型，以保证历史会话能够完整复用 KV 缓存。开启此选项后将允许强制替换 fork 子代理的模型，但会导致父会话历史的 KV 缓存失效，引起全量 Prompt 重新计算。",
						summaryEnabled: "替换Fork模型"
					}
				},
				scope: {
					sessionCustom: "已为此会话单独配置",
					sessionDefault: "跟随全局默认设置",
					sessionWorkspace: "跟随工作区默认设置",
					workspaceLabel: "工作区"
				},
				badge: {
					inherit: "继承",
					custom: "自定义"
				},
				preview: {
					effectiveModelTitle: "生效配置预览",
					fromWorkspace: "来自工作区默认",
					fromGlobal: "来自全局默认"
				},
				status: {
					default: "默认",
					inherit: "继承",
					custom: "自定义",
					workspace: "工作区",
					none: "未启用"
				},
				clone: {
					toolbarTitle: "克隆预设：",
					inputPlaceholder: "粘贴源会话 ID (如 session-xxxx)",
					applyBtn: "克隆",
					loading: "载入中...",
					success: "已成功克隆会话「{name}」的预设！请确认后点击下方「保存」生效。",
					error: "克隆失败：未找到该会话 ID 或无法读取其配置",
					cannotCloneSelf: "不能复制自己的预设"
				},
				mode: {
					workspace: {
						title: "使用工作区默认配置",
						desc: "继承当前工作区统一设定的子代理执行模型。"
					},
					default: {
						title: "使用全局默认配置",
						desc: "此会话不进行独立配置，直接继承全局默认规则。"
					},
					inherit: {
						title: "跟随当前父会话模型",
						desc: "子代理继承当前会话所选用的模型与思考等级。"
					},
					custom: {
						title: "指定此会话的子代理模型",
						desc: "为此会话单独指定专属的模型。"
					}
				},
				mcpMode: {
					workspace: {
						title: "使用工作区默认规则",
						badgeCustom: "工作区: {count} 个启用",
						badgeInherit: "继承全局",
						desc: "使用当前工作区统一设定的 MCP 服务器与工具状态。"
					},
					default: {
						title: "使用全局默认规则",
						badge: "{count} 个服务器",
						desc: "使用全局设置中标记为“默认开启”的所有 MCP 服务器。"
					},
					custom: {
						title: "为此会话自定义",
						desc: "仅在当前会话中启用以下 MCP 服务器。"
					}
				},
				skillsMode: {
					workspace: {
						title: "使用工作区默认规则",
						badgeCustom: "工作区: {count} 个禁用",
						badgeInherit: "继承全局",
						desc: "使用当前工作区统一设定的技能启用/禁用配置。"
					},
					default: {
						title: "使用全局默认规则",
						badge: "{count} 个禁用",
						desc: "使用全局设置中定义的技能启用/禁用配置。"
					},
					custom: {
						title: "为此会话自定义",
						desc: "为当前会话单独配置启用的技能列表。"
					}
				},
				skills: {
					empty: "当前工作区未发现任何可用技能。可在项目根目录或 ~/.dsh/skills 中添加。",
					noMatch: "未找到匹配的技能。",
					searchPlaceholder: "搜索技能名称或描述...",
					refresh: "刷新",
					refreshing: "正在获取技能列表...",
					modelInvocableTitle: "模型调用",
					modelInvocableDesc: "允许模型通过 skill 工具按需加载该技能并在提示词目录中展示",
					userInvocableTitle: "用户快捷调用",
					userInvocableDesc: "允许用户在对话输入框中通过 /技能名 快捷注入完整技能指令",
					runtimeNotice: "此技能由当前会话的预设或运行时提供，仅在当前会话生效，不可设为全局默认。",
					noInstructions: "（暂无详细指令内容）",
					rulesSectionTitle: "调用权限管控",
					instructionsSectionTitle: "指令与规则",
					modalDoneBtn: "完成",
					modalCancelBtn: "取消",
					modalSaveBtn: "保存",
					modalSavingBtn: "保存中...",
					sourceProject: "项目技能",
					sourceUser: "用户技能",
					sourceBundled: "内置技能",
					sourceRuntime: "运行时预设",
					modelInvocableEnabled: "模型调用: 开启",
					modelInvocableDisabled: "模型调用: 禁用",
					userInvocableEnabled: "快捷指令: 开启",
					userInvocableDisabled: "快捷指令: 禁用",
					pathLabel: "文件路径：",
					whenToUseLabel: "使用时机：",
					loadingContent: "正在加载内容...",
					effectiveInfoDefault: "当前跟随全局默认配置（共 {total} 个技能，已启用 {enabled} 个）",
					matchedCount: "匹配到 {matched} / {total} 个技能",
					noContent: "（暂未获取到该技能的详细指令内容）",
					loadError: "（加载技能详细指令失败）",
					loadErrorWithReason: "（加载出错: {reason}）"
				},
				mcp: {
					empty: "暂无已配置的 MCP 服务器。可在「设置 -> 插件配置 -> MCP 服务器」中集中添加。",
					selectAll: "全选",
					deselectAll: "全不选",
					toolsBtn: "配置工具",
					toolsModeDefaultBadge: "工具: 跟随默认",
					toolsModeCustomBadge: "工具: 单独配置 ({count} 禁用)",
					toolsAllActiveBadge: "工具: 全部启用",
					toolsCount: "{count} 个工具",
					toolsEnabledCount: "已启用 {enabled} / {total}"
				},
				toolsModal: {
					title: "会话工具配置",
					modeDefaultTitle: "跟随全局默认配置",
					modeDefaultDesc: "使用全局 MCP 服务设置中定义的工具禁用列表（当前全局已禁用 {count} 个工具）。",
					modeCustomTitle: "为此会话单独配置工具",
					modeCustomDesc: "单独指定在当前会话中启用或禁用的工具。",
					searchPlaceholder: "搜索工具名称或描述...",
					enableAll: "全部启用",
					disableAll: "全部禁用",
					resetToDefault: "重置为全局默认",
					noToolsAvailable: "该服务器暂未发现工具，或尚未成功连接获取。",
					loading: "正在获取工具列表...",
					toolEnabled: "已启用",
					toolGlobalDisabledBadge: "全局默认禁用",
					toolCustomDisabledBadge: "当前会话禁用",
					save: "应用",
					saving: "保存中...",
					cancel: "取消",
					disabledCount: "当前会话共禁用 {count} 个工具",
					allEnabledCount: "全部工具可用 (共 {total} 个)",
					parameters: "展开",
					hideParameters: "收起",
					paramsCount: "{total} 个参数 ({required} 必填)",
					noParams: "无入参",
					noParameters: "该工具无参数定义",
					viewList: "列表",
					viewRaw: "Raw JSON",
					required: "必填",
					optional: "可选",
					defaultVal: "默认值: ",
					enumVal: "枚举: ",
					fetchToolsBtn: "获取工具列表",
					fetchingTools: "正在获取工具列表...",
					refreshBtn: "刷新工具列表",
					fetchFailed: "获取工具列表失败：",
					retry: "重试"
				},
				field: {
					provider: "模型提供方 (Provider)",
					providerPlaceholder: "请选择提供方...",
					loadingModels: "正在获取模型列表...",
					noModelsFound: "未发现可用模型提供方",
					model: "模型名称 (Model)",
					modelPlaceholder: "请选择模型...",
					reasoningEffort: "思考等级 (Reasoning Effort)",
					reasoningEffortDefault: "模型默认 (Default)",
					reasoningOff: "关闭思考 (off)",
					reasoningMinimal: "极低思考 (minimal)",
					reasoningLow: "低思考 (low)",
					reasoningMedium: "中等思考 (medium)",
					reasoningHigh: "高思考 (high)",
					reasoningXhigh: "超高思考 (xhigh)",
					reasoningMax: "最大思考 (max)",
					timeoutSeconds: "{seconds}s 超时"
				},
				action: {
					save: "保存",
					saveSession: "保存",
					setDefault: "设为默认",
					applyWorkspaceDefault: "应用",
					restoreWorkspaceToGlobal: "恢复默认",
					saving: "保存中...",
					savingDefault: "保存中...",
					reset: "恢复默认",
					copyId: "复制会话 ID",
					close: "关闭",
					restoreDefault: "恢复默认",
					undo: "撤销",
					confirmApply: "应用",
					cancel: "取消"
				},
				setDefaultModal: {
					title: "设为默认",
					desc: "将当前编辑的配置设置为工作区或全局的默认模板。新会话将自动继承生效。",
					targetScope: "应用目标：",
					scopeWorkspace: "工作区默认",
					scopeGlobal: "全局默认",
					diffBeforeWorkspace: "变更前",
					diffAfterWorkspace: "变更后",
					diffBeforeGlobal: "变更前",
					diffAfterGlobal: "变更后",
					unchanged: "（无变动）",
					changed: "已变动",
					modelSection: "子代理模型",
					mcpSection: "MCP 服务器",
					skillsSection: "技能",
					mcpCustom: "已启用 {count} 个服务器",
					skillsCustom: "已禁用 {count} 项技能",
					skillsAll: "全部启用 (无禁用)",
					restoreDefaultNotice: "已切换为标准默认模板对比，点击右下方「应用」生效。"
				},
				notice: {
					saved: "会话设置已保存！",
					savedDefault: "全局默认设置已保存！",
					savedWorkspace: "工作区「{name}」默认设置已保存！",
					error: "保存失败："
				}
			},
			mcpServers: {
				tabLabel: "MCP 服务器",
				title: "MCP 服务器",
				desc: "集中配置并管理 Model Context Protocol (MCP) 服务器，供各个会话按需选用与隔离。",
				actions: {
					add: "添加服务器",
					import: "导入配置",
					export: "导出配置",
					test: "测试连接",
					testing: "测试中...",
					toolsList: "工具列表",
					toolsFetching: "获取中...",
					edit: "编辑",
					delete: "删除",
					save: "保存",
					saving: "保存中...",
					cancel: "取消",
					refresh: "刷新"
				},
				table: {
					enabledDefault: "默认开启",
					website: "官网",
					empty: "暂未添加任何 MCP 服务器。点击上方「添加服务器」或「导入配置」开始。"
				},
				form: {
					addTitle: "添加 MCP 服务器",
					editTitle: "编辑 MCP 服务器",
					id: "服务器标识 (ID)",
					idPlaceholder: "如 github_mcp, local_fs, sqlite",
					name: "显示名称",
					namePlaceholder: "如 GitHub 官方工具",
					description: "描述 (可选)",
					descriptionPlaceholder: "简要说明此 MCP 提供的工具与功能",
					autoFill: "自动填充",
					fillDetected: "填入: {value}",
					collapseAdvanced: "收起",
					expandAdvanced: "展开配置",
					transport: "传输协议",
					transportStdio: "stdio (本地命令行子进程)",
					transportHttp: "HTTP / SSE (远程或本地服务地址)",
					command: "启动命令 (Command)",
					commandPlaceholder: "如 npx, python, uvx, node",
					args: "命令行参数 (Arguments)",
					argsPlaceholder: "每行一个参数，或空格隔开。例如：\n-y\n@modelcontextprotocol/server-github",
					cwd: "工作目录 (CWD，可选)",
					cwdPlaceholder: "子进程的工作目录，留空使用当前项目目录",
					env: "环境变量 (ENV，可选)",
					envKey: "变量名",
					envValue: "变量值",
					addEnv: "添加环境变量",
					url: "服务端地址 (URL)",
					urlPlaceholder: "如 http://localhost:3000/mcp",
					headers: "自定义请求头 (Headers，可选)",
					headerKey: "请求头名",
					headerValue: "请求头值",
					addHeader: "添加请求头",
					enabledByDefault: "默认开启",
					enabledByDefaultDesc: "启用后，会话在默认模式下将自动加载此 MCP 服务器",
					advancedTitle: "高级配置",
					toolCallTimeoutMs: "调用/连接超时 (毫秒)",
					toolCallTimeoutMsPlaceholder: "默认 60000 毫秒 (60秒)",
					toolCallTimeoutMsDesc: "每次工具调用及连接测试的最长超时等待时间",
					failOnStartupError: "启动失败时拒绝激活",
					failOnStartupErrorDesc: "初始连接或工具同步失败时直接拒绝插件激活 (默认关闭)",
					reconnectEnabled: "启用自动重连",
					reconnectEnabledDesc: "连接丢失后以指数退避策略自动重连 (默认开启)",
					reconnectInitialDelayMs: "首次重连延迟 (毫秒)",
					reconnectInitialDelayMsPlaceholder: "默认 500 毫秒",
					reconnectMaxDelayMs: "重连退避上限 (毫秒)",
					reconnectMaxDelayMsPlaceholder: "默认 30000 毫秒 (30秒)",
					reconnectMaxAttempts: "连续重试上限 (次)",
					reconnectMaxAttemptsPlaceholder: "默认 10 次"
				},
				importModal: {
					title: "导入 MCP 配置",
					desc: "支持标准 Claude Desktop / Cursor 格式的 JSON 配置文件（包含 mcpServers 键）。",
					placeholder: "{\n  \"mcpServers\": {\n    \"github\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"],\n      \"env\": {\n        \"GITHUB_PERSONAL_ACCESS_TOKEN\": \"ghp_...\"\n      }\n    }\n  }\n}",
					confirm: "导入",
					importing: "导入中...",
					success: "成功导入 {count} 个 MCP 服务器！",
					error: "导入失败：JSON 格式不正确或未找到合法的 mcpServers 条目"
				},
				toolsModal: {
					title: "工具列表",
					searchPlaceholder: "搜索工具名称或描述...",
					enableAll: "全部启用",
					disableAll: "全部禁用",
					parameters: "展开",
					hideParameters: "收起",
					viewList: "列表",
					viewRaw: "Raw JSON",
					required: "必填",
					optional: "可选",
					defaultVal: "默认值: ",
					enumVal: "枚举: ",
					noParams: "无入参",
					paramsCount: "{total} 个参数 ({required} 必填)",
					noParameters: "该工具无参数定义",
					empty: "未找到匹配的工具",
					serverNoTools: "该 MCP 服务器当前未声明任何可用工具",
					loading: "正在获取工具列表...",
					fetchFailed: "获取工具列表失败：",
					retry: "重试",
					statusEnabled: "已启用",
					statusDisabled: "已禁用",
					disabledBadge: "已禁用 {count} 个工具",
					saveSuccess: "工具配置已保存！",
					save: "保存",
					saving: "保存中..."
				},
				supportedVersions: " (支持版本: {versions})",
				saveConfirmModal: {
					title: "连接测试未通过",
					message: "系统在保存前对该服务器进行了连接测试，但未能成功连接：",
					prompt: "是否仍然保存此 MCP 服务器配置？",
					saveAnyway: "仍然保存",
					cancel: "返回修改"
				},
				notices: {
					deleteConfirm: "确定要删除 MCP 服务器「{name}」吗？",
					saved: "MCP 服务器已保存！",
					deleted: "MCP 服务器已删除！",
					error: "操作失败："
				}
			},
			skillsSettings: {
				tabLabel: "技能",
				title: "技能",
				desc: "集中管理与配置全局 Skill（技能）的默认启用状态与说明规则，供各个会话默认继承与按需调整。",
				skillsStats: "（共 {total} 个技能，已启用 {enabled} 个）",
				actions: {
					saveSettings: "保存",
					saving: "保存中...",
					refresh: "刷新"
				},
				searchPlaceholder: "搜索技能名称或描述...",
				empty: "当前工作区未发现任何可用技能。可在项目根目录或 ~/.dsh/skills 中添加。",
				noMatch: "未找到匹配的技能。",
				notices: {
					saved: "技能默认配置已保存！",
					saveError: "保存失败："
				}
			}
		};
		//#endregion
		//#region src/client/locales/en.ts
		const en = {
			sessionSettings: {
				title: "Session Settings",
				heroChipHint: "Configure subagent model, MCP servers, and skills for this session",
				idCopied: "Copied",
				nav: {
					modelTitle: "Subagent Model",
					mcpTitle: "MCP Servers",
					skillsTitle: "Skills"
				},
				section: {
					modelTitle: "Subagent Model",
					modelDesc: "Model and reasoning effort used when executing subagents (Subagent, Subagent Fork, Workflow, etc.) in this session.",
					behaviorControlTitle: "Subagent Behavior & Routing",
					behaviorControlDesc: "Control whether the parent Agent may autonomously select child subagent models, and manage fork inheritance behavior.",
					mcpTitle: "MCP Servers",
					mcpDesc: "Manage Model Context Protocol (MCP) servers available for this session.",
					skillsTitle: "Skills",
					skillsDesc: "Manage skills invocable in this session, including built-in, user-defined, and project-specific skills."
				},
				switch: {
					allowAgentSelectModel: {
						title: "Allow Agent to Select Subagent Models",
						desc: "Overrides the official \"Allow Agent to select model for Subagent\" option. When enabled, the Agent can autonomously select models and use list_subagent_models; when disabled, forced mode is used, removing list_subagent_models and the model parameter from the subagent tool.",
						summaryAuto: "Agent Selection: ON",
						summaryForced: "Agent Selection: OFF (Forced Mode)"
					},
					overrideForkModel: {
						title: "Replace Model for Subagent Fork",
						desc: "Disabled by default. DSH natively prevents forked subagents (subagent_fork) from changing models to preserve KV Cache reuse from the parent session. Enabling this forces replacing the model for forked subagents, but invalidates parent KV Cache reuse and triggers full prompt recomputation.",
						summaryEnabled: "Replace Fork Model"
					}
				},
				scope: {
					sessionCustom: "Configured for this session",
					sessionDefault: "Inheriting global default",
					sessionWorkspace: "Inheriting workspace default",
					workspaceLabel: "Workspace"
				},
				badge: {
					inherit: "Inherit",
					custom: "Custom"
				},
				preview: {
					effectiveModelTitle: "Effective Config Preview",
					fromWorkspace: "From Workspace Default",
					fromGlobal: "From Global Default"
				},
				status: {
					default: "Default",
					inherit: "Inherit",
					custom: "Custom",
					workspace: "Workspace",
					none: "None"
				},
				clone: {
					toolbarTitle: "Clone Preset:",
					inputPlaceholder: "Paste source session ID (e.g. session-xxxx)",
					applyBtn: "Clone",
					loading: "Loading...",
					success: "Successfully cloned preset from session \"{name}\"! Click \"Save\" below to apply.",
					error: "Clone failed: Session ID not found or config could not be loaded.",
					cannotCloneSelf: "Cannot clone preset from current session"
				},
				mode: {
					workspace: {
						title: "Use Workspace Default",
						desc: "Inherit subagent model settings configured for the current workspace."
					},
					default: {
						title: "Use Global Default",
						desc: "Inherit subagent model settings configured as global default."
					},
					inherit: {
						title: "Follow Parent Session Model",
						desc: "Subagents inherit the model and reasoning effort from the active session."
					},
					custom: {
						title: "Custom Model for this Session",
						desc: "Specify a dedicated subagent execution model for this session."
					}
				},
				mcpMode: {
					workspace: {
						title: "Use Workspace Default",
						badgeCustom: "Workspace: {count} enabled",
						badgeInherit: "Inherit Global",
						desc: "Use MCP servers and tools configured for the current workspace."
					},
					default: {
						title: "Use Global Default",
						badge: "{count} servers",
						desc: "Enable all MCP servers configured as \"Default On\" in global settings."
					},
					custom: {
						title: "Custom for this Session",
						desc: "Only enable selected MCP servers in the current session."
					}
				},
				skillsMode: {
					workspace: {
						title: "Use Workspace Default",
						badgeCustom: "Workspace: {count} disabled",
						badgeInherit: "Inherit Global",
						desc: "Use skill enable/disable settings configured for the current workspace."
					},
					default: {
						title: "Use Global Default",
						badge: "{count} disabled",
						desc: "Use skill enable/disable settings defined in global settings."
					},
					custom: {
						title: "Custom for this Session",
						desc: "Customize skill enable/disable settings for the current session."
					}
				},
				skills: {
					empty: "No available skills found in the current workspace. Add skills in the workspace root or ~/.dsh/skills.",
					noMatch: "No matching skills found.",
					searchPlaceholder: "Search skill name or description...",
					refresh: "Refresh",
					refreshing: "Fetching skills list...",
					modelInvocableTitle: "Model Invocation",
					modelInvocableDesc: "Allow the model to dynamically load this skill via the skill tool and see it in prompt catalog",
					userInvocableTitle: "User Slash Shortcut",
					userInvocableDesc: "Allow users to inject full skill instructions into composer via /skill-name shortcut",
					runtimeNotice: "This skill is provided by the active session preset or runtime. It only applies to the current session and cannot be set as a global default.",
					noInstructions: "(No detailed instructions content)",
					rulesSectionTitle: "Invocation Permissions",
					instructionsSectionTitle: "Instructions & Rules",
					modalDoneBtn: "Done",
					modalCancelBtn: "Cancel",
					modalSaveBtn: "Save",
					modalSavingBtn: "Saving...",
					sourceProject: "Project Skill",
					sourceUser: "User Skill",
					sourceBundled: "Built-in Skill",
					sourceRuntime: "Runtime Preset",
					modelInvocableEnabled: "Model Invocation: Enabled",
					modelInvocableDisabled: "Model Invocation: Disabled",
					userInvocableEnabled: "Slash Shortcut: Enabled",
					userInvocableDisabled: "Slash Shortcut: Disabled",
					pathLabel: "File Path:",
					whenToUseLabel: "When to Use:",
					loadingContent: "Loading content...",
					effectiveInfoDefault: "Currently inheriting global default config ({total} total skills, {enabled} enabled)",
					matchedCount: "Matched {matched} / {total} skills",
					noContent: "(Skill instructions content not found)",
					loadError: "(Failed to load skill instructions)",
					loadErrorWithReason: "(Load error: {reason})"
				},
				mcp: {
					empty: "No MCP servers configured yet. Add servers in \"Settings -> Plugins -> MCP Servers\".",
					selectAll: "Select All",
					deselectAll: "Deselect All",
					toolsBtn: "Configure Tools",
					toolsModeDefaultBadge: "Tools: Inherit Default",
					toolsModeCustomBadge: "Tools: Custom ({count} disabled)",
					toolsAllActiveBadge: "Tools: All Enabled",
					toolsCount: "{count} Tools",
					toolsEnabledCount: "Enabled {enabled} / {total}"
				},
				toolsModal: {
					title: "Session Tool Configuration",
					modeDefaultTitle: "Inherit Global Default Configuration",
					modeDefaultDesc: "Inherit the disabled tools list defined in global MCP server settings ({count} tools globally disabled).",
					modeCustomTitle: "Configure Tools for this Session",
					modeCustomDesc: "Explicitly enable or disable specific tools in the current session.",
					searchPlaceholder: "Search tool name or description...",
					enableAll: "Enable All",
					disableAll: "Disable All",
					resetToDefault: "Reset to Global Default",
					noToolsAvailable: "No tools discovered for this server, or not connected yet.",
					loading: "Fetching tools list...",
					toolEnabled: "Enabled",
					toolGlobalDisabledBadge: "Disabled Globally",
					toolCustomDisabledBadge: "Disabled in Session",
					save: "Apply",
					saving: "Saving...",
					cancel: "Cancel",
					disabledCount: "{count} tools disabled in current session",
					allEnabledCount: "All tools enabled ({total} total)",
					parameters: "Expand",
					hideParameters: "Collapse",
					paramsCount: "{total} parameters ({required} required)",
					noParams: "No Parameters",
					noParameters: "This tool has no parameter definitions",
					viewList: "List",
					viewRaw: "Raw JSON",
					required: "Required",
					optional: "Optional",
					defaultVal: "Default: ",
					enumVal: "Enum: ",
					fetchToolsBtn: "Fetch Tools",
					fetchingTools: "Fetching tools list...",
					refreshBtn: "Refresh Tools",
					fetchFailed: "Failed to fetch tools: ",
					retry: "Retry"
				},
				field: {
					provider: "Model Provider",
					providerPlaceholder: "Select provider...",
					loadingModels: "Fetching models list...",
					noModelsFound: "No available model providers found",
					model: "Model Name",
					modelPlaceholder: "Select model...",
					reasoningEffort: "Reasoning Effort",
					reasoningEffortDefault: "Default",
					reasoningOff: "Off (off)",
					reasoningMinimal: "Minimal (minimal)",
					reasoningLow: "Low (low)",
					reasoningMedium: "Medium (medium)",
					reasoningHigh: "High (high)",
					reasoningXhigh: "Extra High (xhigh)",
					reasoningMax: "Max (max)",
					timeoutSeconds: "{seconds}s timeout"
				},
				action: {
					save: "Save",
					saveSession: "Save",
					setDefault: "Set as Default",
					applyWorkspaceDefault: "Apply",
					restoreWorkspaceToGlobal: "Restore Default",
					saving: "Saving...",
					savingDefault: "Saving...",
					reset: "Restore Default",
					copyId: "Copy Session ID",
					close: "Close",
					restoreDefault: "Restore Default",
					undo: "Undo",
					confirmApply: "Apply",
					cancel: "Cancel"
				},
				setDefaultModal: {
					title: "Set as Default",
					desc: "Set current configuration as the default template for workspace or global scope. New sessions will inherit automatically.",
					targetScope: "Target Scope:",
					scopeWorkspace: "Workspace Default",
					scopeGlobal: "Global Default",
					diffBeforeWorkspace: "Before",
					diffAfterWorkspace: "After",
					diffBeforeGlobal: "Before",
					diffAfterGlobal: "After",
					unchanged: "(Unchanged)",
					changed: "Changed",
					modelSection: "Subagent Model",
					mcpSection: "MCP Servers",
					skillsSection: "Skills",
					mcpCustom: "{count} servers enabled",
					skillsCustom: "{count} skills disabled",
					skillsAll: "All enabled (no disabled skills)",
					restoreDefaultNotice: "Switched to standard default template comparison. Click \"Apply\" below to save."
				},
				notice: {
					saved: "Session settings saved!",
					savedDefault: "Global default settings saved!",
					savedWorkspace: "Successfully updated default settings for workspace \"{name}\"!",
					error: "Save failed: "
				}
			},
			mcpServers: {
				tabLabel: "MCP Servers",
				title: "MCP Servers",
				desc: "Centrally configure and manage Model Context Protocol (MCP) servers for per-session selection and isolation.",
				actions: {
					add: "Add Server",
					import: "Import Config",
					export: "Export Config",
					test: "Test Connection",
					testing: "Testing...",
					toolsList: "Tools List",
					toolsFetching: "Fetching...",
					edit: "Edit",
					delete: "Delete",
					save: "Save",
					saving: "Saving...",
					cancel: "Cancel",
					refresh: "Refresh"
				},
				table: {
					enabledDefault: "Default On",
					website: "Website",
					empty: "No MCP servers added yet. Click \"Add Server\" or \"Import Config\" above to get started."
				},
				form: {
					addTitle: "Add MCP Server",
					editTitle: "Edit MCP Server",
					id: "Server ID",
					idPlaceholder: "e.g. github_mcp, local_fs, sqlite",
					name: "Display Name",
					namePlaceholder: "e.g. GitHub Official Tools",
					description: "Description (Optional)",
					descriptionPlaceholder: "Briefly describe the tools and functions provided by this MCP server",
					autoFill: "Auto Fill",
					fillDetected: "Fill: {value}",
					collapseAdvanced: "Collapse",
					expandAdvanced: "Expand Advanced",
					transport: "Transport",
					transportStdio: "stdio (Local CLI Subprocess)",
					transportHttp: "HTTP / SSE (Remote or Local Service URL)",
					command: "Command",
					commandPlaceholder: "e.g. npx, python, uvx, node",
					args: "Arguments",
					argsPlaceholder: "One argument per line or space-separated. E.g.:\n-y\n@modelcontextprotocol/server-github",
					cwd: "Working Directory (CWD, Optional)",
					cwdPlaceholder: "Subprocess working directory. Leave blank to use current project directory",
					env: "Environment Variables (ENV, Optional)",
					envKey: "Variable Name",
					envValue: "Value",
					addEnv: "Add Variable",
					url: "Server URL",
					urlPlaceholder: "e.g. http://localhost:3000/mcp",
					headers: "Custom Headers (Optional)",
					headerKey: "Header Name",
					headerValue: "Header Value",
					addHeader: "Add Header",
					enabledByDefault: "Enabled by Default",
					enabledByDefaultDesc: "When enabled, sessions in default mode will automatically load this MCP server",
					advancedTitle: "Advanced Settings",
					toolCallTimeoutMs: "Call / Test Timeout (ms)",
					toolCallTimeoutMsPlaceholder: "Default 60000 ms (60s)",
					toolCallTimeoutMsDesc: "Maximum timeout duration for tool execution and connection testing",
					failOnStartupError: "Fail Activation on Startup Error",
					failOnStartupErrorDesc: "Refuse plugin activation if initial connection or tool sync fails (Default off)",
					reconnectEnabled: "Enable Auto Reconnect",
					reconnectEnabledDesc: "Automatically reconnect with exponential backoff if connection drops (Default on)",
					reconnectInitialDelayMs: "Initial Reconnect Delay (ms)",
					reconnectInitialDelayMsPlaceholder: "Default 500 ms",
					reconnectMaxDelayMs: "Max Reconnect Backoff (ms)",
					reconnectMaxDelayMsPlaceholder: "Default 30000 ms (30s)",
					reconnectMaxAttempts: "Max Consecutive Retries",
					reconnectMaxAttemptsPlaceholder: "Default 10 attempts"
				},
				importModal: {
					title: "Import MCP Config",
					desc: "Supports standard Claude Desktop / Cursor formatted JSON config files (containing the mcpServers key).",
					placeholder: "{\n  \"mcpServers\": {\n    \"github\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"],\n      \"env\": {\n        \"GITHUB_PERSONAL_ACCESS_TOKEN\": \"ghp_...\"\n      }\n    }\n  }\n}",
					confirm: "Import",
					importing: "Importing...",
					success: "Successfully imported {count} MCP servers!",
					error: "Import failed: Invalid JSON format or no valid mcpServers entries found"
				},
				toolsModal: {
					title: "Tools",
					searchPlaceholder: "Search tool name or description...",
					enableAll: "Enable All",
					disableAll: "Disable All",
					parameters: "Expand",
					hideParameters: "Collapse",
					viewList: "List",
					viewRaw: "Raw JSON",
					required: "Required",
					optional: "Optional",
					defaultVal: "Default: ",
					enumVal: "Enum: ",
					noParams: "No Parameters",
					paramsCount: "{total} parameters ({required} required)",
					noParameters: "This tool has no parameter definitions",
					empty: "No matching tools found",
					serverNoTools: "This MCP server currently does not declare any available tools",
					loading: "Fetching tools list...",
					fetchFailed: "Failed to fetch tools: ",
					retry: "Retry",
					statusEnabled: "Enabled",
					statusDisabled: "Disabled",
					disabledBadge: "{count} tools disabled",
					saveSuccess: "Tool configuration saved!",
					save: "Save",
					saving: "Saving..."
				},
				supportedVersions: " (Supported: {versions})",
				saveConfirmModal: {
					title: "Connection Test Failed",
					message: "The system tested the connection before saving, but failed to connect:",
					prompt: "Do you still want to save this MCP server configuration?",
					saveAnyway: "Save Anyway",
					cancel: "Return to Edit"
				},
				notices: {
					deleteConfirm: "Are you sure you want to delete MCP server \"{name}\"?",
					saved: "MCP server saved!",
					deleted: "MCP server deleted!",
					error: "Operation failed: "
				}
			},
			skillsSettings: {
				tabLabel: "Skills",
				title: "Skills",
				desc: "Centrally manage and configure global Skill defaults and rules for per-session inheritance and customization.",
				skillsStats: "({total} skills total, {enabled} enabled)",
				actions: {
					saveSettings: "Save",
					saving: "Saving...",
					refresh: "Refresh"
				},
				searchPlaceholder: "Search skill name or description...",
				empty: "No available skills found in the current workspace. Add skills in the workspace root or ~/.dsh/skills.",
				noMatch: "No matching skills found.",
				notices: {
					saved: "Skills default configuration saved!",
					saveError: "Save failed: "
				}
			}
		};
		//#endregion
		//#region src/client/locales/index.ts
		function flattenDictionary(record, prefix = "") {
			const result = {};
			for (const [key, value] of Object.entries(record)) {
				const nextKey = prefix ? `${prefix}.${key}` : key;
				if (typeof value === "string") result[nextKey] = value;
				else if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(result, flattenDictionary(value, nextKey));
			}
			return result;
		}
		//#endregion
		//#region src/types.ts
		const API_BASE = "/api/session-settings";
		const API_ENDPOINTS = {
			getSettings: `${API_BASE}/get-settings`,
			saveSettings: `${API_BASE}/save-settings`,
			deleteSettings: `${API_BASE}/delete-settings`,
			mcpServersList: `${API_BASE}/mcp-servers/list`,
			mcpServersAdd: `${API_BASE}/mcp-servers/add`,
			mcpServersEdit: `${API_BASE}/mcp-servers/edit`,
			mcpServersRm: `${API_BASE}/mcp-servers/rm`,
			mcpServersToolview: `${API_BASE}/mcp-servers/toolview`,
			mcpServersTools: `${API_BASE}/mcp-servers/tools`,
			mcpServersTest: `${API_BASE}/mcp-servers/test`,
			mcpServersImport: `${API_BASE}/mcp-servers/import`,
			skills: `${API_BASE}/skills`,
			skillsContent: `${API_BASE}/skills/content`
		};
		//#endregion
		//#region src/client/types/index.ts
		const LOCALE_NS = "@local/dsh-session-settings";
		//#endregion
		//#region src/client/utils/config.ts
		function isSessionCustomized(sessionConfig) {
			if (!sessionConfig) return false;
			return Boolean(sessionConfig.subagentModel?.mode === "custom" || sessionConfig.subagentModel?.allowAgentSelectModel !== void 0 || sessionConfig.subagentModel?.overrideForkModel !== void 0 || sessionConfig.mcp?.mode === "custom" || sessionConfig.skills?.mode === "custom");
		}
		function resolveEffectiveSubagentModel(sessionConfig, workspaceConfig, globalConfig) {
			const globalCfg = globalConfig?.subagentModel;
			const globalAllow = globalCfg?.allowAgentSelectModel !== false;
			const globalOverrideFork = globalCfg?.overrideForkModel === true;
			const globalResult = globalCfg?.inherit === false && globalCfg?.model ? {
				mode: "custom",
				inherit: false,
				model: globalCfg.model,
				allowAgentSelectModel: globalAllow,
				overrideForkModel: globalOverrideFork
			} : {
				mode: "custom",
				inherit: true,
				allowAgentSelectModel: globalAllow,
				overrideForkModel: globalOverrideFork
			};
			const wsCfg = workspaceConfig?.subagentModel;
			const wsAllow = wsCfg?.allowAgentSelectModel !== void 0 ? wsCfg.allowAgentSelectModel : globalAllow;
			const wsOverrideFork = wsCfg?.overrideForkModel !== void 0 ? wsCfg.overrideForkModel : globalOverrideFork;
			const workspaceResult = wsCfg?.mode === "custom" && wsCfg.inherit === false && wsCfg.model ? {
				mode: "custom",
				inherit: false,
				model: wsCfg.model,
				allowAgentSelectModel: wsAllow,
				overrideForkModel: wsOverrideFork
			} : wsCfg?.mode === "custom" && wsCfg.inherit === true ? {
				mode: "custom",
				inherit: true,
				allowAgentSelectModel: wsAllow,
				overrideForkModel: wsOverrideFork
			} : {
				...globalResult,
				allowAgentSelectModel: wsAllow,
				overrideForkModel: wsOverrideFork
			};
			if (sessionConfig?.subagentModel) {
				const sModel = sessionConfig.subagentModel;
				if (sModel.mode === "custom") return {
					...sModel,
					allowAgentSelectModel: sModel.allowAgentSelectModel !== void 0 ? sModel.allowAgentSelectModel : wsAllow,
					overrideForkModel: sModel.overrideForkModel !== void 0 ? sModel.overrideForkModel : wsOverrideFork
				};
				if (sModel.mode === "workspace") return {
					...workspaceResult,
					allowAgentSelectModel: sModel.allowAgentSelectModel !== void 0 ? sModel.allowAgentSelectModel : wsAllow,
					overrideForkModel: sModel.overrideForkModel !== void 0 ? sModel.overrideForkModel : wsOverrideFork
				};
				if (sModel.mode === "global") return {
					...globalResult,
					allowAgentSelectModel: sModel.allowAgentSelectModel !== void 0 ? sModel.allowAgentSelectModel : globalAllow,
					overrideForkModel: sModel.overrideForkModel !== void 0 ? sModel.overrideForkModel : globalOverrideFork
				};
			}
			if (wsCfg) return workspaceResult;
			return globalResult;
		}
		function resolveEffectiveMcp(sessionConfig, workspaceConfig, globalConfig, availableMcpServers) {
			const defaultMcpIds = (availableMcpServers || []).filter((s) => s.enabledByDefault).map((s) => s.id);
			const globalMcp = globalConfig?.mcp;
			const globalEnabledIds = Array.isArray(globalMcp?.enabledServerIds) ? globalMcp.enabledServerIds : defaultMcpIds;
			const globalToolsMode = globalMcp?.toolsMode || {};
			const globalDisabledTools = globalMcp?.disabledTools || {};
			let mode = "global";
			let enabledServerIds = [];
			let toolsMode = {};
			let disabledTools = {};
			let resolved = false;
			if (sessionConfig?.mcp) {
				const sMcp = sessionConfig.mcp;
				if (sMcp.mode === "custom") {
					mode = "custom";
					enabledServerIds = sMcp.enabledServerIds || [];
					toolsMode = sMcp.toolsMode || {};
					disabledTools = sMcp.disabledTools || {};
					resolved = true;
				} else if (sMcp.mode === "workspace") {
					if (workspaceConfig?.mcp?.mode === "custom") {
						const wsMcp = workspaceConfig.mcp;
						mode = "custom";
						enabledServerIds = wsMcp.enabledServerIds || [];
						toolsMode = wsMcp.toolsMode || {};
						disabledTools = wsMcp.disabledTools || {};
						resolved = true;
					}
				} else if (sMcp.mode === "global") {
					mode = "global";
					enabledServerIds = globalEnabledIds;
					toolsMode = globalToolsMode;
					disabledTools = globalDisabledTools;
					resolved = true;
				}
			}
			if (!resolved && workspaceConfig?.mcp?.mode === "custom") {
				const wsMcp = workspaceConfig.mcp;
				mode = "custom";
				enabledServerIds = wsMcp.enabledServerIds || [];
				toolsMode = wsMcp.toolsMode || {};
				disabledTools = wsMcp.disabledTools || {};
				resolved = true;
			}
			if (!resolved) {
				mode = "global";
				enabledServerIds = globalEnabledIds;
				toolsMode = globalToolsMode;
				disabledTools = globalDisabledTools;
			}
			return {
				mode,
				enabledServerIds,
				toolsMode,
				disabledTools
			};
		}
		function resolveEffectiveSkills(sessionConfig, workspaceConfig, globalConfig) {
			const globalSkills = globalConfig?.skills;
			const globalModelSkills = globalSkills?.disabledModelSkills || [];
			const globalUserSkills = globalSkills?.disabledUserSkills || [];
			let mode = "global";
			let disabledModelSkills = [];
			let disabledUserSkills = [];
			let resolved = false;
			if (sessionConfig?.skills) {
				const sSkills = sessionConfig.skills;
				if (sSkills.mode === "custom") {
					mode = "custom";
					disabledModelSkills = sSkills.disabledModelSkills || [];
					disabledUserSkills = sSkills.disabledUserSkills || [];
					resolved = true;
				} else if (sSkills.mode === "workspace") {
					if (workspaceConfig?.skills?.mode === "custom") {
						const wsSkills = workspaceConfig.skills;
						mode = "custom";
						disabledModelSkills = wsSkills.disabledModelSkills || [];
						disabledUserSkills = wsSkills.disabledUserSkills || [];
						resolved = true;
					}
				} else if (sSkills.mode === "global") {
					mode = "global";
					disabledModelSkills = globalModelSkills;
					disabledUserSkills = globalUserSkills;
					resolved = true;
				}
			}
			if (!resolved && workspaceConfig?.skills?.mode === "custom") {
				const wsSkills = workspaceConfig.skills;
				mode = "custom";
				disabledModelSkills = wsSkills.disabledModelSkills || [];
				disabledUserSkills = wsSkills.disabledUserSkills || [];
				resolved = true;
			}
			if (!resolved) {
				mode = "global";
				disabledModelSkills = globalModelSkills;
				disabledUserSkills = globalUserSkills;
			}
			return {
				mode,
				disabledModelSkills: [...disabledModelSkills],
				disabledUserSkills: [...disabledUserSkills]
			};
		}
		function resolveEffectiveSessionConfig(sessionConfig, workspaceConfig, globalConfig, availableMcpServers) {
			return {
				subagentModel: resolveEffectiveSubagentModel(sessionConfig, workspaceConfig, globalConfig),
				mcp: resolveEffectiveMcp(sessionConfig, workspaceConfig, globalConfig, availableMcpServers),
				skills: resolveEffectiveSkills(sessionConfig, workspaceConfig, globalConfig)
			};
		}
		//#endregion
		//#region src/client/session/hooks/useSessionData.ts
		function useSessionData({ api, remote, sessionId, workspaceId: propWorkspaceId, workspaceTitle: propWorkspaceTitle, useSessions, useWorkspaces }) {
			const sessionsState = react.useMemo(() => {
				if (!useSessions) return null;
				try {
					if (typeof useSessions === "function") return useSessions((s) => s) ?? useSessions() ?? null;
					return useSessions ?? null;
				} catch {
					return null;
				}
			}, [useSessions]);
			const currentSession = (Array.isArray(sessionsState?.items) && sessionId ? sessionsState.items.find((s) => s?.id === sessionId) : void 0) ?? (sessionsState?.byId && sessionId ? sessionsState.byId[sessionId] : null) ?? null;
			const workspacesState = react.useMemo(() => {
				if (!useWorkspaces) return null;
				try {
					if (typeof useWorkspaces === "function") return useWorkspaces((w) => w) ?? useWorkspaces() ?? null;
					return useWorkspaces ?? null;
				} catch {
					return null;
				}
			}, [useWorkspaces]);
			const currentWorkspace = Array.isArray(workspacesState?.items) ? workspacesState.items.find((w) => sessionId && Array.isArray(w?.sessionIds) && w.sessionIds.includes(sessionId) || currentSession?.cwd && (w?.path === currentSession.cwd || w?.cwd === currentSession.cwd) || propWorkspaceId && (w?.workspaceId === propWorkspaceId || w?.id === propWorkspaceId)) ?? (!sessionId && workspacesState?.recentWorkspaceId ? workspacesState.items.find((w) => w.workspaceId === workspacesState.recentWorkspaceId || w.id === workspacesState.recentWorkspaceId) ?? workspacesState.items[0] : null) ?? null : null;
			const currentWorkspaceId = propWorkspaceId ?? currentWorkspace?.workspaceId ?? currentWorkspace?.id;
			const currentWorkspaceTitle = propWorkspaceTitle ?? currentWorkspace?.title ?? currentWorkspace?.name ?? currentWorkspace?.path;
			const [activeNav, setActiveNav] = react.useState("model");
			const [copiedId, setCopiedId] = react.useState(false);
			const [error, setError] = react.useState("");
			const [saveSuccessMsg, setSaveSuccessMsg] = react.useState("");
			const [cloneSourceId, setCloneSourceId] = react.useState("");
			const [cloning, setCloning] = react.useState(false);
			const [cloneError, setCloneError] = react.useState("");
			const [providers, setProviders] = react.useState([]);
			const [loadingModels, setLoadingModels] = react.useState(false);
			const [availableMcpServers, setAvailableMcpServers] = react.useState([]);
			const [availableSkills, setAvailableSkills] = react.useState([]);
			const defaultMode = currentWorkspaceId ? "workspace" : "global";
			const [modelConfig, setModelConfig] = react.useState({ mode: defaultMode });
			const [mcpConfig, setMcpConfig] = react.useState({ mode: defaultMode });
			const [skillsConfig, setSkillsConfig] = react.useState({ mode: defaultMode });
			const [skillsSearch, setSkillsSearch] = react.useState("");
			const [sessionSkillModalTarget, setSessionSkillModalTarget] = react.useState(null);
			const [skillsContentMap, setSkillsContentMap] = react.useState({});
			const [skillsLoadingMap, setSkillsLoadingMap] = react.useState({});
			const [refreshingSkills, setRefreshingSkills] = react.useState(false);
			const [sessionToolsModalServer, setSessionToolsModalServer] = react.useState(null);
			const [sessionToolsMode, setSessionToolsMode] = react.useState("global");
			const [sessionDisabledToolsSet, setSessionDisabledToolsSet] = react.useState(/* @__PURE__ */ new Set());
			const [sessionToolsFetching, setSessionToolsFetching] = react.useState(false);
			const [sessionToolsError, setSessionToolsError] = react.useState("");
			const [sessionToolsList, setSessionToolsList] = react.useState([]);
			const [globalConfig, setGlobalConfig] = react.useState({
				subagentModel: {},
				mcp: { enabledServerIds: [] },
				skills: {
					disabledModelSkills: [],
					disabledUserSkills: []
				}
			});
			const [workspaceSettings, setWorkspaceSettings] = react.useState(void 0);
			const [hasSessionOverride, setHasSessionOverride] = react.useState(false);
			const [setDefaultModalOpen, setSetDefaultModalOpen] = react.useState(false);
			const [setDefaultTargetScope, setSetDefaultTargetScope] = react.useState(currentWorkspaceId ? "workspace" : "global");
			const [isRestoringDefault, setIsRestoringDefault] = react.useState(false);
			const apiRef = react.useRef(api);
			apiRef.current = api;
			const remoteRef = react.useRef(remote);
			remoteRef.current = remote;
			const sessionsMap = react.useMemo(() => {
				const map = {};
				if (sessionsState?.byId) Object.assign(map, sessionsState.byId);
				if (Array.isArray(sessionsState?.items)) {
					for (const s of sessionsState.items) if (s?.id) map[s.id] = s;
				}
				return map;
			}, [sessionsState]);
			react.useEffect(() => {
				let mounted = true;
				async function loadModels() {
					const remoteSession = remoteRef.current?.session;
					if (typeof remoteSession?.modelCatalog !== "function") return;
					setLoadingModels(true);
					try {
						const catalogRes = await remoteSession.modelCatalog();
						if (mounted && catalogRes?.ok && Array.isArray(catalogRes.value?.groups)) setProviders(catalogRes.value.groups);
					} catch {} finally {
						if (mounted) setLoadingModels(false);
					}
				}
				async function loadMcpServers() {
					try {
						const res = await fetch(API_ENDPOINTS.mcpServersList);
						if (res.ok && mounted) {
							const data = await res.json();
							if (data && data.ok && Array.isArray(data.servers)) setAvailableMcpServers(data.servers);
						}
					} catch {}
				}
				async function loadSkills() {
					try {
						const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
						const res = await fetch(`${API_ENDPOINTS.skills}${qs}`);
						if (res.ok && mounted) {
							const data = await res.json();
							if (data && data.ok && Array.isArray(data.skills)) setAvailableSkills(data.skills);
						}
					} catch {}
				}
				async function loadSessionSettings() {
					try {
						const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
						const url = `${API_ENDPOINTS.getSettings}${qs}`;
						const res = await fetch(url);
						if (res.ok && mounted) {
							const data = await res.json();
							if (data && data.ok) {
								if (data.globalConfig) setGlobalConfig(data.globalConfig);
								if (data.workspaceConfig && (data.workspaceId || currentWorkspaceId)) setWorkspaceSettings(data.workspaceConfig);
								else setWorkspaceSettings(void 0);
								if (data.sessionConfig && sessionId) {
									setModelConfig(data.sessionConfig.subagentModel);
									setMcpConfig(data.sessionConfig.mcp);
									setSkillsConfig(data.sessionConfig.skills);
									setHasSessionOverride(isSessionCustomized(data.sessionConfig));
								} else if (!sessionId && data.globalConfig) {
									setModelConfig({
										mode: "global",
										...data.globalConfig.subagentModel?.inherit === false && data.globalConfig.subagentModel.model ? {
											inherit: false,
											model: data.globalConfig.subagentModel.model
										} : { inherit: true },
										allowAgentSelectModel: data.globalConfig.subagentModel?.allowAgentSelectModel !== false,
										overrideForkModel: data.globalConfig.subagentModel?.overrideForkModel === true
									});
									setMcpConfig({
										mode: "global",
										enabledServerIds: data.globalConfig.mcp?.enabledServerIds || []
									});
									setSkillsConfig({
										mode: "global",
										disabledModelSkills: data.globalConfig.skills?.disabledModelSkills || [],
										disabledUserSkills: data.globalConfig.skills?.disabledUserSkills || []
									});
									setHasSessionOverride(false);
								}
							}
						}
					} catch {}
				}
				async function loadData() {
					await Promise.all([
						loadModels(),
						loadMcpServers(),
						loadSkills(),
						loadSessionSettings()
					]);
				}
				loadData();
				return () => {
					mounted = false;
				};
			}, [sessionId, currentWorkspaceId]);
			return {
				currentSession,
				currentWorkspace,
				currentWorkspaceId,
				currentWorkspaceTitle,
				activeNav,
				setActiveNav,
				copiedId,
				setCopiedId,
				error,
				setError,
				saveSuccessMsg,
				setSaveSuccessMsg,
				cloneSourceId,
				setCloneSourceId,
				cloning,
				setCloning,
				cloneError,
				setCloneError,
				providers,
				setProviders,
				loadingModels,
				availableMcpServers,
				setAvailableMcpServers,
				availableSkills,
				setAvailableSkills,
				modelConfig,
				setModelConfig,
				mcpConfig,
				setMcpConfig,
				skillsConfig,
				setSkillsConfig,
				skillsSearch,
				setSkillsSearch,
				sessionSkillModalTarget,
				setSessionSkillModalTarget,
				skillsContentMap,
				setSkillsContentMap,
				skillsLoadingMap,
				setSkillsLoadingMap,
				refreshingSkills,
				setRefreshingSkills,
				sessionToolsModalServer,
				setSessionToolsModalServer,
				sessionToolsMode,
				setSessionToolsMode,
				sessionDisabledToolsSet,
				setSessionDisabledToolsSet,
				sessionToolsFetching,
				setSessionToolsFetching,
				sessionToolsError,
				setSessionToolsError,
				sessionToolsList,
				setSessionToolsList,
				globalConfig,
				setGlobalConfig,
				workspaceSettings,
				setWorkspaceSettings,
				hasSessionOverride,
				setHasSessionOverride,
				setDefaultModalOpen,
				setSetDefaultModalOpen,
				setDefaultTargetScope,
				setSetDefaultTargetScope,
				isRestoringDefault,
				setIsRestoringDefault,
				sessionsMap
			};
		}
		//#endregion
		//#region src/client/session/hooks/useSessionActions.ts
		function useSessionActions({ sessionId, currentWorkspaceId, currentWorkspaceTitle, modelConfig, mcpConfig, skillsConfig, globalConfig, setModelConfig, setMcpConfig, setSkillsConfig, setGlobalConfig, setWorkspaceSettings, setHasSessionOverride, setSaveSuccessMsg, setError, setSetDefaultModalOpen, setIsRestoringDefault, cloneSourceId, setCloneSourceId, setCloning, setCloneError, setCopiedId, sessionsMap, onSave, t }) {
			const [saving, setSaving] = react.useState(false);
			const [savingDefault, setSavingDefault] = react.useState(false);
			const handleCopySessionId = async () => {
				if (!sessionId) return;
				try {
					if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(sessionId);
					else {
						const textarea = document.createElement("textarea");
						textarea.value = sessionId;
						document.body.appendChild(textarea);
						textarea.select();
						document.execCommand("copy");
						textarea.remove();
					}
					setCopiedId(true);
					setTimeout(() => setCopiedId(false), 2e3);
				} catch {}
			};
			const handleClonePreset = async () => {
				const targetSourceId = cloneSourceId.trim();
				if (!targetSourceId) return;
				if (sessionId && targetSourceId === sessionId) {
					setCloneError(t("sessionSettings.clone.cannotCloneSelf"));
					return;
				}
				setCloning(true);
				setCloneError("");
				setSaveSuccessMsg("");
				try {
					const res = await fetch(`${API_ENDPOINTS.getSettings}?sessionId=${encodeURIComponent(targetSourceId)}`);
					if (!res.ok) {
						setCloneError(t("sessionSettings.clone.error"));
						return;
					}
					const data = await res.json();
					if (data && data.ok) {
						const sourceConfig = resolveEffectiveSessionConfig(data.sessionConfig, data.workspaceConfig, data.globalConfig);
						if (sourceConfig.subagentModel) setModelConfig(sourceConfig.subagentModel);
						if (sourceConfig.mcp) setMcpConfig(sourceConfig.mcp);
						if (sourceConfig.skills) setSkillsConfig(sourceConfig.skills);
						const sourceTitle = sessionsMap[targetSourceId]?.title || targetSourceId.slice(0, 8);
						setCloneSourceId("");
						setSaveSuccessMsg(t("sessionSettings.clone.success", { name: sourceTitle }));
					} else setCloneError(t("sessionSettings.clone.error"));
				} catch (err) {
					setCloneError(t("sessionSettings.clone.error") + ": " + (err instanceof Error ? err.message : String(err)));
				} finally {
					setCloning(false);
				}
			};
			const handleSave = async () => {
				setSaving(true);
				setSaveSuccessMsg("");
				setError("");
				const payloadConfig = {
					subagentModel: modelConfig,
					mcp: mcpConfig,
					skills: skillsConfig
				};
				try {
					const res = await fetch(API_ENDPOINTS.saveSettings, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							sessionId,
							config: payloadConfig
						})
					});
					const data = await res.json();
					if (res.ok && data?.ok) {
						if (sessionId) {
							setHasSessionOverride(isSessionCustomized(payloadConfig));
							setSaveSuccessMsg(t("sessionSettings.notice.saved"));
						}
						if (onSave) onSave(payloadConfig);
						setTimeout(() => setSaveSuccessMsg(""), 3e3);
					} else setError(t("sessionSettings.notice.error") + (data?.error || "Unknown error"));
				} catch (err) {
					setError(t("sessionSettings.notice.error") + (err instanceof Error ? err.message : String(err)));
				} finally {
					setSaving(false);
				}
			};
			const handleApplySetDefault = async (setDefaultTargetScope, isRestoringDefault) => {
				setSavingDefault(true);
				setSaveSuccessMsg("");
				setError("");
				try {
					if (setDefaultTargetScope === "global") {
						const payloadGlobalConfig = isRestoringDefault ? {
							subagentModel: {},
							mcp: { enabledServerIds: [] },
							skills: {
								disabledModelSkills: [],
								disabledUserSkills: []
							}
						} : {
							subagentModel: modelConfig.mode === "custom" && !modelConfig.inherit && modelConfig.model?.provider && modelConfig.model?.model ? {
								inherit: false,
								model: modelConfig.model,
								allowAgentSelectModel: modelConfig.allowAgentSelectModel,
								overrideForkModel: modelConfig.overrideForkModel
							} : modelConfig.mode === "custom" ? {
								inherit: true,
								allowAgentSelectModel: modelConfig.allowAgentSelectModel,
								overrideForkModel: modelConfig.overrideForkModel
							} : {
								...globalConfig.subagentModel ?? { inherit: true },
								...modelConfig.allowAgentSelectModel !== void 0 ? { allowAgentSelectModel: modelConfig.allowAgentSelectModel } : {},
								...modelConfig.overrideForkModel !== void 0 ? { overrideForkModel: modelConfig.overrideForkModel } : {}
							},
							mcp: mcpConfig.mode === "custom" ? {
								enabledServerIds: mcpConfig.enabledServerIds ?? [],
								toolsMode: mcpConfig.toolsMode,
								disabledTools: mcpConfig.disabledTools
							} : globalConfig.mcp ?? { enabledServerIds: [] },
							skills: skillsConfig.mode === "custom" ? {
								disabledModelSkills: skillsConfig.disabledModelSkills ?? [],
								disabledUserSkills: skillsConfig.disabledUserSkills ?? []
							} : globalConfig.skills ?? {
								disabledModelSkills: [],
								disabledUserSkills: []
							}
						};
						const res = await fetch(API_ENDPOINTS.saveSettings, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								isDefault: true,
								globalConfig: payloadGlobalConfig,
								isRestoringDefault
							})
						});
						const data = await res.json();
						if (res.ok && data?.ok) {
							setGlobalConfig(payloadGlobalConfig);
							setSaveSuccessMsg(t("sessionSettings.notice.savedDefault"));
							setSetDefaultModalOpen(false);
							setIsRestoringDefault(false);
							setTimeout(() => setSaveSuccessMsg(""), 3e3);
						} else setError(t("sessionSettings.notice.error") + (data?.error || "Unknown error"));
					} else {
						const payloadConfig = isRestoringDefault ? {
							subagentModel: { mode: "global" },
							mcp: { mode: "global" },
							skills: { mode: "global" }
						} : {
							subagentModel: modelConfig,
							mcp: mcpConfig,
							skills: skillsConfig
						};
						const res = await fetch(API_ENDPOINTS.saveSettings, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								sessionId,
								config: payloadConfig,
								isWorkspaceDefault: true,
								isRestoringDefault
							})
						});
						const data = await res.json();
						if (res.ok && data?.ok) {
							if (isRestoringDefault) setWorkspaceSettings(void 0);
							else setWorkspaceSettings(payloadConfig);
							setSaveSuccessMsg(t("sessionSettings.notice.savedWorkspace", { name: currentWorkspaceTitle || currentWorkspaceId || "" }));
							setSetDefaultModalOpen(false);
							setIsRestoringDefault(false);
							if (onSave) onSave(payloadConfig);
							setTimeout(() => setSaveSuccessMsg(""), 3e3);
						} else setError(t("sessionSettings.notice.error") + (data?.error || "Unknown error"));
					}
				} catch (err) {
					setError(t("sessionSettings.notice.error") + (err instanceof Error ? err.message : String(err)));
				} finally {
					setSavingDefault(false);
				}
			};
			const handleResetSession = async () => {
				if (!sessionId) return;
				setSaving(true);
				setSaveSuccessMsg("");
				setError("");
				try {
					const res = await fetch(`${API_ENDPOINTS.deleteSettings}?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
					const data = await res.json();
					if (res.ok && data?.ok) {
						const defaultMode = currentWorkspaceId ? "workspace" : "global";
						setModelConfig({ mode: defaultMode });
						setMcpConfig({ mode: defaultMode });
						setSkillsConfig({ mode: defaultMode });
						setHasSessionOverride(false);
						setSaveSuccessMsg(t("sessionSettings.notice.saved"));
						if (onSave) onSave(resolveEffectiveSessionConfig(data.sessionConfig, data.workspaceConfig, data.globalConfig));
						setTimeout(() => setSaveSuccessMsg(""), 3e3);
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			return {
				saving,
				savingDefault,
				handleCopySessionId,
				handleClonePreset,
				handleSave,
				handleApplySetDefault,
				handleResetSession
			};
		}
		//#endregion
		//#region src/client/session/sections/HeaderBar.ts
		const e$27 = react.createElement;
		function HeaderBar({ sessionId, copiedId, currentWorkspaceId, currentWorkspaceTitle, currentWorkspace, hasSessionOverride, cloneSourceId, cloning, onCloneSourceIdChange, onCopySessionId, onClonePreset, onClose, t }) {
			const hasMeta = Boolean(sessionId || currentWorkspaceTitle);
			return e$27("div", { className: "dsh-session-view-header" }, e$27("div", { className: "dsh-session-view-header-top" }, e$27("h2", { className: "dsh-session-view-title" }, t("sessionSettings.title")), onClose ? e$27("button", {
				type: "button",
				className: "dsh-sam-close-btn",
				onClick: onClose,
				title: t("sessionSettings.action.close")
			}, e$27(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 16 })) : null), sessionId ? e$27("div", { className: "dsh-clone-toolbar" }, e$27("span", { className: "dsh-clone-label" }, t("sessionSettings.clone.toolbarTitle")), e$27("input", {
				type: "text",
				className: "dsh-clone-input",
				placeholder: t("sessionSettings.clone.inputPlaceholder"),
				value: cloneSourceId,
				onChange: (evt) => onCloneSourceIdChange(evt.target.value),
				onKeyDown: (evt) => {
					if (evt.key === "Enter") onClonePreset();
				}
			}), e$27("button", {
				type: "button",
				className: "dsh-sam-btn secondary dsh-clone-btn",
				disabled: cloning || !cloneSourceId.trim(),
				onClick: onClonePreset
			}, cloning ? e$27(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
				size: 13,
				className: "dsh-spin"
			}) : e$27(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, {
				size: 13,
				className: "dsh-btn-icon-left"
			}), cloning ? t("sessionSettings.clone.loading") : t("sessionSettings.clone.applyBtn"))) : null, hasMeta ? e$27("div", { className: "dsh-session-view-header-meta" }, sessionId ? e$27("button", {
				type: "button",
				className: `dsh-session-id-chip ${copiedId ? "copied" : ""}`,
				onClick: onCopySessionId,
				title: t("sessionSettings.action.copyId")
			}, copiedId ? e$27(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 13 }) : e$27(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, { size: 13 }), e$27("span", null, copiedId ? t("sessionSettings.idCopied") : sessionId)) : null, currentWorkspaceTitle ? e$27("span", {
				className: "dsh-session-id-chip dsh-header-workspace-chip",
				title: currentWorkspace?.path || currentWorkspaceTitle
			}, `${t("sessionSettings.scope.workspaceLabel")}: ${currentWorkspaceTitle}`) : null, sessionId ? e$27("span", { className: `dsh-sam-status-badge badge-${hasSessionOverride ? "custom" : currentWorkspaceId ? "workspace" : "default"}` }, hasSessionOverride ? t("sessionSettings.scope.sessionCustom") : currentWorkspaceId ? t("sessionSettings.scope.sessionWorkspace") : t("sessionSettings.scope.sessionDefault")) : null) : null);
		}
		//#endregion
		//#region src/client/session/sections/NavigationSidebar.ts
		const e$26 = react.createElement;
		function NavigationSidebar({ activeNav, onNavChange, modelConfig, effectiveActiveMcpCount, effectiveActiveSkillsCount, availableSkills, t }) {
			return e$26("div", { className: "dsh-session-view-sidebar" }, e$26("button", {
				type: "button",
				className: `dsh-view-sidebar-item ${activeNav === "model" ? "active" : ""}`,
				onClick: () => onNavChange("model")
			}, e$26("div", { className: "dsh-view-item-icon" }, e$26(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutline16, { size: 16 })), e$26("span", { className: "dsh-view-item-title" }, t("sessionSettings.nav.modelTitle")), e$26("span", { className: "dsh-view-item-badge" }, modelConfig.mode === "custom" ? modelConfig.inherit ? t("sessionSettings.status.inherit") : modelConfig.model?.model || t("sessionSettings.status.custom") : modelConfig.mode === "workspace" ? t("sessionSettings.status.workspace") : t("sessionSettings.status.default"))), e$26("button", {
				type: "button",
				className: `dsh-view-sidebar-item ${activeNav === "mcp" ? "active" : ""}`,
				onClick: () => onNavChange("mcp")
			}, e$26("div", { className: "dsh-view-item-icon" }, e$26(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutline16, { size: 16 })), e$26("span", { className: "dsh-view-item-title" }, t("sessionSettings.nav.mcpTitle")), e$26("span", { className: `dsh-view-item-badge ${effectiveActiveMcpCount > 0 ? "highlight" : ""}` }, effectiveActiveMcpCount > 0 ? `${effectiveActiveMcpCount} MCP` : t("sessionSettings.status.none"))), e$26("button", {
				type: "button",
				className: `dsh-view-sidebar-item ${activeNav === "skills" ? "active" : ""}`,
				onClick: () => onNavChange("skills")
			}, e$26("div", { className: "dsh-view-item-icon" }, e$26(_deepseek_ai_dsh_client_ui_primitives.IconSkillOutline16, { size: 16 })), e$26("span", { className: "dsh-view-item-title" }, t("sessionSettings.nav.skillsTitle")), e$26("span", { className: `dsh-view-item-badge ${effectiveActiveSkillsCount > 0 ? "highlight" : ""}` }, availableSkills.length > 0 ? `${effectiveActiveSkillsCount}/${availableSkills.length}` : t("sessionSettings.status.none"))));
		}
		//#endregion
		//#region src/client/components/Badge.ts
		const e$25 = react.createElement;
		function Badge({ label, variant = "default", title, className = "", style, icon }) {
			let baseClass = "dsh-sam-title-badge";
			if (variant.startsWith("source-") || variant.startsWith("status-")) baseClass = "dsh-skill-badge";
			else if (variant === "stdio" || variant === "sse" || variant === "streamable-http" || variant === "streamable-http-or-sse" || variant === "http" || variant === "timeout" || variant === "disabled-tools" || variant === "server-version" || variant === "count") baseClass = "dsh-mcp-proto-badge";
			else if (variant === "tool-active") {
				baseClass = "dsh-mcp-tool-status-pill active";
				variant = "";
			} else if (variant === "tool-disabled") {
				baseClass = "dsh-mcp-tool-status-pill disabled";
				variant = "";
			}
			const fullClassName = [
				baseClass,
				variant,
				className
			].filter(Boolean).join(" ");
			return e$25("span", {
				className: fullClassName,
				title,
				style
			}, icon ? e$25("span", { style: {
				marginRight: 4,
				display: "inline-flex",
				alignItems: "center"
			} }, icon) : null, label);
		}
		//#endregion
		//#region src/client/components/ItemToggleCard.ts
		const e$24 = react.createElement;
		function ItemToggleCard({ id, icon, title, badges = [], description, className = "", style, onClick }) {
			return e$24("div", {
				id,
				"data-id": id,
				className: `dsh-mcp-tool-card ${className}`.trim(),
				style: {
					...onClick ? { cursor: "pointer" } : {},
					...style
				},
				onClick
			}, e$24("div", { className: "dsh-mcp-tool-card-main" }, e$24("div", { className: "dsh-mcp-tool-card-left" }, e$24("div", { className: "dsh-mcp-tool-info" }, e$24("div", { className: "dsh-mcp-tool-title-row" }, icon ? e$24("span", { style: {
				display: "inline-flex",
				alignItems: "center",
				marginRight: 2
			} }, icon) : null, typeof title === "string" ? e$24("span", { className: "dsh-mcp-tool-name" }, title) : title, badges.map((b, idx) => e$24(Badge, {
				key: idx,
				label: b.label,
				variant: b.variant,
				className: b.className,
				title: b.title
			}))), description ? typeof description === "string" ? e$24("p", { className: "dsh-mcp-tool-desc" }, description) : description : null))));
		}
		//#endregion
		//#region src/client/components/ModeSelector.ts
		const e$23 = react.createElement;
		function ModeSelector({ name, value, onChange, options, className = "dsh-sam-mode-list" }) {
			const visibleOptions = options.filter((opt) => opt.visible !== false);
			return e$23("div", { className }, visibleOptions.map((opt) => {
				const isSelected = opt.value === value;
				return e$23("label", {
					key: opt.value,
					className: `dsh-sam-mode-item ${isSelected ? "selected" : ""} ${opt.disabled ? "disabled" : ""}`,
					style: opt.disabled ? {
						opacity: .6,
						cursor: "not-allowed"
					} : void 0
				}, e$23("input", {
					type: "radio",
					name,
					value: opt.value,
					checked: isSelected,
					disabled: opt.disabled,
					onChange: () => {
						if (!opt.disabled) onChange(opt.value);
					}
				}), e$23("div", { className: "dsh-sam-mode-text" }, e$23("div", { className: "dsh-sam-mode-title-row" }, typeof opt.title === "string" ? e$23("span", { className: "dsh-sam-mode-title" }, opt.title) : opt.title, (opt.badges || []).map((b, idx) => e$23(Badge, {
					key: idx,
					label: b.label,
					variant: b.variant,
					className: b.className
				}))), opt.desc ? typeof opt.desc === "string" ? e$23("div", { className: "dsh-sam-mode-desc" }, opt.desc) : opt.desc : null));
			}));
		}
		//#endregion
		//#region src/client/components/SearchToolbar.ts
		const e$22 = react.createElement;
		function SearchToolbar({ value, onChange, placeholder = "搜索...", statsText, actions, className = "dsh-mcp-tools-toolbar", inputClassName = "dsh-sam-input dsh-mcp-search-input" }) {
			return e$22("div", { className }, e$22("div", { className: "dsh-mcp-search-wrap dsh-mcp-tools-search-box" }, e$22(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, {
				size: 14,
				className: "dsh-mcp-search-icon"
			}), e$22("input", {
				type: "text",
				className: inputClassName,
				placeholder,
				value,
				onChange: (evt) => onChange(evt.target.value)
			})), statsText ? e$22("div", { className: "dsh-mcp-tools-stats-bar" }, statsText) : null, actions ? e$22("div", { className: "dsh-mcp-tools-toolbar-actions" }, actions) : null);
		}
		//#endregion
		//#region src/client/components/ModalDialog.ts
		const e$21 = react.createElement;
		function ModalDialog({ open, onClose, title, subtitle, icon, headerExtra, panelClassName = "", overlayClassName = "dsh-sam-modal-overlay", children, footer, role = "dialog", ariaLabel, closeTitle }) {
			react.useEffect(() => {
				if (!open) return;
				const handleKeyDown = (evt) => {
					if (evt.key === "Escape") onClose();
				};
				window.addEventListener("keydown", handleKeyDown);
				return () => window.removeEventListener("keydown", handleKeyDown);
			}, [open, onClose]);
			if (!open) return null;
			const resolvedPanelClassName = Array.from(/* @__PURE__ */ new Set(["dsh-sam-modal-panel", ...panelClassName ? panelClassName.trim().split(/\s+/) : []])).join(" ");
			return e$21("div", {
				className: overlayClassName,
				onClick: (evt) => {
					if (evt.target === evt.currentTarget) onClose();
				}
			}, e$21("div", {
				className: resolvedPanelClassName,
				role,
				"aria-modal": true,
				"aria-label": ariaLabel || (typeof title === "string" ? title : void 0)
			}, e$21("div", { className: "dsh-sam-header-row" }, e$21("div", { className: "dsh-mcp-tools-header-info" }, e$21("h3", {
				className: "dsh-sam-title",
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8
				}
			}, icon, title), headerExtra ? e$21("div", { className: "dsh-mcp-tools-header-meta" }, headerExtra) : null), e$21("button", {
				type: "button",
				className: "dsh-sam-close-btn",
				onClick: onClose,
				title: closeTitle
			}, e$21(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 16 }))), subtitle ? e$21("div", { className: "dsh-sam-modal-subtitle" }, e$21("p", { className: "dsh-sam-desc" }, subtitle)) : null, e$21("div", { className: "dsh-sam-modal-body" }, children), footer ? e$21("div", { className: "dsh-sam-actions dsh-mcp-modal-footer" }, footer) : null));
		}
		//#endregion
		//#region src/client/components/EmptyState.ts
		const e$20 = react.createElement;
		function EmptyState({ message, icon, action, className = "dsh-mcp-empty-card", style }) {
			return e$20("div", {
				className,
				style
			}, icon ? e$20("div", { className: "dsh-mcp-empty-icon" }, icon) : null, typeof message === "string" ? e$20("p", { className: "dsh-mcp-empty-text" }, message) : message, action);
		}
		//#endregion
		//#region src/client/utils/schema.ts
		function parseToolParameters(schema) {
			if (!schema || typeof schema !== "object") return [];
			const properties = schema.properties;
			if (!properties || typeof properties !== "object") return [];
			const requiredList = Array.isArray(schema.required) ? schema.required : [];
			const requiredSet = new Set(requiredList.filter((k) => typeof k === "string"));
			const items = [];
			for (const [name, rawProp] of Object.entries(properties)) {
				if (!rawProp || typeof rawProp !== "object") {
					items.push({
						name,
						type: "any",
						required: requiredSet.has(name)
					});
					continue;
				}
				const prop = rawProp;
				const typeStr = typeof prop.type === "string" ? prop.type : prop.enum ? "enum" : prop.oneOf || prop.anyOf ? "union" : "any";
				items.push({
					name,
					type: String(typeStr),
					required: requiredSet.has(name),
					description: typeof prop.description === "string" ? prop.description : void 0,
					default: prop.default,
					enum: Array.isArray(prop.enum) ? prop.enum.filter((e) => typeof e === "string") : void 0
				});
			}
			return items;
		}
		//#endregion
		//#region src/client/utils/string.ts
		function capitalize(s) {
			if (!s) return "";
			return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
		}
		function effortLabel(t, effortId) {
			const translated = t(`sessionSettings.field.reasoning${capitalize(effortId)}`);
			return translated && !translated.startsWith("sessionSettings.field.") ? translated : effortId;
		}
		function formatProtocolTitle(info, t) {
			if (!info) return void 0;
			const parts = [];
			if (info.name) parts.push(info.name);
			if (info.version) parts.push(info.version);
			if (info.protocolVersion) {
				let protoStr = `MCP Protocol: ${info.protocolVersion}`;
				if (info.supportedVersions && info.supportedVersions.length > 0) {
					const vers = info.supportedVersions.join(", ");
					protoStr += t ? t("mcpServers.supportedVersions", { versions: vers }) : ` (Supported: ${vers})`;
				}
				parts.push(protoStr);
			}
			return parts.join(" | ") || void 0;
		}
		//#endregion
		//#region src/client/utils/skillSource.ts
		function getSkillSourceMeta(skill, t) {
			if (!skill) return {
				sourceClass: "source-user",
				sourceLabel: t("sessionSettings.skills.sourceUser")
			};
			const isRuntime = Boolean(skill.isRuntime);
			const source = (skill.source || "").toLowerCase();
			if (isRuntime) return {
				sourceClass: "source-runtime",
				sourceLabel: t("sessionSettings.skills.sourceRuntime")
			};
			if (source.includes("project")) return {
				sourceClass: "source-project",
				sourceLabel: t("sessionSettings.skills.sourceProject")
			};
			if (source.includes("user")) return {
				sourceClass: "source-user",
				sourceLabel: t("sessionSettings.skills.sourceUser")
			};
			if (source === "bundled") return {
				sourceClass: "source-bundled",
				sourceLabel: t("sessionSettings.skills.sourceBundled")
			};
			return {
				sourceClass: "source-runtime",
				sourceLabel: t("sessionSettings.skills.sourceRuntime")
			};
		}
		//#endregion
		//#region src/client/components/SchemaViewer.ts
		const e$19 = react.createElement;
		function SchemaViewer({ schema, mode = "list", onModeChange, t }) {
			const [internalMode, setInternalMode] = react.useState(mode);
			const currentMode = onModeChange ? mode : internalMode;
			const setMode = onModeChange || setInternalMode;
			if (!schema || Object.keys(schema).length === 0) return e$19("div", { className: "dsh-mcp-tool-expanded-box" }, e$19("div", { className: "dsh-mcp-param-desc" }, t("mcpServers.toolsModal.noParams")));
			const params = parseToolParameters(schema);
			const requiredCount = params.filter((p) => p.required).length;
			return e$19("div", { className: "dsh-mcp-tool-expanded-box" }, e$19("div", { className: "dsh-mcp-tool-expanded-header" }, e$19("span", { className: "dsh-mcp-tool-param-stats" }, t("mcpServers.toolsModal.paramsCount", {
				total: params.length,
				required: requiredCount
			})), e$19("div", { className: "dsh-mcp-tool-view-switch" }, e$19("button", {
				type: "button",
				className: `dsh-mcp-seg-btn ${currentMode === "list" ? "active" : ""}`,
				onClick: (evt) => {
					evt.stopPropagation();
					setMode("list");
				}
			}, t("mcpServers.toolsModal.viewList")), e$19("button", {
				type: "button",
				className: `dsh-mcp-seg-btn ${currentMode === "raw" ? "active" : ""}`,
				onClick: (evt) => {
					evt.stopPropagation();
					setMode("raw");
				}
			}, t("mcpServers.toolsModal.viewRaw")))), currentMode === "raw" ? e$19("pre", { className: "dsh-mcp-tool-schema-preview" }, JSON.stringify(schema, null, 2)) : e$19("div", { className: "dsh-mcp-tool-params-list" }, params.length === 0 ? e$19("div", { className: "dsh-mcp-param-desc" }, t("mcpServers.toolsModal.noParameters")) : params.map((param) => e$19("div", {
				key: param.name,
				className: "dsh-mcp-param-row"
			}, e$19("div", { className: "dsh-mcp-param-top" }, e$19("span", { className: "dsh-mcp-param-name" }, param.name), e$19("span", { className: "dsh-mcp-param-type" }, param.type), param.required ? e$19("span", { className: "dsh-mcp-param-badge required" }, t("mcpServers.toolsModal.required")) : e$19("span", { className: "dsh-mcp-param-badge optional" }, t("mcpServers.toolsModal.optional")), param.default !== void 0 && e$19("span", { className: "dsh-mcp-param-default" }, `${t("mcpServers.toolsModal.defaultVal")}${JSON.stringify(param.default)}`)), param.description && e$19("div", { className: "dsh-mcp-param-desc" }, param.description), Array.isArray(param.enum) && param.enum.length > 0 && e$19("div", { className: "dsh-mcp-param-enum" }, `${t("mcpServers.toolsModal.enumVal")}${param.enum.join(" | ")}`)))));
		}
		//#endregion
		//#region src/client/components/KeyValueEditor.ts
		const e$18 = react.createElement;
		function KeyValueEditor({ entries, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value", addLabel = "Add Item" }) {
			const handleKeyChange = (index, nextKey) => {
				const next = [...entries];
				next[index] = {
					...next[index],
					key: nextKey
				};
				onChange(next);
			};
			const handleValueChange = (index, nextVal) => {
				const next = [...entries];
				next[index] = {
					...next[index],
					value: nextVal
				};
				onChange(next);
			};
			const handleDelete = (index) => {
				onChange(entries.filter((_, i) => i !== index));
			};
			const handleAdd = () => {
				onChange([...entries, {
					key: "",
					value: ""
				}]);
			};
			return e$18("div", { className: "dsh-mcp-kv-list" }, entries.map((entry, idx) => e$18("div", {
				key: idx,
				className: "dsh-mcp-kv-row"
			}, e$18("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: keyPlaceholder,
				value: entry.key,
				onChange: (evt) => handleKeyChange(idx, evt.target.value)
			}), e$18("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: valuePlaceholder,
				value: entry.value,
				onChange: (evt) => handleValueChange(idx, evt.target.value)
			}), e$18("button", {
				type: "button",
				className: "dsh-mcp-kv-del-btn",
				onClick: () => handleDelete(idx),
				title: "Delete"
			}, e$18(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16)))), e$18("button", {
				type: "button",
				className: "dsh-mcp-add-btn",
				onClick: handleAdd
			}, `+ ${addLabel}`));
		}
		//#endregion
		//#region src/client/components/ServerIcon.ts
		const e$17 = react.createElement;
		function ServerIcon({ server, serverInfo, transport, size = 16, className = "", style }) {
			const [imgError, setImgError] = react.useState(false);
			const info = serverInfo || server?.serverInfo;
			const iconSrc = !imgError && info?.icons && info.icons.length > 0 ? info.icons[0].src : void 0;
			react.useEffect(() => {
				setImgError(false);
			}, [iconSrc]);
			const isStdio = (transport || server?.transport || "streamable-http") === "stdio";
			if (iconSrc) return e$17("img", {
				src: iconSrc,
				alt: info?.title || info?.name || server?.name || server?.id || "MCP Server Icon",
				className: `dsh-mcp-custom-icon ${className}`.trim(),
				style: {
					width: size,
					height: size,
					objectFit: "contain",
					borderRadius: "4px",
					flexShrink: 0,
					...style
				},
				onError: () => setImgError(true)
			});
			const fallbackIcon = isStdio ? e$17(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutline16, {
				size,
				className
			}) : e$17(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutline16, {
				size,
				className
			});
			if (style) return e$17("span", { style: {
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				...style
			} }, fallbackIcon);
			return fallbackIcon;
		}
		//#endregion
		//#region src/client/session/sections/SubagentModelSection.ts
		const e$16 = react.createElement;
		function SubagentModelSection({ modelConfig, providers, loadingModels = false, currentWorkspaceId, workspaceSettings, globalConfig, onModelModeChange, onProviderChange, onModelSelectChange, onReasoningEffortChange, onAllowAgentSelectModelChange, onOverrideForkModelChange, t }) {
			const currentProvider = modelConfig.model?.provider || "";
			const currentModel = modelConfig.model?.model || "";
			const currentEffort = modelConfig.model?.reasoningEffort || "";
			const currentProviderGroup = Array.isArray(providers) ? providers.find((g) => g.id === currentProvider) : null;
			const availableEfforts = (Array.isArray(currentProviderGroup?.models) ? currentProviderGroup.models.find((m) => m.id === currentModel) : null)?.reasoning?.efforts ?? [];
			const hasGlobalCustomModel = Boolean(globalConfig?.subagentModel?.inherit === false && globalConfig?.subagentModel?.model?.provider && globalConfig?.subagentModel?.model?.model);
			const effectiveModelConfig = resolveEffectiveSubagentModel({
				subagentModel: modelConfig,
				mcp: {},
				skills: {}
			}, workspaceSettings, globalConfig);
			const isAllowAgentSelect = effectiveModelConfig.allowAgentSelectModel !== false;
			const isOverrideFork = effectiveModelConfig.overrideForkModel === true;
			const defaultMode = currentWorkspaceId ? "workspace" : "global";
			const selectedModeValue = modelConfig.mode === "custom" ? modelConfig.inherit ? "inherit" : "custom" : modelConfig.mode ?? defaultMode;
			return e$16("div", { className: "dsh-view-content-inner" }, e$16("div", { className: "dsh-section-header" }, e$16("h3", { className: "dsh-section-title" }, t("sessionSettings.section.modelTitle")), e$16("p", { className: "dsh-section-desc" }, t("sessionSettings.section.modelDesc"))), e$16(ModeSelector, {
				name: "subagentModelMode",
				value: selectedModeValue,
				onChange: (val) => onModelModeChange(val),
				options: [
					{
						value: "workspace",
						visible: Boolean(currentWorkspaceId),
						title: t("sessionSettings.mode.workspace.title"),
						badges: [workspaceSettings?.subagentModel?.mode === "custom" ? workspaceSettings.subagentModel.inherit ? {
							label: t("sessionSettings.badge.inherit"),
							variant: "inherit"
						} : {
							label: `${t("sessionSettings.badge.custom")}: ${workspaceSettings.subagentModel.model?.provider || ""} / ${workspaceSettings.subagentModel.model?.model || ""}`,
							variant: "custom"
						} : hasGlobalCustomModel ? {
							label: `${t("sessionSettings.badge.custom")}: ${globalConfig?.subagentModel?.model?.provider || ""} / ${globalConfig?.subagentModel?.model?.model || ""}`,
							variant: "custom"
						} : {
							label: t("sessionSettings.badge.inherit"),
							variant: "inherit"
						}],
						desc: t("sessionSettings.mode.workspace.desc")
					},
					{
						value: "global",
						title: t("sessionSettings.mode.default.title"),
						badges: [hasGlobalCustomModel ? {
							label: `${t("sessionSettings.badge.custom")}: ${globalConfig?.subagentModel?.model?.provider || ""} / ${globalConfig?.subagentModel?.model?.model || ""}`,
							variant: "custom"
						} : {
							label: t("sessionSettings.badge.inherit"),
							variant: "inherit"
						}],
						desc: t("sessionSettings.mode.default.desc")
					},
					{
						value: "inherit",
						title: t("sessionSettings.mode.inherit.title"),
						desc: t("sessionSettings.mode.inherit.desc")
					},
					{
						value: "custom",
						title: t("sessionSettings.mode.custom.title"),
						desc: t("sessionSettings.mode.custom.desc")
					}
				]
			}), modelConfig.mode === "custom" && !modelConfig.inherit ? e$16("div", { className: "dsh-sam-fields-panel" }, e$16("div", { className: "dsh-sam-field-group" }, e$16("label", { className: "dsh-sam-field-label" }, t("sessionSettings.field.provider")), e$16("select", {
				className: "dsh-sam-select",
				value: currentProvider,
				disabled: loadingModels || providers.length === 0,
				onChange: (evt) => onProviderChange(evt.target.value)
			}, loadingModels ? e$16("option", {
				value: "",
				disabled: true
			}, t("sessionSettings.field.loadingModels")) : providers.length === 0 ? e$16("option", {
				value: "",
				disabled: true
			}, t("sessionSettings.field.noModelsFound")) : !currentProvider ? e$16("option", {
				value: "",
				disabled: true
			}, t("sessionSettings.field.providerPlaceholder")) : null, providers.map((p) => e$16("option", {
				key: p.id,
				value: p.id
			}, p.name && p.name !== p.id ? `${p.name} (${p.id})` : p.name || p.id)), currentProvider && !providers.some((p) => p.id === currentProvider) ? e$16("option", {
				key: currentProvider,
				value: currentProvider
			}, currentProvider) : null)), e$16("div", { className: "dsh-sam-field-group" }, e$16("label", { className: "dsh-sam-field-label" }, t("sessionSettings.field.model")), e$16("select", {
				className: "dsh-sam-select",
				value: currentModel,
				disabled: loadingModels || !currentProvider || !currentProviderGroup?.models?.length,
				onChange: (evt) => onModelSelectChange(evt.target.value)
			}, !currentModel ? e$16("option", {
				value: "",
				disabled: true
			}, t("sessionSettings.field.modelPlaceholder")) : null, (currentProviderGroup?.models || []).map((m) => e$16("option", {
				key: m.id,
				value: m.id
			}, m.name || m.id)), currentModel && !currentProviderGroup?.models?.some((m) => m.id === currentModel) ? e$16("option", {
				key: currentModel,
				value: currentModel
			}, currentModel) : null)), availableEfforts.length > 0 ? e$16("div", { className: "dsh-sam-field-group" }, e$16("label", { className: "dsh-sam-field-label" }, t("sessionSettings.field.reasoningEffort")), e$16("select", {
				className: "dsh-sam-select",
				value: currentEffort,
				onChange: (evt) => onReasoningEffortChange(evt.target.value)
			}, e$16("option", { value: "" }, t("sessionSettings.field.reasoningEffortDefault")), availableEfforts.map((eff) => e$16("option", {
				key: eff.id,
				value: eff.id
			}, effortLabel(t, eff.id))))) : null) : null, (modelConfig.mode === "workspace" || modelConfig.mode === "global") && !effectiveModelConfig.inherit && effectiveModelConfig.model ? e$16("div", { className: "dsh-sam-effective-model-card" }, e$16("div", { className: "dsh-sam-effective-model-header" }, e$16("span", { className: "dsh-sam-effective-model-title" }, e$16(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutline16, { size: 14 }), t("sessionSettings.preview.effectiveModelTitle")), e$16("span", { className: "dsh-sam-effective-model-source" }, modelConfig.mode === "workspace" && workspaceSettings?.subagentModel?.mode === "custom" ? t("sessionSettings.preview.fromWorkspace") : t("sessionSettings.preview.fromGlobal"))), e$16("div", { className: "dsh-sam-effective-model-grid" }, e$16("div", { className: "dsh-sam-effective-model-item" }, e$16("span", { className: "dsh-sam-effective-model-label" }, t("sessionSettings.field.provider")), e$16("span", { className: "dsh-sam-effective-model-value" }, effectiveModelConfig.model.provider || "-")), e$16("div", { className: "dsh-sam-effective-model-item" }, e$16("span", { className: "dsh-sam-effective-model-label" }, t("sessionSettings.field.model")), e$16("span", { className: "dsh-sam-effective-model-value" }, effectiveModelConfig.model.model || "-")), effectiveModelConfig.model.reasoningEffort ? e$16("div", { className: "dsh-sam-effective-model-item" }, e$16("span", { className: "dsh-sam-effective-model-label" }, t("sessionSettings.field.reasoningEffort")), e$16("span", { className: "dsh-sam-effective-model-value" }, effortLabel(t, effectiveModelConfig.model.reasoningEffort))) : null)) : null, e$16("div", { style: {
				marginTop: 24,
				marginBottom: 8
			} }, e$16("h4", { style: {
				fontSize: "13px",
				fontWeight: 600,
				margin: "0 0 4px 0",
				color: "var(--dsh-color-fg-default)"
			} }, t("sessionSettings.section.behaviorControlTitle")), e$16("p", { style: {
				fontSize: "12px",
				margin: 0,
				color: "var(--dsh-color-fg-muted)"
			} }, t("sessionSettings.section.behaviorControlDesc"))), e$16("div", {
				className: `dsh-mcp-switch-card ${isAllowAgentSelect ? "active" : ""}`,
				style: { marginBottom: 12 },
				tabIndex: 0,
				role: "switch",
				"aria-checked": isAllowAgentSelect,
				onClick: () => {
					if (onAllowAgentSelectModelChange) onAllowAgentSelectModelChange(!isAllowAgentSelect);
				},
				onKeyDown: (evt) => {
					if (evt.key === " " || evt.key === "Enter") {
						evt.preventDefault();
						if (onAllowAgentSelectModelChange) onAllowAgentSelectModelChange(!isAllowAgentSelect);
					}
				}
			}, e$16("div", { className: "dsh-mcp-switch-text" }, e$16("div", { className: "dsh-mcp-switch-title" }, t("sessionSettings.switch.allowAgentSelectModel.title")), e$16("div", { className: "dsh-mcp-switch-desc" }, t("sessionSettings.switch.allowAgentSelectModel.desc"))), e$16("button", {
				type: "button",
				className: `dsh-mcp-switch-btn ${isAllowAgentSelect ? "active" : ""}`,
				tabIndex: -1,
				"aria-hidden": "true"
			}, e$16("span", { className: "dsh-mcp-switch-thumb" }))), e$16("div", {
				className: `dsh-mcp-switch-card ${isOverrideFork ? "active" : ""}`,
				style: { marginBottom: 16 },
				tabIndex: 0,
				role: "switch",
				"aria-checked": isOverrideFork,
				onClick: () => {
					if (onOverrideForkModelChange) onOverrideForkModelChange(!isOverrideFork);
				},
				onKeyDown: (evt) => {
					if (evt.key === " " || evt.key === "Enter") {
						evt.preventDefault();
						if (onOverrideForkModelChange) onOverrideForkModelChange(!isOverrideFork);
					}
				}
			}, e$16("div", { className: "dsh-mcp-switch-text" }, e$16("div", { className: "dsh-mcp-switch-title" }, t("sessionSettings.switch.overrideForkModel.title")), e$16("div", { className: "dsh-mcp-switch-desc" }, t("sessionSettings.switch.overrideForkModel.desc"))), e$16("button", {
				type: "button",
				className: `dsh-mcp-switch-btn ${isOverrideFork ? "active" : ""}`,
				tabIndex: -1,
				"aria-hidden": "true"
			}, e$16("span", { className: "dsh-mcp-switch-thumb" }))));
		}
		//#endregion
		//#region src/client/session/sections/SessionMcpSection.ts
		const e$15 = react.createElement;
		function SessionMcpSection({ sessionId, mcpConfig, availableMcpServers, currentWorkspaceId, workspaceSettings, globalConfig, onMcpModeChange, onToggleMcpServer, onToggleSelectAllMcp, onOpenSessionToolsModal, t }) {
			const isAllMcpSelected = availableMcpServers.length > 0 && availableMcpServers.every((s) => (mcpConfig.enabledServerIds ?? []).includes(s.id));
			const defaultMode = currentWorkspaceId ? "workspace" : "global";
			return e$15("div", { className: "dsh-view-content-inner" }, e$15("div", { className: "dsh-section-header" }, e$15("h3", { className: "dsh-section-title" }, t("sessionSettings.section.mcpTitle")), e$15("p", { className: "dsh-section-desc" }, t("sessionSettings.section.mcpDesc"))), e$15(ModeSelector, {
				name: "sessionMcpMode",
				value: mcpConfig.mode ?? defaultMode,
				onChange: (val) => onMcpModeChange(val),
				options: [
					{
						value: "workspace",
						visible: Boolean(currentWorkspaceId),
						title: t("sessionSettings.mcpMode.workspace.title"),
						badges: [workspaceSettings?.mcp?.mode === "custom" ? {
							label: t("sessionSettings.mcpMode.workspace.badgeCustom", { count: (workspaceSettings?.mcp?.enabledServerIds || []).length }),
							variant: "custom"
						} : {
							label: t("sessionSettings.mcpMode.workspace.badgeInherit"),
							variant: "inherit"
						}],
						desc: t("sessionSettings.mcpMode.workspace.desc")
					},
					{
						value: "global",
						title: t("sessionSettings.mcpMode.default.title"),
						badges: [{
							label: t("sessionSettings.mcpMode.default.badge", { count: (globalConfig?.mcp?.enabledServerIds || []).length }),
							variant: "custom"
						}],
						desc: t("sessionSettings.mcpMode.default.desc")
					},
					{
						value: "custom",
						title: t("sessionSettings.mcpMode.custom.title"),
						desc: t("sessionSettings.mcpMode.custom.desc")
					}
				]
			}), availableMcpServers.length === 0 ? e$15(EmptyState, { message: t("sessionSettings.mcp.empty") }) : e$15("div", { className: "dsh-session-mcp-box" }, mcpConfig.mode === "custom" || !sessionId ? e$15("div", { className: "dsh-mcp-quick-bar" }, e$15("button", {
				type: "button",
				className: `dsh-mcp-select-btn ${isAllMcpSelected ? "active" : ""}`,
				onClick: onToggleSelectAllMcp
			}, isAllMcpSelected ? t("sessionSettings.mcp.deselectAll") : t("sessionSettings.mcp.selectAll"))) : null, e$15("div", { className: "dsh-session-mcp-list" }, availableMcpServers.map((server) => {
				const globalActive = Array.isArray(globalConfig?.mcp?.enabledServerIds) ? (globalConfig.mcp.enabledServerIds ?? []).includes(server.id) : Boolean(server.enabledByDefault);
				const isChecked = mcpConfig.mode === "custom" || !sessionId ? (mcpConfig.enabledServerIds ?? []).includes(server.id) : mcpConfig.mode === "workspace" && workspaceSettings?.mcp?.mode === "custom" ? (workspaceSettings.mcp.enabledServerIds ?? []).includes(server.id) : globalActive;
				const isReadonly = Boolean(sessionId && mcpConfig.mode !== "custom");
				const protoLabel = server.transport === "stdio" ? "STDIO" : server.detectedTransport === "sse" ? "SSE" : server.detectedTransport === "streamable-http" ? "Streamable HTTP" : "HTTP / SSE";
				const protoClass = server.transport === "stdio" ? "stdio" : server.detectedTransport === "sse" ? "sse" : server.detectedTransport === "streamable-http" ? "streamable-http" : "streamable-http";
				const isCustomTools = mcpConfig.toolsMode?.[server.id] === "custom";
				const customDisabledCount = (mcpConfig.disabledTools?.[server.id] || []).length;
				const badges = [
					e$15(Badge, {
						key: "proto",
						label: protoLabel,
						variant: protoClass
					}),
					server.serverInfo?.version ? e$15(Badge, {
						key: "version",
						label: server.serverInfo.name && server.serverInfo.name !== server.id && server.serverInfo.name !== server.name ? `${server.serverInfo.name} ${server.serverInfo.version}` : server.serverInfo.version,
						variant: "server-version",
						title: formatProtocolTitle(server.serverInfo, t)
					}) : server.serverInfo?.protocolVersion ? e$15(Badge, {
						key: "protocol-version",
						label: `MCP ${server.serverInfo.protocolVersion}`,
						variant: "server-version",
						title: formatProtocolTitle(server.serverInfo, t)
					}) : null,
					isChecked ? e$15(Badge, {
						key: "tools-status",
						label: isCustomTools ? customDisabledCount > 0 ? t("sessionSettings.mcp.toolsModeCustomBadge", { count: customDisabledCount }) : t("sessionSettings.mcp.toolsAllActiveBadge") : t("sessionSettings.mcp.toolsModeDefaultBadge"),
						className: `dsh-session-tools-mode-badge ${isCustomTools ? customDisabledCount > 0 ? "custom" : "all-active" : "default"}`
					}) : null,
					server.toolCallTimeoutMs ? e$15(Badge, {
						key: "timeout",
						label: t("sessionSettings.field.timeoutSeconds", { seconds: server.toolCallTimeoutMs / 1e3 }),
						variant: "timeout"
					}) : null
				].filter(Boolean);
				const handleSwitchClick = (evt) => {
					evt.stopPropagation();
					if (!isReadonly) onToggleMcpServer(server.id);
				};
				return e$15("div", {
					key: server.id,
					className: `dsh-session-mcp-card ${isChecked ? "active" : ""} ${isReadonly ? "readonly" : ""}`
				}, e$15("div", { className: "dsh-session-mcp-header" }, e$15("div", { className: "dsh-session-mcp-identity" }, e$15("div", { className: "dsh-session-mcp-icon" }, e$15(ServerIcon, {
					server,
					size: 16
				})), e$15("div", { className: "dsh-session-mcp-title-wrap" }, e$15("span", { className: "dsh-session-mcp-name" }, server.name), server.id && server.id !== server.name ? e$15("span", { className: "dsh-session-mcp-id" }, server.id) : null)), e$15("div", { className: "dsh-session-mcp-switch-wrap" }, !isReadonly ? e$15("button", {
					type: "button",
					role: "switch",
					"aria-checked": isChecked,
					className: `dsh-mcp-switch-btn ${isChecked ? "active" : ""}`,
					onClick: handleSwitchClick
				}, e$15("span", { className: "dsh-mcp-switch-thumb" })) : e$15("div", {
					className: `dsh-mcp-switch-btn ${isChecked ? "active" : ""}`,
					style: {
						opacity: .6,
						cursor: "default"
					}
				}, e$15("span", { className: "dsh-mcp-switch-thumb" })))), badges.length > 0 ? e$15("div", { className: "dsh-session-mcp-badges-row" }, badges) : null, server.description || server.serverInfo?.description ? e$15("p", { className: "dsh-session-mcp-desc" }, server.description || server.serverInfo?.description) : null, e$15("div", { className: "dsh-session-mcp-target-box" }, e$15("code", { className: "dsh-session-mcp-target" }, server.transport === "stdio" ? `${server.command || ""} ${(server.args || []).join(" ")}` : server.url || "")), isChecked ? e$15("div", { className: "dsh-session-mcp-footer" }, e$15("button", {
					type: "button",
					className: "dsh-mcp-mini-btn dsh-session-tools-btn",
					onClick: (evt) => {
						evt.stopPropagation();
						onOpenSessionToolsModal(server);
					}
				}, e$15(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: 14 }), t("sessionSettings.mcp.toolsBtn"))) : null);
			}))));
		}
		//#endregion
		//#region src/client/skills/components/SkillCard.ts
		const e$14 = react.createElement;
		function SkillCard({ skill, isModelDisabled, isUserDisabled, showStatusBadges = false, onClick, t }) {
			const isRuntime = Boolean(skill.isRuntime);
			const { sourceClass, sourceLabel } = getSkillSourceMeta(skill, t);
			const badges = [];
			badges.push({
				label: sourceLabel,
				variant: sourceClass
			});
			if (showStatusBadges || !isRuntime) {
				badges.push({
					label: !isModelDisabled ? t("sessionSettings.skills.modelInvocableEnabled") : t("sessionSettings.skills.modelInvocableDisabled"),
					variant: !isModelDisabled ? "status-enabled" : "status-disabled"
				});
				badges.push({
					label: !isUserDisabled ? t("sessionSettings.skills.userInvocableEnabled") : t("sessionSettings.skills.userInvocableDisabled"),
					variant: !isUserDisabled ? "status-enabled" : "status-disabled"
				});
			}
			return e$14(ItemToggleCard, {
				key: skill.name,
				id: skill.name,
				title: skill.name,
				badges,
				description: skill.description,
				onClick
			});
		}
		//#endregion
		//#region src/client/session/sections/SessionSkillsSection.ts
		const e$13 = react.createElement;
		function SessionSkillsSection({ skillsConfig, availableSkills, currentWorkspaceId, workspaceSettings, globalConfig, skillsSearch, refreshingSkills, effectiveDisabledModelSet, effectiveDisabledUserSet, onSkillsModeChange, onSkillsSearchChange, onRefreshSkills, onOpenSessionSkillModal, t }) {
			const filteredSkills = availableSkills.filter((s) => {
				if (!skillsSearch.trim()) return true;
				const q = skillsSearch.trim().toLowerCase();
				return s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q);
			});
			const defaultMode = currentWorkspaceId ? "workspace" : "global";
			return e$13("div", { className: "dsh-view-content-inner" }, e$13("div", { className: "dsh-section-header" }, e$13("h3", { className: "dsh-section-title" }, t("sessionSettings.section.skillsTitle")), e$13("p", { className: "dsh-section-desc" }, t("sessionSettings.section.skillsDesc"))), e$13(ModeSelector, {
				name: "sessionSkillsMode",
				value: skillsConfig.mode ?? defaultMode,
				onChange: (val) => onSkillsModeChange(val),
				options: [
					{
						value: "workspace",
						visible: Boolean(currentWorkspaceId),
						title: t("sessionSettings.skillsMode.workspace.title"),
						badges: [workspaceSettings?.skills?.mode === "custom" ? {
							label: t("sessionSettings.skillsMode.workspace.badgeCustom", { count: (workspaceSettings?.skills?.disabledModelSkills ?? []).length }),
							variant: "custom"
						} : {
							label: t("sessionSettings.skillsMode.workspace.badgeInherit"),
							variant: "inherit"
						}],
						desc: t("sessionSettings.skillsMode.workspace.desc")
					},
					{
						value: "global",
						title: t("sessionSettings.skillsMode.default.title"),
						badges: [{
							label: t("sessionSettings.skillsMode.default.badge", { count: (globalConfig?.skills?.disabledModelSkills ?? []).length }),
							variant: "custom"
						}],
						desc: t("sessionSettings.skillsMode.default.desc")
					},
					{
						value: "custom",
						title: t("sessionSettings.skillsMode.custom.title"),
						desc: t("sessionSettings.skillsMode.custom.desc")
					}
				]
			}), availableSkills.length === 0 ? e$13(EmptyState, { message: t("sessionSettings.skills.empty") }) : e$13("div", { className: "dsh-session-skills-box" }, e$13(SearchToolbar, {
				value: skillsSearch,
				onChange: onSkillsSearchChange,
				placeholder: t("sessionSettings.skills.searchPlaceholder"),
				className: "dsh-skills-toolbar",
				inputClassName: "dsh-skills-search-input",
				actions: e$13("button", {
					type: "button",
					className: "dsh-mcp-text-btn",
					disabled: refreshingSkills,
					onClick: onRefreshSkills
				}, refreshingSkills ? e$13(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
					size: 12,
					className: "dsh-spin"
				}) : e$13(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 12 }), t("sessionSettings.skills.refresh"))
			}), filteredSkills.length === 0 ? e$13(EmptyState, { message: t("sessionSettings.skills.noMatch") }) : e$13("div", { className: "dsh-session-skills-list" }, filteredSkills.map((skill) => e$13(SkillCard, {
				key: skill.name,
				skill,
				isModelDisabled: effectiveDisabledModelSet.has(skill.name),
				isUserDisabled: effectiveDisabledUserSet.has(skill.name),
				showStatusBadges: true,
				onClick: () => onOpenSessionSkillModal(skill),
				t
			})))));
		}
		//#endregion
		//#region src/client/session/modals/SetDefaultModal.ts
		const e$12 = react.createElement;
		function SetDefaultModal({ open, setDefaultTargetScope, setSetDefaultTargetScope, isRestoringDefault, setIsRestoringDefault, currentWorkspaceId, currentWorkspaceTitle, currentWorkspace, workspaceSettings, globalConfig, modelConfig, mcpConfig, skillsConfig, availableSkills, savingDefault, onClose, onApply, t }) {
			if (!open) return null;
			const isTargetWorkspace = setDefaultTargetScope === "workspace";
			const runtimeSkillsSet = react.useMemo(() => {
				return new Set((availableSkills || []).filter((s) => s.isRuntime).map((s) => s.name));
			}, [availableSkills]);
			const filterNonRuntimeSkills = react.useCallback((skillNames) => {
				if (!skillNames || !Array.isArray(skillNames)) return [];
				return skillNames.filter((name) => !runtimeSkillsSet.has(name));
			}, [runtimeSkillsSet]);
			const formatSubagentModelSummary = (cfg) => {
				if (!cfg) return t("sessionSettings.status.default");
				let base = t("sessionSettings.status.default");
				if (cfg.mode === "custom") {
					if (cfg.inherit) base = t("sessionSettings.status.inherit");
					else if (cfg.model?.provider && cfg.model?.model) base = `${cfg.model.provider} / ${cfg.model.model}`;
					else base = t("sessionSettings.badge.custom");
				} else if (cfg.mode === "workspace") base = t("sessionSettings.status.workspace");
				const agentSelect = cfg.allowAgentSelectModel === false ? t("sessionSettings.switch.allowAgentSelectModel.summaryForced") : t("sessionSettings.switch.allowAgentSelectModel.summaryAuto");
				const forkOverride = cfg.overrideForkModel === true ? t("sessionSettings.switch.overrideForkModel.summaryEnabled") : "";
				return [
					base,
					agentSelect,
					forkOverride
				].filter(Boolean).join(" · ");
			};
			const beforeModelText = isTargetWorkspace && workspaceSettings?.subagentModel?.mode === "custom" ? formatSubagentModelSummary(workspaceSettings.subagentModel) : formatSubagentModelSummary(globalConfig.subagentModel);
			const afterModelText = isRestoringDefault ? isTargetWorkspace ? formatSubagentModelSummary(globalConfig.subagentModel) : t("sessionSettings.status.inherit") : formatSubagentModelSummary(modelConfig);
			const beforeMcpCount = (isTargetWorkspace && workspaceSettings?.mcp?.mode === "custom" ? workspaceSettings.mcp.enabledServerIds ?? [] : globalConfig?.mcp?.enabledServerIds ?? []).length;
			const beforeMcpText = isTargetWorkspace && workspaceSettings?.mcp?.mode !== "custom" ? t("sessionSettings.status.default") : t("sessionSettings.setDefaultModal.mcpCustom", { count: beforeMcpCount });
			const afterMcpCount = (mcpConfig?.enabledServerIds ?? []).length;
			const afterMcpText = isRestoringDefault ? isTargetWorkspace ? t("sessionSettings.setDefaultModal.mcpCustom", { count: (globalConfig?.mcp?.enabledServerIds ?? []).length }) : t("sessionSettings.status.default") : mcpConfig?.mode === "custom" ? t("sessionSettings.setDefaultModal.mcpCustom", { count: afterMcpCount }) : mcpConfig?.mode === "workspace" ? t("sessionSettings.status.workspace") : t("sessionSettings.status.default");
			const beforeSkillsDisabledCount = (isTargetWorkspace && workspaceSettings?.skills?.mode === "custom" ? workspaceSettings.skills.disabledModelSkills ?? [] : globalConfig?.skills?.disabledModelSkills ?? []).length;
			const beforeSkillsText = isTargetWorkspace && workspaceSettings?.skills?.mode !== "custom" ? t("sessionSettings.status.default") : t("sessionSettings.setDefaultModal.skillsCustom", { count: beforeSkillsDisabledCount });
			const afterSkillsDisabledCount = (skillsConfig?.mode === "custom" ? filterNonRuntimeSkills(skillsConfig?.disabledModelSkills) : globalConfig?.skills?.disabledModelSkills ?? []).length;
			const afterSkillsText = isRestoringDefault ? isTargetWorkspace ? t("sessionSettings.setDefaultModal.skillsCustom", { count: (globalConfig?.skills?.disabledModelSkills || []).length }) : t("sessionSettings.setDefaultModal.skillsAll") : skillsConfig?.mode === "custom" ? t("sessionSettings.setDefaultModal.skillsCustom", { count: afterSkillsDisabledCount }) : skillsConfig?.mode === "workspace" ? t("sessionSettings.status.workspace") : t("sessionSettings.status.default");
			const modelChanged = beforeModelText !== afterModelText;
			const mcpChanged = beforeMcpText !== afterMcpText;
			const skillsChanged = beforeSkillsText !== afterSkillsText;
			return e$12(ModalDialog, {
				open,
				onClose,
				title: e$12("div", { className: "dsh-set-default-title-row" }, e$12("span", null, t("sessionSettings.setDefaultModal.title")), currentWorkspaceTitle ? e$12("span", {
					className: "dsh-session-id-chip dsh-modal-workspace-chip",
					title: currentWorkspace?.path || currentWorkspaceTitle
				}, `${t("sessionSettings.scope.workspaceLabel")}: ${currentWorkspaceTitle}`) : null),
				subtitle: t("sessionSettings.setDefaultModal.desc"),
				panelClassName: "dsh-sam-modal-panel dsh-set-default-modal",
				footer: [e$12("div", {
					key: "left",
					className: "dsh-mcp-modal-footer-left"
				}, e$12("button", {
					type: "button",
					className: "dsh-sam-btn tertiary",
					onClick: () => setIsRestoringDefault(!isRestoringDefault)
				}, isRestoringDefault ? t("sessionSettings.action.undo") : setDefaultTargetScope === "workspace" ? t("sessionSettings.action.restoreWorkspaceToGlobal") : t("sessionSettings.action.restoreDefault"))), e$12("div", {
					key: "right",
					className: "dsh-mcp-modal-footer-right"
				}, e$12("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					onClick: onClose
				}, t("sessionSettings.action.cancel")), e$12("button", {
					type: "button",
					className: "dsh-sam-btn primary",
					disabled: savingDefault,
					onClick: onApply
				}, savingDefault ? t("sessionSettings.action.savingDefault") : setDefaultTargetScope === "workspace" ? t("sessionSettings.action.applyWorkspaceDefault") : t("sessionSettings.action.confirmApply")))]
			}, e$12("div", { className: "dsh-set-default-scope-row" }, e$12("span", { className: "dsh-set-default-scope-label" }, t("sessionSettings.setDefaultModal.targetScope")), e$12("div", { className: "dsh-set-default-scope-tabs" }, currentWorkspaceId ? e$12("button", {
				type: "button",
				className: `dsh-set-default-scope-btn ${setDefaultTargetScope === "workspace" ? "active" : ""}`,
				onClick: () => setSetDefaultTargetScope("workspace")
			}, t("sessionSettings.setDefaultModal.scopeWorkspace")) : null, e$12("button", {
				type: "button",
				className: `dsh-set-default-scope-btn ${setDefaultTargetScope === "global" ? "active" : ""}`,
				onClick: () => setSetDefaultTargetScope("global")
			}, t("sessionSettings.setDefaultModal.scopeGlobal")))), e$12("div", { className: "dsh-set-default-modal-body" }, isRestoringDefault ? e$12("div", {
				className: "dsh-sam-notice info",
				style: { marginBottom: 10 }
			}, t("sessionSettings.setDefaultModal.restoreDefaultNotice")) : null, e$12("div", { className: "dsh-diff-grid" }, e$12("div", { className: "dsh-diff-row" }, e$12("div", { className: "dsh-diff-row-header" }, e$12("span", { className: "dsh-diff-row-title" }, t("sessionSettings.setDefaultModal.modelSection")), modelChanged ? e$12("span", { className: "dsh-diff-changed-tag" }, t("sessionSettings.setDefaultModal.changed")) : e$12("span", { className: "dsh-diff-col-title" }, t("sessionSettings.setDefaultModal.unchanged"))), e$12("div", { className: "dsh-diff-cols" }, e$12("div", { className: "dsh-diff-col before" }, e$12("span", { className: "dsh-diff-col-title" }, setDefaultTargetScope === "workspace" ? t("sessionSettings.setDefaultModal.diffBeforeWorkspace") : t("sessionSettings.setDefaultModal.diffBeforeGlobal")), e$12("span", { className: "dsh-diff-col-value" }, beforeModelText)), e$12("div", { className: "dsh-diff-col after" }, e$12("span", { className: "dsh-diff-col-title" }, setDefaultTargetScope === "workspace" ? t("sessionSettings.setDefaultModal.diffAfterWorkspace") : t("sessionSettings.setDefaultModal.diffAfterGlobal")), e$12("span", { className: `dsh-diff-col-value ${modelChanged ? "changed" : ""}` }, afterModelText)))), e$12("div", { className: "dsh-diff-row" }, e$12("div", { className: "dsh-diff-row-header" }, e$12("span", { className: "dsh-diff-row-title" }, t("sessionSettings.setDefaultModal.mcpSection")), mcpChanged ? e$12("span", { className: "dsh-diff-changed-tag" }, t("sessionSettings.setDefaultModal.changed")) : e$12("span", { className: "dsh-diff-col-title" }, t("sessionSettings.setDefaultModal.unchanged"))), e$12("div", { className: "dsh-diff-cols" }, e$12("div", { className: "dsh-diff-col before" }, e$12("span", { className: "dsh-diff-col-title" }, setDefaultTargetScope === "workspace" ? t("sessionSettings.setDefaultModal.diffBeforeWorkspace") : t("sessionSettings.setDefaultModal.diffBeforeGlobal")), e$12("span", { className: "dsh-diff-col-value" }, beforeMcpText)), e$12("div", { className: "dsh-diff-col after" }, e$12("span", { className: "dsh-diff-col-title" }, setDefaultTargetScope === "workspace" ? t("sessionSettings.setDefaultModal.diffAfterWorkspace") : t("sessionSettings.setDefaultModal.diffAfterGlobal")), e$12("span", { className: `dsh-diff-col-value ${mcpChanged ? "changed" : ""}` }, afterMcpText)))), e$12("div", { className: "dsh-diff-row" }, e$12("div", { className: "dsh-diff-row-header" }, e$12("span", { className: "dsh-diff-row-title" }, t("sessionSettings.setDefaultModal.skillsSection")), skillsChanged ? e$12("span", { className: "dsh-diff-changed-tag" }, t("sessionSettings.setDefaultModal.changed")) : e$12("span", { className: "dsh-diff-col-title" }, t("sessionSettings.setDefaultModal.unchanged"))), e$12("div", { className: "dsh-diff-cols" }, e$12("div", { className: "dsh-diff-col before" }, e$12("span", { className: "dsh-diff-col-title" }, setDefaultTargetScope === "workspace" ? t("sessionSettings.setDefaultModal.diffBeforeWorkspace") : t("sessionSettings.setDefaultModal.diffBeforeGlobal")), e$12("span", { className: "dsh-diff-col-value" }, beforeSkillsText)), e$12("div", { className: "dsh-diff-col after" }, e$12("span", { className: "dsh-diff-col-title" }, setDefaultTargetScope === "workspace" ? t("sessionSettings.setDefaultModal.diffAfterWorkspace") : t("sessionSettings.setDefaultModal.diffAfterGlobal")), e$12("span", { className: `dsh-diff-col-value ${skillsChanged ? "changed" : ""}` }, afterSkillsText)))))));
		}
		//#endregion
		//#region src/client/session/modals/SessionMcpToolsModal.ts
		const e$11 = react.createElement;
		function SessionMcpToolsModal({ server, toolsMode, disabledToolsSet, fetching, error, toolsList, onToolsModeChange, onToggleTool, onToggleAllTools, onResetToDefault, onFetchTools, onClose, onApply, t }) {
			const [search, setSearch] = react.useState("");
			const [expandedSchemas, setExpandedSchemas] = react.useState(/* @__PURE__ */ new Set());
			const [schemaModes, setSchemaModes] = react.useState({});
			if (!server) return null;
			const protoLabel = server.transport === "stdio" ? "STDIO" : server.detectedTransport === "sse" ? "SSE" : server.detectedTransport === "streamable-http" ? "Streamable HTTP" : "HTTP / SSE";
			const protoVariant = server.transport === "stdio" ? "stdio" : server.detectedTransport === "sse" ? "sse" : "streamable-http";
			const filteredTools = toolsList.filter((tool) => {
				const term = search.trim().toLowerCase();
				if (!term) return true;
				return tool.name.toLowerCase().includes(term) || (tool.description || "").toLowerCase().includes(term);
			});
			const handleToggleSchema = (toolName) => {
				setExpandedSchemas((prev) => {
					const next = new Set(prev);
					if (next.has(toolName)) next.delete(toolName);
					else next.add(toolName);
					return next;
				});
			};
			const handleSchemaModeChange = (toolName, mode) => {
				setSchemaModes((prev) => ({
					...prev,
					[toolName]: mode
				}));
			};
			return e$11(ModalDialog, {
				open: Boolean(server),
				onClose,
				title: `${server.name} - ${t("sessionSettings.toolsModal.title")}`,
				panelClassName: "dsh-sam-modal-panel dsh-mcp-tools-modal",
				headerExtra: [
					e$11(ServerIcon, {
						key: "icon",
						server,
						transport: server.transport,
						size: 16
					}),
					server.id && server.id !== server.name ? e$11("span", {
						key: "id",
						className: "dsh-mcp-card-id"
					}, server.id) : null,
					e$11(Badge, {
						key: "proto",
						label: protoLabel,
						variant: protoVariant
					}),
					toolsList.length > 0 ? e$11(Badge, {
						key: "count",
						label: t("sessionSettings.mcp.toolsCount", { count: toolsList.length }),
						variant: "count"
					}) : null
				].filter(Boolean),
				footer: [e$11("div", {
					key: "left",
					className: "dsh-mcp-modal-footer-left"
				}, toolsMode === "custom" ? disabledToolsSet.size > 0 ? e$11(Badge, {
					label: t("sessionSettings.toolsModal.disabledCount", { count: disabledToolsSet.size }),
					variant: "disabled-tools"
				}) : e$11(Badge, {
					label: t("sessionSettings.toolsModal.allEnabledCount", { total: toolsList.length }),
					variant: "stdio"
				}) : e$11(Badge, {
					label: t("sessionSettings.toolsModal.modeDefaultTitle"),
					variant: "stdio"
				})), e$11("div", {
					key: "right",
					className: "dsh-mcp-modal-footer-right"
				}, e$11("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					onClick: onClose
				}, t("sessionSettings.toolsModal.cancel")), e$11("button", {
					type: "button",
					className: "dsh-sam-btn primary",
					onClick: onApply
				}, t("sessionSettings.toolsModal.save")))]
			}, e$11("div", { className: "dsh-session-tools-mode-tabs" }, e$11("button", {
				type: "button",
				className: `dsh-session-tools-mode-tab ${toolsMode === "global" ? "active" : ""}`,
				onClick: () => onToolsModeChange("global")
			}, t("sessionSettings.toolsModal.modeDefaultTitle")), e$11("button", {
				type: "button",
				className: `dsh-session-tools-mode-tab ${toolsMode === "custom" ? "active" : ""}`,
				onClick: () => onToolsModeChange("custom")
			}, t("sessionSettings.toolsModal.modeCustomTitle"))), e$11(SearchToolbar, {
				value: search,
				onChange: setSearch,
				placeholder: t("sessionSettings.toolsModal.searchPlaceholder"),
				className: "dsh-mcp-tools-toolbar",
				actions: [
					toolsMode === "custom" ? e$11("button", {
						key: "enableAll",
						type: "button",
						className: "dsh-sam-btn secondary",
						disabled: fetching || toolsList.length === 0,
						onClick: () => onToggleAllTools(true)
					}, t("sessionSettings.toolsModal.enableAll")) : null,
					toolsMode === "custom" ? e$11("button", {
						key: "disableAll",
						type: "button",
						className: "dsh-sam-btn secondary",
						disabled: fetching || toolsList.length === 0,
						onClick: () => onToggleAllTools(false)
					}, t("sessionSettings.toolsModal.disableAll")) : null,
					toolsMode === "custom" ? e$11("button", {
						key: "reset",
						type: "button",
						className: "dsh-sam-btn secondary",
						disabled: fetching,
						onClick: onResetToDefault
					}, t("sessionSettings.toolsModal.resetToDefault")) : null,
					e$11("button", {
						key: "refresh",
						type: "button",
						className: "dsh-sam-btn secondary",
						disabled: fetching,
						onClick: onFetchTools,
						title: t("sessionSettings.toolsModal.refreshBtn")
					}, fetching ? e$11(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
						size: 14,
						className: "dsh-spin"
					}) : e$11(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }), fetching ? t("sessionSettings.toolsModal.fetchingTools") : t("sessionSettings.toolsModal.refreshBtn"))
				].filter(Boolean)
			}), fetching ? e$11("div", {
				className: "dsh-sam-loading",
				style: { padding: 24 }
			}, t("sessionSettings.toolsModal.fetchingTools")) : error ? e$11("div", {
				className: "dsh-sam-notice error",
				style: {
					margin: "14px 0",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 12
				}
			}, e$11("span", null, t("sessionSettings.toolsModal.fetchFailed") + error), e$11("button", {
				type: "button",
				className: "dsh-sam-btn secondary",
				onClick: onFetchTools
			}, e$11(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }), t("sessionSettings.toolsModal.retry"))) : toolsList.length === 0 ? e$11(EmptyState, {
				style: { padding: "24px 16px" },
				message: t("sessionSettings.toolsModal.noToolsAvailable"),
				action: e$11("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					onClick: onFetchTools
				}, e$11(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }), t("sessionSettings.toolsModal.fetchToolsBtn"))
			}) : filteredTools.length === 0 ? e$11("div", {
				className: "dsh-sam-desc",
				style: {
					padding: "32px 0",
					textAlign: "center"
				}
			}, t("sessionSettings.skills.noMatch")) : e$11("div", { className: "dsh-mcp-tools-list" }, filteredTools.map((tool) => {
				const isGloballyDisabled = Boolean(Array.isArray(server.disabledTools) && server.disabledTools.includes(tool.name));
				const isCustomDisabled = disabledToolsSet.has(tool.name);
				const isDisabled = toolsMode === "custom" ? isCustomDisabled : isGloballyDisabled;
				const isSchemaExpanded = expandedSchemas.has(tool.name);
				const hasSchema = Boolean(tool.inputSchema && typeof tool.inputSchema === "object" && tool.inputSchema.properties && Object.keys(tool.inputSchema.properties).length > 0);
				const isEnabled = !isDisabled;
				const statusBadge = isDisabled ? {
					label: t(toolsMode === "custom" ? "sessionSettings.toolsModal.toolCustomDisabledBadge" : "sessionSettings.toolsModal.toolGlobalDisabledBadge"),
					variant: "tool-disabled"
				} : {
					label: t("sessionSettings.toolsModal.toolEnabled"),
					variant: "tool-active"
				};
				return e$11("div", {
					key: tool.name,
					className: `dsh-mcp-tool-card ${isDisabled ? "disabled" : ""}`
				}, e$11("div", { className: "dsh-mcp-tool-card-main" }, e$11("div", { className: "dsh-mcp-tool-card-left" }, e$11("button", {
					type: "button",
					role: "switch",
					"aria-checked": isEnabled,
					className: `dsh-mcp-switch-btn ${isEnabled ? "active" : ""}`,
					disabled: toolsMode !== "custom",
					style: {
						marginTop: 2,
						cursor: toolsMode === "custom" ? "pointer" : "default"
					},
					onClick: () => onToggleTool(tool.name)
				}, e$11("span", { className: "dsh-mcp-switch-thumb" })), e$11("div", { className: "dsh-mcp-tool-info" }, e$11("div", { className: "dsh-mcp-tool-title-row" }, e$11("span", { className: "dsh-mcp-tool-name" }, tool.name), e$11("span", { className: `dsh-mcp-tool-status-pill ${statusBadge.variant === "tool-active" ? "active" : "disabled"}` }, statusBadge.label)), tool.description ? e$11("p", { className: "dsh-mcp-tool-desc" }, tool.description) : null)), hasSchema ? e$11("button", {
					type: "button",
					className: `dsh-mcp-tool-schema-btn ${isSchemaExpanded ? "active" : ""}`,
					onClick: () => handleToggleSchema(tool.name)
				}, isSchemaExpanded ? t("sessionSettings.toolsModal.hideParameters") : t("sessionSettings.toolsModal.parameters")) : null), isSchemaExpanded && hasSchema ? e$11(SchemaViewer, {
					schema: tool.inputSchema,
					mode: schemaModes[tool.name] || "list",
					onModeChange: (m) => handleSchemaModeChange(tool.name, m),
					t
				}) : null);
			})));
		}
		//#endregion
		//#region src/client/skills/components/SkillDetailModal.ts
		const e$10 = react.createElement;
		function SkillDetailModal({ skill, detail, isModelDisabled, isUserDisabled, loadingContent, isSessionContext = false, saving = false, onSave, onClose, t }) {
			const [localModelDisabled, setLocalModelDisabled] = react.useState(isModelDisabled);
			const [localUserDisabled, setLocalUserDisabled] = react.useState(isUserDisabled);
			react.useEffect(() => {
				setLocalModelDisabled(isModelDisabled);
				setLocalUserDisabled(isUserDisabled);
			}, [
				skill?.name,
				isModelDisabled,
				isUserDisabled
			]);
			if (!skill || !detail) return null;
			const isRuntime = Boolean(skill.isRuntime);
			const canToggle = !isRuntime || isSessionContext;
			const { sourceClass, sourceLabel } = getSkillSourceMeta(skill, t);
			const handleSave = () => {
				if (onSave) onSave(skill.name, localModelDisabled, localUserDisabled);
				else onClose();
			};
			const footerButtons = canToggle ? [e$10("button", {
				key: "cancel",
				type: "button",
				className: "dsh-sam-btn secondary",
				disabled: saving,
				onClick: onClose
			}, t("sessionSettings.skills.modalCancelBtn")), e$10("button", {
				key: "save",
				type: "button",
				className: "dsh-sam-btn primary",
				disabled: saving,
				onClick: handleSave
			}, saving ? e$10(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
				size: 12,
				className: "dsh-spin"
			}) : null, saving ? t("sessionSettings.skills.modalSavingBtn") : t("sessionSettings.skills.modalSaveBtn"))] : [e$10("button", {
				key: "close",
				type: "button",
				className: "dsh-sam-btn primary",
				onClick: onClose
			}, t("sessionSettings.skills.modalDoneBtn"))];
			return e$10(ModalDialog, {
				open: true,
				onClose,
				title: skill.name,
				panelClassName: "dsh-sam-modal-panel dsh-skill-modal",
				headerExtra: [
					e$10(Badge, {
						key: "src",
						label: sourceLabel,
						variant: sourceClass
					}),
					canToggle ? e$10(Badge, {
						key: "model",
						label: !localModelDisabled ? t("sessionSettings.skills.modelInvocableEnabled") : t("sessionSettings.skills.modelInvocableDisabled"),
						variant: !localModelDisabled ? "status-enabled" : "status-disabled"
					}) : null,
					canToggle ? e$10(Badge, {
						key: "user",
						label: !localUserDisabled ? t("sessionSettings.skills.userInvocableEnabled") : t("sessionSettings.skills.userInvocableDisabled"),
						variant: !localUserDisabled ? "status-enabled" : "status-disabled"
					}) : null
				].filter(Boolean),
				footer: [e$10("div", {
					key: "right",
					className: "dsh-mcp-modal-footer-right"
				}, footerButtons)]
			}, e$10("div", { className: "dsh-skill-modal-body" }, skill.description ? e$10("p", { className: "dsh-skill-modal-desc" }, skill.description) : null, isRuntime && !isSessionContext ? e$10("div", { className: "dsh-skill-runtime-note" }, t("sessionSettings.skills.runtimeNotice")) : null, detail.path ? e$10("div", { className: "dsh-skill-detail-meta" }, e$10("span", null, t("sessionSettings.skills.pathLabel"), e$10("code", { className: "dsh-skill-detail-path" }, detail.path))) : null, detail.whenToUse ? e$10("div", { className: "dsh-skill-detail-meta" }, e$10("span", null, t("sessionSettings.skills.whenToUseLabel"), detail.whenToUse)) : null, e$10("div", { className: "dsh-skill-modal-section" }, e$10("h4", { className: "dsh-skill-modal-section-title" }, t("sessionSettings.skills.rulesSectionTitle")), canToggle ? e$10("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: "8px"
			} }, e$10("div", {
				className: `dsh-mcp-switch-card mini ${!localModelDisabled ? "active" : ""}`,
				onClick: () => setLocalModelDisabled((prev) => !prev),
				style: { cursor: "pointer" }
			}, e$10("div", { className: "dsh-mcp-switch-text" }, e$10("span", { className: "dsh-mcp-switch-title" }, t("sessionSettings.skills.modelInvocableTitle")), e$10("span", { className: "dsh-mcp-switch-desc" }, t("sessionSettings.skills.modelInvocableDesc"))), e$10("div", { className: `dsh-mcp-switch-btn ${!localModelDisabled ? "active" : ""}` }, e$10("span", { className: "dsh-mcp-switch-thumb" }))), e$10("div", {
				className: `dsh-mcp-switch-card mini ${!localUserDisabled ? "active" : ""}`,
				onClick: () => setLocalUserDisabled((prev) => !prev),
				style: { cursor: "pointer" }
			}, e$10("div", { className: "dsh-mcp-switch-text" }, e$10("span", { className: "dsh-mcp-switch-title" }, t("sessionSettings.skills.userInvocableTitle")), e$10("span", { className: "dsh-mcp-switch-desc" }, t("sessionSettings.skills.userInvocableDesc"))), e$10("div", { className: `dsh-mcp-switch-btn ${!localUserDisabled ? "active" : ""}` }, e$10("span", { className: "dsh-mcp-switch-thumb" })))) : null), e$10("div", { className: "dsh-skill-modal-section" }, e$10("h4", { className: "dsh-skill-modal-section-title" }, t("sessionSettings.skills.instructionsSectionTitle")), loadingContent ? e$10("div", { className: "dsh-sam-notice info" }, t("sessionSettings.skills.loadingContent")) : e$10("pre", { className: "dsh-skill-content-block" }, detail.content || t("sessionSettings.skills.noInstructions")))));
		}
		//#endregion
		//#region src/client/session/index.ts
		const e$9 = react.createElement;
		function SessionSettingsViewPage(props) {
			const { t, sessionId, onClose, onSave } = props;
			const data = useSessionData(props);
			const actions = useSessionActions({
				sessionId,
				currentWorkspaceId: data.currentWorkspaceId,
				currentWorkspaceTitle: data.currentWorkspaceTitle,
				modelConfig: data.modelConfig,
				mcpConfig: data.mcpConfig,
				skillsConfig: data.skillsConfig,
				globalConfig: data.globalConfig,
				setModelConfig: data.setModelConfig,
				setMcpConfig: data.setMcpConfig,
				setSkillsConfig: data.setSkillsConfig,
				setGlobalConfig: data.setGlobalConfig,
				setWorkspaceSettings: data.setWorkspaceSettings,
				setHasSessionOverride: data.setHasSessionOverride,
				setSaveSuccessMsg: data.setSaveSuccessMsg,
				setError: data.setError,
				setSetDefaultModalOpen: data.setSetDefaultModalOpen,
				setIsRestoringDefault: data.setIsRestoringDefault,
				cloneSourceId: data.cloneSourceId,
				setCloneSourceId: data.setCloneSourceId,
				setCloning: data.setCloning,
				setCloneError: data.setCloneError,
				setCopiedId: data.setCopiedId,
				sessionsMap: data.sessionsMap,
				onSave,
				t
			});
			const handleModelModeChange = (mode) => {
				data.setSaveSuccessMsg("");
				data.setError("");
				const extraFlags = {
					allowAgentSelectModel: data.modelConfig.allowAgentSelectModel,
					overrideForkModel: data.modelConfig.overrideForkModel
				};
				if (mode === "workspace") data.setModelConfig({
					mode: "workspace",
					...extraFlags
				});
				else if (mode === "global") data.setModelConfig({
					mode: "global",
					...extraFlags
				});
				else if (mode === "inherit") data.setModelConfig({
					mode: "custom",
					inherit: true,
					...extraFlags
				});
				else if (mode === "custom") {
					if (data.modelConfig.model?.provider && data.modelConfig.model?.model) data.setModelConfig({
						mode: "custom",
						inherit: false,
						model: data.modelConfig.model,
						...extraFlags
					});
					else data.setModelConfig({
						mode: "custom",
						inherit: false,
						model: {
							provider: "",
							model: "",
							reasoningEffort: void 0
						},
						...extraFlags
					});
				}
			};
			const handleProviderChange = (providerId) => {
				const firstModel = data.providers.find((g) => g.id === providerId)?.models?.[0]?.id || "";
				data.setModelConfig({
					mode: "custom",
					inherit: false,
					model: {
						provider: providerId,
						model: firstModel,
						reasoningEffort: void 0
					},
					allowAgentSelectModel: data.modelConfig.allowAgentSelectModel,
					overrideForkModel: data.modelConfig.overrideForkModel
				});
			};
			const handleModelSelectChange = (modelId) => {
				const currentProvider = data.modelConfig.model?.provider || "";
				const supportedEfforts = (data.providers.find((g) => g.id === currentProvider)?.models?.find((m) => m.id === modelId))?.reasoning?.efforts || [];
				const isEffortValid = !data.modelConfig.model?.reasoningEffort || supportedEfforts.some((eff) => eff.id === data.modelConfig.model?.reasoningEffort);
				data.setModelConfig({
					mode: "custom",
					inherit: false,
					model: {
						provider: currentProvider,
						model: modelId,
						reasoningEffort: isEffortValid ? data.modelConfig.model?.reasoningEffort : void 0
					},
					allowAgentSelectModel: data.modelConfig.allowAgentSelectModel,
					overrideForkModel: data.modelConfig.overrideForkModel
				});
			};
			const handleReasoningEffortChange = (effortId) => {
				if (!data.modelConfig.model) return;
				data.setModelConfig({
					mode: "custom",
					inherit: false,
					model: {
						...data.modelConfig.model,
						reasoningEffort: effortId || void 0
					},
					allowAgentSelectModel: data.modelConfig.allowAgentSelectModel,
					overrideForkModel: data.modelConfig.overrideForkModel
				});
			};
			const handleAllowAgentSelectModelChange = (allow) => {
				data.setSaveSuccessMsg("");
				data.setError("");
				data.setModelConfig({
					...data.modelConfig,
					allowAgentSelectModel: allow
				});
			};
			const handleOverrideForkModelChange = (override) => {
				data.setSaveSuccessMsg("");
				data.setError("");
				data.setModelConfig({
					...data.modelConfig,
					overrideForkModel: override
				});
			};
			const handleMcpModeChange = (mode) => {
				data.setSaveSuccessMsg("");
				data.setError("");
				if (mode === "custom" && (!data.mcpConfig.enabledServerIds || data.mcpConfig.enabledServerIds.length === 0)) {
					const initialIds = data.availableMcpServers.filter((s) => s.enabledByDefault).map((s) => s.id);
					data.setMcpConfig({
						...data.mcpConfig,
						mode: "custom",
						enabledServerIds: initialIds.length > 0 ? initialIds : data.availableMcpServers.map((s) => s.id)
					});
				} else data.setMcpConfig({
					...data.mcpConfig,
					mode
				});
			};
			const handleToggleMcpServer = (serverId) => {
				data.setSaveSuccessMsg("");
				data.setError("");
				const currentIds = data.mcpConfig.enabledServerIds || [];
				const nextIds = currentIds.includes(serverId) ? currentIds.filter((id) => id !== serverId) : [...currentIds, serverId];
				data.setMcpConfig({
					...data.mcpConfig,
					enabledServerIds: nextIds
				});
			};
			const handleToggleSelectAllMcp = () => {
				const isAll = data.availableMcpServers.length > 0 && data.availableMcpServers.every((s) => (data.mcpConfig.enabledServerIds || []).includes(s.id));
				data.setMcpConfig({
					...data.mcpConfig,
					enabledServerIds: isAll ? [] : data.availableMcpServers.map((s) => s.id)
				});
			};
			const handleOpenSessionToolsModal = async (server) => {
				data.setSessionToolsModalServer(server);
				const currentToolsMode = data.mcpConfig.toolsMode?.[server.id] || "global";
				data.setSessionToolsMode(currentToolsMode);
				data.setSessionDisabledToolsSet(new Set(data.mcpConfig.disabledTools?.[server.id] || (Array.isArray(server.disabledTools) ? server.disabledTools : [])));
				data.setSessionToolsList([]);
				data.setSessionToolsError("");
				data.setSessionToolsFetching(true);
				try {
					const resData = await (await fetch(`${API_ENDPOINTS.mcpServersToolview}?id=${encodeURIComponent(server.id)}`)).json();
					if (resData.ok) {
						const cachedTools = Array.isArray(resData.toolDetails) ? resData.toolDetails : Array.isArray(resData.tools) ? resData.tools.map((t) => typeof t === "string" ? { name: t } : t) : [];
						if (cachedTools.length > 0) {
							data.setSessionToolsList(cachedTools);
							data.setSessionToolsFetching(false);
							return;
						}
					}
				} catch {}
				try {
					const resData = await (await fetch(API_ENDPOINTS.mcpServersTools, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ server })
					})).json();
					if (resData.ok) {
						const fetchedTools = Array.isArray(resData.toolDetails) ? resData.toolDetails : Array.isArray(resData.tools) ? resData.tools.map((t) => typeof t === "string" ? { name: t } : t) : [];
						data.setSessionToolsList(fetchedTools);
						data.setSessionToolsError("");
						data.setAvailableMcpServers((prev) => prev.map((s) => s.id === server.id ? {
							...s,
							toolDetails: fetchedTools,
							tools: fetchedTools.length,
							detectedTransport: resData.detectedTransport || s.detectedTransport,
							serverInfo: resData.serverInfo || s.serverInfo
						} : s));
					} else {
						data.setSessionToolsList([]);
						data.setSessionToolsError(resData.message || resData.error || t("sessionSettings.toolsModal.fetchFailed"));
					}
				} catch (err) {
					data.setSessionToolsList([]);
					data.setSessionToolsError(err instanceof Error ? err.message : String(err));
				} finally {
					data.setSessionToolsFetching(false);
				}
			};
			const handleFetchSessionTools = async () => {
				if (!data.sessionToolsModalServer) return;
				const server = data.sessionToolsModalServer;
				data.setSessionToolsFetching(true);
				data.setSessionToolsError("");
				try {
					const resData = await (await fetch(API_ENDPOINTS.mcpServersTools, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ server })
					})).json();
					if (resData.ok) {
						const fetchedTools = Array.isArray(resData.toolDetails) ? resData.toolDetails : Array.isArray(resData.tools) ? resData.tools.map((t) => typeof t === "string" ? { name: t } : t) : [];
						data.setSessionToolsList(fetchedTools);
						data.setSessionToolsError("");
						data.setAvailableMcpServers((prev) => prev.map((s) => s.id === server.id ? {
							...s,
							toolDetails: fetchedTools,
							tools: fetchedTools.length,
							detectedTransport: resData.detectedTransport || s.detectedTransport,
							serverInfo: resData.serverInfo || s.serverInfo
						} : s));
					} else {
						data.setSessionToolsList([]);
						data.setSessionToolsError(resData.message || resData.error || t("sessionSettings.toolsModal.fetchFailed"));
					}
				} catch (err) {
					data.setSessionToolsList([]);
					data.setSessionToolsError(err instanceof Error ? err.message : String(err));
				} finally {
					data.setSessionToolsFetching(false);
				}
			};
			const handleToggleSessionTool = (toolName) => {
				data.setSessionDisabledToolsSet((prev) => {
					const next = new Set(prev);
					if (next.has(toolName)) next.delete(toolName);
					else next.add(toolName);
					return next;
				});
			};
			const handleToggleAllSessionTools = (enableAll) => {
				if (enableAll) data.setSessionDisabledToolsSet(/* @__PURE__ */ new Set());
				else data.setSessionDisabledToolsSet(new Set(data.sessionToolsList.map((t) => t.name).filter((n) => typeof n === "string" && Boolean(n))));
			};
			const handleResetSessionToolsToDefault = () => {
				data.setSessionDisabledToolsSet(new Set(Array.isArray(data.sessionToolsModalServer?.disabledTools) ? data.sessionToolsModalServer.disabledTools : []));
			};
			const handleCloseSessionToolsModal = () => {
				data.setSessionToolsModalServer(null);
				data.setSessionToolsList([]);
				data.setSessionToolsError("");
				data.setSessionToolsFetching(false);
			};
			const handleApplySessionTools = () => {
				if (!data.sessionToolsModalServer) return;
				const serverId = data.sessionToolsModalServer.id;
				const nextToolsMode = { ...data.mcpConfig.toolsMode || {} };
				const nextDisabledTools = { ...data.mcpConfig.disabledTools || {} };
				nextToolsMode[serverId] = data.sessionToolsMode;
				if (data.sessionToolsMode === "custom") nextDisabledTools[serverId] = Array.from(data.sessionDisabledToolsSet);
				else delete nextDisabledTools[serverId];
				const currentEnabled = data.mcpConfig.enabledServerIds || [];
				const nextEnabled = currentEnabled.includes(serverId) ? currentEnabled : [...currentEnabled, serverId];
				data.setMcpConfig({
					...data.mcpConfig,
					enabledServerIds: nextEnabled,
					toolsMode: nextToolsMode,
					disabledTools: nextDisabledTools
				});
				handleCloseSessionToolsModal();
			};
			const defaultDisabledModelSkills = data.globalConfig?.skills?.disabledModelSkills || [];
			const defaultDisabledUserSkills = data.globalConfig?.skills?.disabledUserSkills || [];
			const workspaceDisabledModelSkills = data.workspaceSettings?.skills?.mode === "custom" ? data.workspaceSettings.skills.disabledModelSkills || [] : defaultDisabledModelSkills;
			const workspaceDisabledUserSkills = data.workspaceSettings?.skills?.mode === "custom" ? data.workspaceSettings.skills.disabledUserSkills || [] : defaultDisabledUserSkills;
			const effectiveDisabledModelList = data.skillsConfig.mode === "custom" ? data.skillsConfig.disabledModelSkills || [] : data.skillsConfig.mode === "workspace" ? workspaceDisabledModelSkills : defaultDisabledModelSkills;
			const effectiveDisabledUserList = data.skillsConfig.mode === "custom" ? data.skillsConfig.disabledUserSkills || [] : data.skillsConfig.mode === "workspace" ? workspaceDisabledUserSkills : defaultDisabledUserSkills;
			const effectiveDisabledModelSet = new Set(effectiveDisabledModelList);
			const effectiveDisabledUserSet = new Set(effectiveDisabledUserList);
			const effectiveActiveSkillsCount = data.availableSkills.filter((s) => !effectiveDisabledModelSet.has(s.name)).length;
			const handleSkillsModeChange = (mode) => {
				data.setSaveSuccessMsg("");
				data.setError("");
				data.setSkillsConfig({
					...data.skillsConfig,
					mode,
					disabledModelSkills: mode === "custom" ? data.skillsConfig.disabledModelSkills || [] : mode === "workspace" ? data.workspaceSettings?.skills?.mode === "custom" ? data.workspaceSettings.skills.disabledModelSkills || [] : [] : [],
					disabledUserSkills: mode === "custom" ? data.skillsConfig.disabledUserSkills || [] : mode === "workspace" ? data.workspaceSettings?.skills?.mode === "custom" ? data.workspaceSettings.skills.disabledUserSkills || [] : [] : []
				});
			};
			const handleSaveSessionSkillModal = (skillName, modelDisabled, userDisabled) => {
				data.setSaveSuccessMsg("");
				data.setError("");
				const curModel = data.skillsConfig.mode === "custom" ? data.skillsConfig.disabledModelSkills || [] : effectiveDisabledModelList;
				const curUser = data.skillsConfig.mode === "custom" ? data.skillsConfig.disabledUserSkills || [] : effectiveDisabledUserList;
				const nextModel = modelDisabled ? Array.from(/* @__PURE__ */ new Set([...curModel, skillName])) : curModel.filter((n) => n !== skillName);
				const nextUser = userDisabled ? Array.from(/* @__PURE__ */ new Set([...curUser, skillName])) : curUser.filter((n) => n !== skillName);
				data.setSkillsConfig({
					...data.skillsConfig,
					mode: "custom",
					disabledModelSkills: nextModel,
					disabledUserSkills: nextUser
				});
				data.setSessionSkillModalTarget(null);
			};
			const handleOpenSessionSkillModal = async (skill) => {
				data.setSessionSkillModalTarget(skill);
				const skillName = skill.name;
				if (!data.skillsContentMap[skillName] && !skill.content) {
					data.setSkillsLoadingMap((prev) => ({
						...prev,
						[skillName]: true
					}));
					try {
						const url = sessionId ? `${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}&sessionId=${encodeURIComponent(sessionId)}` : `${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}`;
						const res = await fetch(url);
						if (res.ok) {
							const resData = await res.json();
							if (resData?.ok && resData.skill) data.setSkillsContentMap((prev) => ({
								...prev,
								[skillName]: resData.skill
							}));
							else data.setSkillsContentMap((prev) => ({
								...prev,
								[skillName]: {
									...skill,
									content: t("sessionSettings.skills.noContent")
								}
							}));
						} else data.setSkillsContentMap((prev) => ({
							...prev,
							[skillName]: {
								...skill,
								content: t("sessionSettings.skills.loadError")
							}
						}));
					} catch (err) {
						data.setSkillsContentMap((prev) => ({
							...prev,
							[skillName]: {
								...skill,
								content: t("sessionSettings.skills.loadErrorWithReason", { reason: err instanceof Error ? err.message : String(err) })
							}
						}));
					} finally {
						data.setSkillsLoadingMap((prev) => ({
							...prev,
							[skillName]: false
						}));
					}
				}
			};
			const handleRefreshSkills = async () => {
				data.setRefreshingSkills(true);
				try {
					const url = sessionId ? `${API_ENDPOINTS.skills}?sessionId=${encodeURIComponent(sessionId)}` : API_ENDPOINTS.skills;
					const res = await fetch(url);
					if (res.ok) {
						const resData = await res.json();
						if (resData?.ok && Array.isArray(resData.skills)) data.setAvailableSkills(resData.skills);
					}
				} catch {} finally {
					data.setRefreshingSkills(false);
				}
			};
			const defaultActiveMcpCount = data.globalConfig?.mcp?.enabledServerIds?.length ?? data.availableMcpServers.filter((s) => s.enabledByDefault).length;
			const effectiveActiveMcpCount = data.mcpConfig.mode === "custom" || !sessionId ? (data.mcpConfig.enabledServerIds || []).length : data.mcpConfig.mode === "workspace" && data.workspaceSettings?.mcp?.mode === "custom" ? (data.workspaceSettings.mcp.enabledServerIds || []).length : defaultActiveMcpCount;
			return e$9("div", {
				className: "dsh-session-view-root",
				"data-session-settings-view": "",
				"data-conversation-composer-overlay": ""
			}, e$9(HeaderBar, {
				sessionId,
				copiedId: data.copiedId,
				currentWorkspaceId: data.currentWorkspaceId,
				currentWorkspaceTitle: data.currentWorkspaceTitle,
				currentWorkspace: data.currentWorkspace || void 0,
				hasSessionOverride: data.hasSessionOverride,
				cloneSourceId: data.cloneSourceId,
				cloning: data.cloning,
				onCloneSourceIdChange: data.setCloneSourceId,
				onCopySessionId: actions.handleCopySessionId,
				onClonePreset: actions.handleClonePreset,
				onClose,
				t
			}), data.saveSuccessMsg ? e$9("div", { className: "dsh-sam-notice success dsh-view-notice" }, data.saveSuccessMsg) : null, data.error || data.cloneError ? e$9("div", { className: "dsh-sam-notice error dsh-view-notice" }, data.error || data.cloneError) : null, e$9("div", { className: "dsh-session-view-body" }, e$9(NavigationSidebar, {
				activeNav: data.activeNav,
				onNavChange: data.setActiveNav,
				modelConfig: data.modelConfig,
				effectiveActiveMcpCount,
				effectiveActiveSkillsCount,
				availableSkills: data.availableSkills,
				t
			}), e$9("div", { className: "dsh-session-view-content" }, data.activeNav === "model" ? e$9(SubagentModelSection, {
				modelConfig: data.modelConfig,
				providers: data.providers,
				loadingModels: data.loadingModels,
				currentWorkspaceId: data.currentWorkspaceId,
				workspaceSettings: data.workspaceSettings,
				globalConfig: data.globalConfig,
				onModelModeChange: handleModelModeChange,
				onProviderChange: handleProviderChange,
				onModelSelectChange: handleModelSelectChange,
				onReasoningEffortChange: handleReasoningEffortChange,
				onAllowAgentSelectModelChange: handleAllowAgentSelectModelChange,
				onOverrideForkModelChange: handleOverrideForkModelChange,
				t
			}) : null, data.activeNav === "mcp" ? e$9(SessionMcpSection, {
				sessionId,
				mcpConfig: data.mcpConfig,
				availableMcpServers: data.availableMcpServers,
				currentWorkspaceId: data.currentWorkspaceId,
				workspaceSettings: data.workspaceSettings,
				globalConfig: data.globalConfig,
				onMcpModeChange: handleMcpModeChange,
				onToggleMcpServer: handleToggleMcpServer,
				onToggleSelectAllMcp: handleToggleSelectAllMcp,
				onOpenSessionToolsModal: handleOpenSessionToolsModal,
				t
			}) : null, data.activeNav === "skills" ? e$9(SessionSkillsSection, {
				skillsConfig: data.skillsConfig,
				availableSkills: data.availableSkills,
				currentWorkspaceId: data.currentWorkspaceId,
				workspaceSettings: data.workspaceSettings,
				globalConfig: data.globalConfig,
				skillsSearch: data.skillsSearch,
				refreshingSkills: data.refreshingSkills,
				effectiveDisabledModelSet,
				effectiveDisabledUserSet,
				onSkillsModeChange: handleSkillsModeChange,
				onSkillsSearchChange: data.setSkillsSearch,
				onRefreshSkills: handleRefreshSkills,
				onOpenSessionSkillModal: handleOpenSessionSkillModal,
				t
			}) : null)), e$9("div", { className: "dsh-session-view-footer" }, e$9("div", { className: "dsh-view-footer-left" }, sessionId && data.hasSessionOverride ? e$9("button", {
				type: "button",
				className: "dsh-sam-btn tertiary",
				disabled: actions.saving || actions.savingDefault,
				onClick: actions.handleResetSession
			}, t("sessionSettings.action.reset")) : null), e$9("div", { className: "dsh-view-footer-right" }, e$9("button", {
				type: "button",
				className: "dsh-sam-btn default-btn",
				disabled: actions.saving || actions.savingDefault,
				onClick: () => {
					data.setSetDefaultTargetScope(data.currentWorkspaceId ? "workspace" : "global");
					data.setIsRestoringDefault(false);
					data.setSetDefaultModalOpen(true);
				}
			}, t("sessionSettings.action.setDefault")), e$9("button", {
				type: "button",
				className: "dsh-sam-btn primary",
				disabled: actions.saving || actions.savingDefault,
				onClick: () => actions.handleSave()
			}, actions.saving ? t("sessionSettings.action.saving") : sessionId ? t("sessionSettings.action.saveSession") : t("sessionSettings.action.save")))), e$9(SetDefaultModal, {
				open: data.setDefaultModalOpen,
				setDefaultTargetScope: data.setDefaultTargetScope,
				setSetDefaultTargetScope: data.setSetDefaultTargetScope,
				isRestoringDefault: data.isRestoringDefault,
				setIsRestoringDefault: data.setIsRestoringDefault,
				currentWorkspaceId: data.currentWorkspaceId,
				currentWorkspaceTitle: data.currentWorkspaceTitle,
				currentWorkspace: data.currentWorkspace || void 0,
				workspaceSettings: data.workspaceSettings,
				globalConfig: data.globalConfig,
				modelConfig: data.modelConfig,
				mcpConfig: data.mcpConfig,
				skillsConfig: data.skillsConfig,
				availableSkills: data.availableSkills,
				savingDefault: actions.savingDefault,
				onClose: () => data.setSetDefaultModalOpen(false),
				onApply: () => actions.handleApplySetDefault(data.setDefaultTargetScope, data.isRestoringDefault),
				t
			}), e$9(SessionMcpToolsModal, {
				server: data.sessionToolsModalServer,
				toolsMode: data.sessionToolsMode,
				disabledToolsSet: data.sessionDisabledToolsSet,
				fetching: data.sessionToolsFetching,
				error: data.sessionToolsError,
				toolsList: data.sessionToolsList,
				onToolsModeChange: (val) => {
					data.setSessionToolsMode(val);
					if (val === "global") data.setSessionDisabledToolsSet(new Set(Array.isArray(data.sessionToolsModalServer?.disabledTools) ? data.sessionToolsModalServer.disabledTools : []));
				},
				onToggleTool: handleToggleSessionTool,
				onToggleAllTools: handleToggleAllSessionTools,
				onResetToDefault: handleResetSessionToolsToDefault,
				onFetchTools: handleFetchSessionTools,
				onClose: handleCloseSessionToolsModal,
				onApply: handleApplySessionTools,
				t
			}), e$9(SkillDetailModal, {
				skill: data.sessionSkillModalTarget,
				detail: data.sessionSkillModalTarget ? data.skillsContentMap[data.sessionSkillModalTarget.name] || data.sessionSkillModalTarget : null,
				isModelDisabled: data.sessionSkillModalTarget ? effectiveDisabledModelSet.has(data.sessionSkillModalTarget.name) : false,
				isUserDisabled: data.sessionSkillModalTarget ? effectiveDisabledUserSet.has(data.sessionSkillModalTarget.name) : false,
				loadingContent: data.sessionSkillModalTarget ? Boolean(data.skillsLoadingMap[data.sessionSkillModalTarget.name]) : false,
				isSessionContext: true,
				onSave: handleSaveSessionSkillModal,
				onClose: () => data.setSessionSkillModalTarget(null),
				t
			}));
		}
		//#endregion
		//#region src/client/mcp/hooks/useMcpServers.ts
		function useMcpServers(t) {
			const [servers, setServers] = react.useState([]);
			const [loading, setLoading] = react.useState(true);
			const [error, setError] = react.useState("");
			const [successMsg, setSuccessMsg] = react.useState("");
			const [testingId, setTestingId] = react.useState(null);
			const [testResults, setTestResults] = react.useState({});
			const loadServers = react.useCallback(async () => {
				setLoading(true);
				setError("");
				try {
					const res = await fetch(API_ENDPOINTS.mcpServersList);
					if (res.ok) {
						const data = await res.json();
						if (data.ok && Array.isArray(data.servers)) setServers(data.servers);
					} else setError(`Failed to load MCP servers: ${res.statusText}`);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, []);
			react.useEffect(() => {
				loadServers();
			}, [loadServers]);
			const handleDelete = async (server) => {
				const confirmText = t("mcpServers.notices.deleteConfirm", { name: server.name || server.id });
				if (!window.confirm(confirmText)) return;
				try {
					const res = await fetch(API_ENDPOINTS.mcpServersRm, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ id: server.id })
					});
					if (res.ok) {
						if ((await res.json()).ok) {
							setServers((prev) => prev.filter((s) => s.id !== server.id));
							setSuccessMsg(t("mcpServers.notices.deleted"));
							setTimeout(() => setSuccessMsg(""), 3e3);
						}
					}
				} catch (err) {
					setError(t("mcpServers.notices.error") + (err instanceof Error ? err.message : String(err)));
				}
			};
			const handleTest = async (server) => {
				const id = server.id || "form_test";
				setTestingId(id);
				try {
					const data = await (await fetch(API_ENDPOINTS.mcpServersTest, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ server })
					})).json();
					setTestResults((prev) => ({
						...prev,
						[id]: {
							ok: Boolean(data.ok),
							message: data.message || (data.ok ? "Connection OK" : "Failed")
						}
					}));
					if (data.ok && server.id) setServers((prev) => prev.map((s) => s.id === server.id ? {
						...s,
						detectedTransport: data.detectedTransport || s.detectedTransport,
						serverInfo: data.serverInfo || s.serverInfo,
						tools: Array.isArray(data.tools) ? data.tools.length : typeof data.tools === "number" ? data.tools : s.tools,
						lastTestedAt: Date.now()
					} : s));
				} catch (err) {
					setTestResults((prev) => ({
						...prev,
						[id]: {
							ok: false,
							message: err instanceof Error ? err.message : String(err)
						}
					}));
				} finally {
					setTestingId(null);
				}
			};
			const executeSave = async (payload, originalId) => {
				try {
					const endpoint = Boolean(originalId || servers.some((s) => s.id === payload.id)) ? API_ENDPOINTS.mcpServersEdit : API_ENDPOINTS.mcpServersAdd;
					const res = await fetch(endpoint, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							server: payload,
							originalId
						})
					});
					const data = await res.json();
					if (res.ok && data.ok && data.server) {
						const savedServer = data.server;
						const oldKey = originalId || savedServer.id;
						setServers((prev) => {
							if (prev.some((s) => s.id === oldKey)) return prev.map((s) => s.id === oldKey ? savedServer : s);
							return [...prev, savedServer];
						});
						setSuccessMsg(t("mcpServers.notices.saved"));
						setTimeout(() => setSuccessMsg(""), 3e3);
						return { ok: true };
					} else return {
						ok: false,
						error: data.error || "Failed to save server"
					};
				} catch (err) {
					return {
						ok: false,
						error: err instanceof Error ? err.message : String(err)
					};
				}
			};
			return {
				servers,
				setServers,
				loading,
				error,
				setError,
				successMsg,
				setSuccessMsg,
				loadServers,
				handleDelete,
				handleTest,
				testingId,
				testResults,
				executeSave
			};
		}
		//#endregion
		//#region src/client/mcp/components/McpServerCard.ts
		const e$8 = react.createElement;
		function McpServerCard({ server, isTesting, testResult, onTest, onOpenTools, onOpenEdit, onDelete, t }) {
			const protoLabel = server.transport === "stdio" ? "stdio" : server.detectedTransport === "sse" ? "SSE" : server.detectedTransport === "streamable-http" ? "HTTP" : "HTTP / SSE";
			const protoClass = server.transport === "stdio" ? "stdio" : server.detectedTransport === "sse" ? "sse" : server.detectedTransport === "streamable-http" ? "streamable-http" : "streamable-http";
			return e$8("div", { className: "dsh-mcp-server-card" }, e$8("div", { className: "dsh-mcp-card-top" }, e$8("div", { className: "dsh-mcp-card-identity" }, e$8("div", { className: "dsh-mcp-transport-icon" }, e$8(ServerIcon, {
				server,
				size: 18
			})), e$8("div", { className: "dsh-mcp-title-wrap" }, e$8("span", { className: "dsh-mcp-card-name" }, server.name), e$8("span", { className: "dsh-mcp-card-id" }, server.id))), e$8("div", { className: "dsh-mcp-badges" }, e$8("span", { className: `dsh-mcp-proto-badge ${protoClass}` }, protoLabel), server.serverInfo?.websiteUrl ? e$8("a", {
				key: "website",
				href: server.serverInfo.websiteUrl,
				target: "_blank",
				rel: "noopener noreferrer",
				className: "dsh-mcp-proto-badge website",
				title: server.serverInfo.websiteUrl,
				onClick: (evt) => evt.stopPropagation()
			}, "🔗 " + t("mcpServers.table.website")) : null, server.serverInfo?.version ? e$8("span", {
				className: "dsh-mcp-proto-badge server-version",
				title: formatProtocolTitle(server.serverInfo, t)
			}, server.serverInfo.name && server.serverInfo.name !== server.id && server.serverInfo.name !== server.name ? `${server.serverInfo.name} ${server.serverInfo.version}` : server.serverInfo.version) : server.serverInfo?.protocolVersion ? e$8("span", {
				className: "dsh-mcp-proto-badge server-version",
				title: formatProtocolTitle(server.serverInfo, t)
			}, `MCP ${server.serverInfo.protocolVersion}`) : null, server.toolCallTimeoutMs ? e$8("span", { className: "dsh-mcp-proto-badge timeout" }, t("sessionSettings.field.timeoutSeconds", { seconds: server.toolCallTimeoutMs / 1e3 })) : null, (() => {
				const disabledCount = typeof server.disabledTools === "number" ? server.disabledTools : Array.isArray(server.disabledTools) ? server.disabledTools.length : 0;
				return disabledCount > 0 ? e$8("span", { className: "dsh-mcp-proto-badge disabled-tools" }, t("mcpServers.toolsModal.disabledBadge", { count: disabledCount })) : null;
			})(), server.enabledByDefault ? e$8("span", { className: "dsh-mcp-default-badge" }, t("mcpServers.table.enabledDefault")) : null)), (() => {
				const desc = server.description || server.serverInfo?.description;
				return desc ? e$8("p", { className: "dsh-mcp-card-desc" }, desc) : null;
			})(), e$8("div", { className: "dsh-mcp-target-box" }, server.transport === "stdio" ? e$8("code", { className: "dsh-mcp-code-preview" }, `${server.command || ""} ${(server.args || []).join(" ")}`) : e$8("code", { className: "dsh-mcp-code-preview" }, server.url || "")), testResult ? e$8("div", { className: `dsh-mcp-inline-test ${testResult.ok ? "success" : "error"}` }, !testResult.ok ? e$8(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 14 }) : null, e$8("span", null, testResult.message)) : null, e$8("div", { className: "dsh-mcp-card-footer" }, e$8("div", { style: {
				display: "flex",
				gap: "6px",
				alignItems: "center"
			} }, e$8("button", {
				type: "button",
				className: "dsh-mcp-mini-btn",
				disabled: isTesting,
				onClick: () => onTest(server)
			}, isTesting ? e$8(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, { className: "dsh-spin" }) : null, isTesting ? t("mcpServers.actions.testing") : t("mcpServers.actions.test")), e$8("button", {
				type: "button",
				className: "dsh-mcp-mini-btn",
				onClick: () => onOpenTools(server)
			}, t("mcpServers.actions.toolsList"))), e$8("div", { className: "dsh-mcp-footer-right" }, e$8("button", {
				type: "button",
				className: "dsh-mcp-icon-btn",
				title: t("mcpServers.actions.edit"),
				onClick: () => onOpenEdit(server)
			}, e$8(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16)), e$8("button", {
				type: "button",
				className: "dsh-mcp-icon-btn danger",
				title: t("mcpServers.actions.delete"),
				onClick: () => onDelete(server)
			}, e$8(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16)))));
		}
		//#endregion
		//#region src/client/mcp/components/McpServerFormModal.ts
		const e$7 = react.createElement;
		function McpServerFormModal({ open, isEditing, server, onChange, envEntries, onEnvChange, headerEntries, onHeaderChange, saving, testing, error, testResult, showAdvanced, onToggleAdvanced, onTest, onOpenTools, onClose, onSave, t }) {
			if (!open) return null;
			const detectedInfo = server.serverInfo;
			const detectedId = detectedInfo?.name ? detectedInfo.name.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) : "";
			const detectedName = detectedInfo?.title || detectedInfo?.name || "";
			const detectedDesc = detectedInfo?.description || "";
			const canAutofillId = Boolean(detectedId && detectedId !== server.id);
			const canAutofillName = Boolean(detectedName && detectedName !== server.name);
			const canAutofillDesc = Boolean(detectedDesc && detectedDesc !== server.description);
			return e$7(ModalDialog, {
				open,
				onClose,
				title: isEditing ? t("mcpServers.form.editTitle") : t("mcpServers.form.addTitle"),
				panelClassName: "dsh-mcp-form-modal",
				footer: [e$7("div", {
					key: "left",
					className: "dsh-mcp-modal-footer-left"
				}, e$7("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					disabled: testing || saving,
					onClick: onTest,
					title: t("mcpServers.actions.test")
				}, testing ? e$7(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
					size: 14,
					className: "dsh-spin"
				}) : e$7(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutline16, { size: 14 }), testing ? t("mcpServers.actions.testing") : t("mcpServers.actions.test")), e$7("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					disabled: testing || saving,
					onClick: onOpenTools,
					title: t("mcpServers.actions.toolsList")
				}, e$7(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { size: 14 }), t("mcpServers.actions.toolsList"), (() => {
					const disabledCount = typeof server.disabledTools === "number" ? server.disabledTools : Array.isArray(server.disabledTools) ? server.disabledTools.length : 0;
					return disabledCount > 0 ? e$7("span", { className: "dsh-mcp-mini-badge danger" }, String(disabledCount)) : null;
				})())), e$7("div", {
					key: "right",
					className: "dsh-mcp-modal-footer-right"
				}, e$7("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					disabled: saving,
					onClick: onClose
				}, t("mcpServers.actions.cancel")), e$7("button", {
					type: "button",
					className: "dsh-sam-btn primary",
					disabled: saving || testing,
					onClick: onSave
				}, saving ? t("mcpServers.actions.saving") : t("mcpServers.actions.save")))]
			}, error || testResult ? e$7("div", { className: "dsh-sam-notices-block" }, error ? e$7("div", { className: "dsh-sam-notice error" }, error) : null, testResult ? e$7("div", { className: `dsh-sam-notice ${testResult.ok ? "success" : "error"}` }, testResult.message) : null) : null, e$7("div", { className: "dsh-mcp-form-body" }, e$7("div", {
				className: `dsh-mcp-switch-card ${server.enabledByDefault ? "active" : ""}`,
				role: "button",
				tabIndex: 0,
				onClick: () => onChange({
					...server,
					enabledByDefault: !server.enabledByDefault
				}),
				onKeyDown: (evt) => {
					if (evt.key === " " || evt.key === "Enter") {
						evt.preventDefault();
						onChange({
							...server,
							enabledByDefault: !server.enabledByDefault
						});
					}
				}
			}, e$7("div", { className: "dsh-mcp-switch-text" }, e$7("div", { className: "dsh-mcp-switch-title" }, t("mcpServers.form.enabledByDefault")), e$7("div", { className: "dsh-mcp-switch-desc" }, t("mcpServers.form.enabledByDefaultDesc"))), e$7("div", {
				className: `dsh-mcp-switch-btn ${server.enabledByDefault ? "active" : ""}`,
				"aria-hidden": "true"
			}, e$7("span", { className: "dsh-mcp-switch-thumb" }))), e$7("div", { className: "dsh-mcp-form-row" }, e$7("div", { className: "dsh-sam-field-group flex-1" }, e$7("div", { className: "dsh-mcp-label-row" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.id")), canAutofillId ? e$7("button", {
				type: "button",
				className: "dsh-mcp-autofill-btn",
				title: t("mcpServers.form.fillDetected", { value: detectedId }),
				onClick: () => onChange({
					...server,
					id: detectedId
				})
			}, t("mcpServers.form.autoFill")) : null), e$7("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.idPlaceholder"),
				value: server.id || "",
				onChange: (evt) => onChange({
					...server,
					id: evt.target.value
				})
			})), e$7("div", { className: "dsh-sam-field-group flex-1" }, e$7("div", { className: "dsh-mcp-label-row" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.name")), canAutofillName ? e$7("button", {
				type: "button",
				className: "dsh-mcp-autofill-btn",
				title: t("mcpServers.form.fillDetected", { value: detectedName }),
				onClick: () => onChange({
					...server,
					name: detectedName
				})
			}, t("mcpServers.form.autoFill")) : null), e$7("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.namePlaceholder"),
				value: server.name || "",
				onChange: (evt) => onChange({
					...server,
					name: evt.target.value
				})
			}))), e$7("div", { className: "dsh-sam-field-group" }, e$7("div", { className: "dsh-mcp-label-row" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.description")), canAutofillDesc ? e$7("button", {
				type: "button",
				className: "dsh-mcp-autofill-btn",
				title: t("mcpServers.form.fillDetected", { value: detectedDesc }),
				onClick: () => onChange({
					...server,
					description: detectedDesc
				})
			}, t("mcpServers.form.autoFill")) : null), e$7("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.descriptionPlaceholder"),
				value: server.description || "",
				onChange: (evt) => onChange({
					...server,
					description: evt.target.value
				})
			})), e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.transport")), e$7("select", {
				className: "dsh-sam-select",
				value: server.transport || "stdio",
				onChange: (evt) => onChange({
					...server,
					transport: evt.target.value
				})
			}, e$7("option", { value: "stdio" }, t("mcpServers.form.transportStdio")), e$7("option", { value: "streamable-http" }, t("mcpServers.form.transportHttp")))), server.transport === "stdio" ? e$7(react.Fragment, null, e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.command")), e$7("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.commandPlaceholder"),
				value: server.command || "",
				onChange: (evt) => onChange({
					...server,
					command: evt.target.value
				})
			})), e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.args")), e$7("textarea", {
				className: "dsh-mcp-textarea",
				placeholder: t("mcpServers.form.argsPlaceholder"),
				rows: 3,
				value: (server.args || []).join("\n"),
				onChange: (evt) => onChange({
					...server,
					args: evt.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
				})
			})), e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.cwd")), e$7("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.cwdPlaceholder"),
				value: server.cwd || "",
				onChange: (evt) => onChange({
					...server,
					cwd: evt.target.value
				})
			})), e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.env")), e$7(KeyValueEditor, {
				entries: envEntries,
				onChange: onEnvChange,
				keyPlaceholder: t("mcpServers.form.envKey"),
				valuePlaceholder: t("mcpServers.form.envValue"),
				addLabel: t("mcpServers.form.addEnv")
			}))) : e$7(react.Fragment, null, e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.url")), e$7("input", {
				type: "text",
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.urlPlaceholder"),
				value: server.url || "",
				onChange: (evt) => onChange({
					...server,
					url: evt.target.value
				})
			})), e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.headers")), e$7(KeyValueEditor, {
				entries: headerEntries,
				onChange: onHeaderChange,
				keyPlaceholder: t("mcpServers.form.headerKey"),
				valuePlaceholder: t("mcpServers.form.headerValue"),
				addLabel: t("mcpServers.form.addHeader")
			}))), e$7("div", { className: "dsh-mcp-advanced-box" }, e$7("div", {
				className: "dsh-mcp-advanced-header",
				role: "button",
				tabIndex: 0,
				onClick: onToggleAdvanced
			}, e$7("div", { className: "dsh-mcp-advanced-title-wrap" }, e$7("span", { className: "dsh-mcp-advanced-title" }, t("mcpServers.form.advancedTitle")), e$7("span", { className: "dsh-mcp-advanced-badge" }, showAdvanced ? t("mcpServers.form.collapseAdvanced") : t("mcpServers.form.expandAdvanced")))), showAdvanced ? e$7("div", { className: "dsh-mcp-advanced-content" }, e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.toolCallTimeoutMs")), e$7("input", {
				type: "number",
				min: 1e3,
				step: 1e3,
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.toolCallTimeoutMsPlaceholder"),
				value: server.toolCallTimeoutMs !== void 0 ? server.toolCallTimeoutMs : "",
				onChange: (evt) => onChange({
					...server,
					toolCallTimeoutMs: evt.target.value ? parseInt(evt.target.value, 10) : void 0
				})
			}), e$7("span", { className: "dsh-mcp-field-hint" }, t("mcpServers.form.toolCallTimeoutMsDesc"))), e$7("div", {
				className: `dsh-mcp-switch-card mini ${server.failOnStartupError ? "active" : ""}`,
				role: "button",
				tabIndex: 0,
				onClick: () => onChange({
					...server,
					failOnStartupError: !server.failOnStartupError
				})
			}, e$7("div", { className: "dsh-mcp-switch-text" }, e$7("div", { className: "dsh-mcp-switch-title" }, t("mcpServers.form.failOnStartupError")), e$7("div", { className: "dsh-mcp-switch-desc" }, t("mcpServers.form.failOnStartupErrorDesc"))), e$7("div", {
				className: `dsh-mcp-switch-btn ${server.failOnStartupError ? "active" : ""}`,
				"aria-hidden": "true"
			}, e$7("span", { className: "dsh-mcp-switch-thumb" }))), e$7("div", {
				className: `dsh-mcp-switch-card mini ${server.reconnect?.enabled !== false ? "active" : ""}`,
				role: "button",
				tabIndex: 0,
				onClick: () => onChange({
					...server,
					reconnect: {
						...server.reconnect,
						enabled: server.reconnect?.enabled === false
					}
				})
			}, e$7("div", { className: "dsh-mcp-switch-text" }, e$7("div", { className: "dsh-mcp-switch-title" }, t("mcpServers.form.reconnectEnabled")), e$7("div", { className: "dsh-mcp-switch-desc" }, t("mcpServers.form.reconnectEnabledDesc"))), e$7("div", {
				className: `dsh-mcp-switch-btn ${server.reconnect?.enabled !== false ? "active" : ""}`,
				"aria-hidden": "true"
			}, e$7("span", { className: "dsh-mcp-switch-thumb" }))), server.reconnect?.enabled !== false ? e$7("div", { className: "dsh-mcp-form-row-3" }, e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.reconnectInitialDelayMs")), e$7("input", {
				type: "number",
				min: 0,
				step: 100,
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.reconnectInitialDelayMsPlaceholder"),
				value: server.reconnect?.initialDelayMs !== void 0 ? server.reconnect.initialDelayMs : "",
				onChange: (evt) => onChange({
					...server,
					reconnect: {
						...server.reconnect,
						initialDelayMs: evt.target.value ? parseInt(evt.target.value, 10) : void 0
					}
				})
			})), e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.reconnectMaxDelayMs")), e$7("input", {
				type: "number",
				min: 0,
				step: 1e3,
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.reconnectMaxDelayMsPlaceholder"),
				value: server.reconnect?.maxDelayMs !== void 0 ? server.reconnect.maxDelayMs : "",
				onChange: (evt) => onChange({
					...server,
					reconnect: {
						...server.reconnect,
						maxDelayMs: evt.target.value ? parseInt(evt.target.value, 10) : void 0
					}
				})
			})), e$7("div", { className: "dsh-sam-field-group" }, e$7("label", { className: "dsh-sam-field-label" }, t("mcpServers.form.reconnectMaxAttempts")), e$7("input", {
				type: "number",
				min: 0,
				step: 1,
				className: "dsh-sam-select",
				placeholder: t("mcpServers.form.reconnectMaxAttemptsPlaceholder"),
				value: server.reconnect?.maxAttempts !== void 0 ? server.reconnect.maxAttempts : "",
				onChange: (evt) => onChange({
					...server,
					reconnect: {
						...server.reconnect,
						maxAttempts: evt.target.value ? parseInt(evt.target.value, 10) : void 0
					}
				})
			}))) : null) : null)));
		}
		//#endregion
		//#region src/client/mcp/components/McpToolsModal.ts
		const e$6 = react.createElement;
		function McpToolsModal({ open, server, loading, error, toolsList, disabledToolsSet, serverInfo, detectedTransport, saving, onToggleTool, onToggleAllTools, onRefresh, onClose, onSave, t }) {
			const [search, setSearch] = react.useState("");
			const [expandedSchemas, setExpandedSchemas] = react.useState(/* @__PURE__ */ new Set());
			const [schemaModes, setSchemaModes] = react.useState({});
			if (!open || !server) return null;
			const handleToggleSchema = (toolName) => {
				setExpandedSchemas((prev) => {
					const next = new Set(prev);
					if (next.has(toolName)) next.delete(toolName);
					else next.add(toolName);
					return next;
				});
			};
			const filteredTools = toolsList.filter((tool) => {
				const q = search.trim().toLowerCase();
				if (!q) return true;
				return tool.name.toLowerCase().includes(q) || tool.description && tool.description.toLowerCase().includes(q);
			});
			const effectiveInfo = serverInfo || server.serverInfo;
			const headerMeta = e$6("div", { className: "dsh-mcp-tools-header-meta" }, e$6(ServerIcon, {
				server,
				serverInfo: effectiveInfo,
				transport: server.transport,
				size: 16
			}), e$6("span", { className: "dsh-mcp-card-name" }, server.name || server.id), server.id && server.id !== server.name ? e$6("span", { className: "dsh-mcp-card-id" }, server.id) : null, e$6("span", { className: `dsh-mcp-proto-badge ${server.transport === "stdio" ? "stdio" : detectedTransport ?? server.transport ?? "streamable-http"}` }, server.transport === "stdio" ? "STDIO" : detectedTransport === "sse" ? "SSE" : detectedTransport === "streamable-http" ? "Streamable HTTP" : "HTTP / SSE"), effectiveInfo?.websiteUrl ? e$6("a", {
				key: "website",
				href: effectiveInfo.websiteUrl,
				target: "_blank",
				rel: "noopener noreferrer",
				className: "dsh-mcp-proto-badge website",
				title: effectiveInfo.websiteUrl
			}, "🔗 " + t("mcpServers.table.website")) : null, effectiveInfo?.version ? e$6("span", {
				className: "dsh-mcp-proto-badge server-version",
				title: formatProtocolTitle(effectiveInfo, t)
			}, effectiveInfo.name && effectiveInfo.name !== server.id && effectiveInfo.name !== server.name ? `${effectiveInfo.name} ${effectiveInfo.version}` : effectiveInfo.version) : effectiveInfo?.protocolVersion ? e$6("span", {
				className: "dsh-mcp-proto-badge server-version",
				title: formatProtocolTitle(effectiveInfo, t)
			}, `MCP ${effectiveInfo.protocolVersion}`) : null);
			return e$6(ModalDialog, {
				open: Boolean(server),
				onClose,
				title: t("mcpServers.toolsModal.title"),
				headerExtra: headerMeta,
				panelClassName: "dsh-mcp-tools-modal",
				footer: [e$6("div", {
					key: "left",
					className: "dsh-mcp-modal-footer-left"
				}, e$6("span", { style: {
					fontSize: 12,
					color: "var(--dsw-alias-label-secondary)"
				} }, t("sessionSettings.mcp.toolsEnabledCount", {
					enabled: toolsList.length - disabledToolsSet.size,
					total: toolsList.length
				}))), e$6("div", {
					key: "right",
					className: "dsh-mcp-modal-footer-right"
				}, e$6("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					onClick: onClose
				}, t("mcpServers.actions.cancel")), e$6("button", {
					type: "button",
					className: "dsh-sam-btn primary",
					disabled: saving,
					onClick: onSave
				}, saving ? t("mcpServers.toolsModal.saving") : t("mcpServers.toolsModal.save")))]
			}, e$6(SearchToolbar, {
				value: search,
				onChange: setSearch,
				placeholder: t("mcpServers.toolsModal.searchPlaceholder"),
				actions: [
					e$6("button", {
						key: "enableAll",
						type: "button",
						className: "dsh-sam-btn secondary",
						disabled: loading || toolsList.length === 0,
						onClick: () => onToggleAllTools(true)
					}, t("mcpServers.toolsModal.enableAll")),
					e$6("button", {
						key: "disableAll",
						type: "button",
						className: "dsh-sam-btn secondary",
						disabled: loading || toolsList.length === 0,
						onClick: () => onToggleAllTools(false)
					}, t("mcpServers.toolsModal.disableAll")),
					e$6("button", {
						key: "retry",
						type: "button",
						className: "dsh-sam-btn secondary",
						disabled: loading,
						onClick: onRefresh,
						title: t("mcpServers.toolsModal.retry")
					}, loading ? e$6(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
						size: 14,
						className: "dsh-spin"
					}) : e$6(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }), loading ? t("mcpServers.actions.toolsFetching") : t("mcpServers.toolsModal.retry"))
				]
			}), loading ? e$6("div", {
				className: "dsh-sam-desc",
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					padding: "32px 0"
				}
			}, e$6(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
				size: 16,
				className: "dsh-spin"
			}), t("mcpServers.toolsModal.loading")) : error ? e$6("div", {
				className: "dsh-sam-notice error",
				style: { margin: "14px 0" }
			}, t("mcpServers.toolsModal.fetchFailed") + error) : toolsList.length === 0 ? e$6("div", {
				className: "dsh-sam-desc",
				style: {
					padding: "32px 0",
					textAlign: "center"
				}
			}, t("mcpServers.toolsModal.serverNoTools")) : filteredTools.length === 0 ? e$6("div", {
				className: "dsh-sam-desc",
				style: {
					padding: "32px 0",
					textAlign: "center"
				}
			}, t("mcpServers.toolsModal.empty")) : e$6("div", { className: "dsh-mcp-tools-list" }, filteredTools.map((tool) => {
				const isDisabled = disabledToolsSet.has(tool.name);
				const isSchemaExpanded = expandedSchemas.has(tool.name);
				const hasSchema = tool.inputSchema && Object.keys(tool.inputSchema).length > 0;
				return e$6("div", {
					key: tool.name,
					className: `dsh-mcp-tool-card ${isDisabled ? "disabled" : ""}`
				}, e$6("div", { className: "dsh-mcp-tool-card-main" }, e$6("div", { className: "dsh-mcp-tool-card-left" }, e$6("div", {
					className: `dsh-mcp-switch-btn ${!isDisabled ? "active" : ""}`,
					role: "button",
					tabIndex: 0,
					style: {
						marginTop: 2,
						cursor: "pointer"
					},
					onClick: () => onToggleTool(tool.name),
					onKeyDown: (evt) => {
						if (evt.key === "Enter" || evt.key === " ") {
							evt.preventDefault();
							onToggleTool(tool.name);
						}
					},
					title: !isDisabled ? t("mcpServers.toolsModal.statusEnabled") : t("mcpServers.toolsModal.statusDisabled")
				}, e$6("span", { className: "dsh-mcp-switch-thumb" })), e$6("div", { className: "dsh-mcp-tool-info" }, e$6("div", { className: "dsh-mcp-tool-title-row" }, e$6("span", { className: "dsh-mcp-tool-name" }, tool.name), e$6("span", { className: `dsh-mcp-tool-status-pill ${!isDisabled ? "active" : "disabled"}` }, !isDisabled ? t("mcpServers.toolsModal.statusEnabled") : t("mcpServers.toolsModal.statusDisabled"))), tool.description ? e$6("div", { className: "dsh-mcp-tool-desc" }, tool.description) : null)), hasSchema ? e$6("button", {
					type: "button",
					className: `dsh-mcp-tool-schema-btn ${isSchemaExpanded ? "active" : ""}`,
					onClick: () => handleToggleSchema(tool.name)
				}, isSchemaExpanded ? t("mcpServers.toolsModal.hideParameters") : t("mcpServers.toolsModal.parameters")) : null), isSchemaExpanded && hasSchema ? e$6(SchemaViewer, {
					schema: tool.inputSchema,
					mode: schemaModes[tool.name] || "list",
					onModeChange: (m) => setSchemaModes((prev) => ({
						...prev,
						[tool.name]: m
					})),
					t
				}) : null);
			})));
		}
		//#endregion
		//#region src/client/mcp/components/McpImportExportModal.ts
		const e$5 = react.createElement;
		function McpImportExportModal({ open, text, onChange, importing, error, onSubmit, onClose, t }) {
			if (!open) return null;
			return e$5(ModalDialog, {
				open,
				onClose,
				title: t("mcpServers.importModal.title"),
				subtitle: t("mcpServers.importModal.desc"),
				panelClassName: "dsh-mcp-import-modal",
				footer: [e$5("div", {
					key: "left",
					className: "dsh-mcp-modal-footer-left"
				}), e$5("div", {
					key: "right",
					className: "dsh-mcp-modal-footer-right"
				}, e$5("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					onClick: onClose
				}, t("mcpServers.actions.cancel")), e$5("button", {
					type: "button",
					className: "dsh-sam-btn primary",
					disabled: importing || !text.trim(),
					onClick: onSubmit
				}, importing ? t("mcpServers.importModal.importing") : t("mcpServers.importModal.confirm")))]
			}, error ? e$5("div", { className: "dsh-sam-notice error" }, error) : null, e$5("textarea", {
				className: "dsh-mcp-import-textarea",
				rows: 10,
				placeholder: t("mcpServers.importModal.placeholder"),
				value: text,
				onChange: (evt) => onChange(evt.target.value)
			}));
		}
		//#endregion
		//#region src/client/mcp/components/McpSaveConfirmModal.ts
		const e$4 = react.createElement;
		function McpSaveConfirmModal({ confirmState, onCancel, onConfirm, t }) {
			if (!confirmState?.open) return null;
			return e$4(ModalDialog, {
				open: Boolean(confirmState?.open),
				onClose: onCancel,
				title: t("mcpServers.saveConfirmModal.title"),
				icon: e$4(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 18 }),
				overlayClassName: "dsh-sam-modal-overlay dsh-mcp-confirm-overlay",
				panelClassName: "dsh-mcp-confirm-modal",
				footer: [e$4("div", {
					key: "left",
					className: "dsh-mcp-modal-footer-left"
				}), e$4("div", {
					key: "right",
					className: "dsh-mcp-modal-footer-right"
				}, e$4("button", {
					type: "button",
					className: "dsh-sam-btn secondary",
					onClick: onCancel
				}, t("mcpServers.saveConfirmModal.cancel")), e$4("button", {
					type: "button",
					className: "dsh-sam-btn primary",
					onClick: () => onConfirm(confirmState.payload)
				}, t("mcpServers.saveConfirmModal.saveAnyway")))]
			}, e$4("p", { className: "dsh-mcp-confirm-msg" }, t("mcpServers.saveConfirmModal.message")), e$4("div", { className: "dsh-mcp-confirm-detail" }, confirmState.message), e$4("p", { className: "dsh-mcp-confirm-prompt" }, t("mcpServers.saveConfirmModal.prompt")));
		}
		//#endregion
		//#region src/client/mcp/index.ts
		const e$3 = react.createElement;
		function McpServersSettingsTab({ api: _api, t, close: _close }) {
			const { servers, setServers, loading, error, successMsg, setSuccessMsg, loadServers, handleDelete, handleTest, testingId, testResults, executeSave } = useMcpServers(t);
			const [formOpen, setFormOpen] = react.useState(false);
			const [isEditing, setIsEditing] = react.useState(false);
			const [editingOriginalId, setEditingOriginalId] = react.useState(null);
			const [formServer, setFormServer] = react.useState({
				transport: "stdio",
				enabledByDefault: false
			});
			const [envEntries, setEnvEntries] = react.useState([]);
			const [headerEntries, setHeaderEntries] = react.useState([]);
			const [formSaving, setFormSaving] = react.useState(false);
			const [formTesting, setFormTesting] = react.useState(false);
			const [formError, setFormError] = react.useState("");
			const [showAdvanced, setShowAdvanced] = react.useState(false);
			const [formTestResult, setFormTestResult] = react.useState(null);
			const [saveConfirm, setSaveConfirm] = react.useState(null);
			const [importOpen, setImportOpen] = react.useState(false);
			const [importText, setImportText] = react.useState("");
			const [importing, setImporting] = react.useState(false);
			const [importError, setImportError] = react.useState("");
			const [toolsModalOpen, setToolsModalOpen] = react.useState(false);
			const [toolsTargetServer, setToolsTargetServer] = react.useState(null);
			const [toolsSource, setToolsSource] = react.useState("card");
			const [toolsLoading, setToolsLoading] = react.useState(false);
			const [toolsError, setToolsError] = react.useState("");
			const [toolsList, setToolsList] = react.useState([]);
			const [toolsDisabledSet, setToolsDisabledSet] = react.useState(/* @__PURE__ */ new Set());
			const [toolsServerInfo, setToolsServerInfo] = react.useState(null);
			const [toolsDetectedTransport, setToolsDetectedTransport] = react.useState(null);
			const [toolsSaving, setToolsSaving] = react.useState(false);
			const handleOpenAdd = () => {
				setIsEditing(false);
				setEditingOriginalId(null);
				setShowAdvanced(false);
				setFormServer({
					id: "",
					name: "",
					description: "",
					transport: "stdio",
					command: "",
					args: [],
					cwd: "",
					url: "",
					enabledByDefault: false,
					toolCallTimeoutMs: void 0,
					failOnStartupError: false,
					reconnect: {
						enabled: true,
						initialDelayMs: void 0,
						maxDelayMs: void 0,
						maxAttempts: void 0
					},
					disabledTools: []
				});
				setEnvEntries([]);
				setHeaderEntries([]);
				setFormError("");
				setFormTestResult(null);
				setFormOpen(true);
			};
			const handleOpenEdit = (server) => {
				setIsEditing(true);
				setEditingOriginalId(server.id);
				setShowAdvanced(Boolean(server.toolCallTimeoutMs || server.failOnStartupError || server.reconnect && (server.reconnect.enabled === false || server.reconnect.initialDelayMs !== void 0 || server.reconnect.maxDelayMs !== void 0 || server.reconnect.maxAttempts !== void 0)));
				setFormServer({
					...server,
					reconnect: {
						enabled: server.reconnect?.enabled !== false,
						initialDelayMs: server.reconnect?.initialDelayMs,
						maxDelayMs: server.reconnect?.maxDelayMs,
						maxAttempts: server.reconnect?.maxAttempts
					},
					disabledTools: Array.isArray(server.disabledTools) ? [...server.disabledTools] : []
				});
				setEnvEntries(server.env ? Object.entries(server.env).map(([key, value]) => ({
					key,
					value
				})) : []);
				setHeaderEntries(server.headers ? Object.entries(server.headers).map(([key, value]) => ({
					key,
					value
				})) : []);
				setFormError("");
				setFormTestResult(null);
				setFormOpen(true);
			};
			const handleFormTest = async () => {
				setFormError("");
				setFormTestResult(null);
				if (formServer.transport === "stdio" && !formServer.command?.trim()) {
					setFormError(t("mcpServers.form.command") + " is required for stdio");
					return;
				}
				if (formServer.transport !== "stdio" && !formServer.url?.trim()) {
					setFormError(t("mcpServers.form.url") + " is required for HTTP/SSE");
					return;
				}
				const envMap = {};
				for (const item of envEntries) if (item.key.trim()) envMap[item.key.trim()] = item.value;
				const headerMap = {};
				for (const item of headerEntries) if (item.key.trim()) headerMap[item.key.trim()] = item.value;
				const serverObj = {
					id: formServer.id?.trim() || "modal_test",
					transport: formServer.transport,
					command: formServer.command?.trim(),
					args: formServer.args || [],
					cwd: formServer.cwd?.trim() || void 0,
					env: Object.keys(envMap).length > 0 ? envMap : void 0,
					url: formServer.url?.trim(),
					headers: Object.keys(headerMap).length > 0 ? headerMap : void 0,
					toolCallTimeoutMs: formServer.toolCallTimeoutMs && formServer.toolCallTimeoutMs > 0 ? Number(formServer.toolCallTimeoutMs) : void 0,
					failOnStartupError: Boolean(formServer.failOnStartupError),
					reconnect: formServer.reconnect
				};
				setFormTesting(true);
				try {
					const data = await (await fetch(API_ENDPOINTS.mcpServersTest, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ server: serverObj })
					})).json();
					setFormTestResult({
						ok: Boolean(data.ok),
						message: data.message || (data.ok ? "Connection OK" : "Failed")
					});
					if (data.ok) setFormServer((prev) => {
						const updated = {
							...prev,
							detectedTransport: data.detectedTransport || prev.detectedTransport,
							serverInfo: data.serverInfo || prev.serverInfo,
							lastTestedAt: Date.now()
						};
						if (!isEditing) {
							const detectedId = data.serverInfo?.name ? data.serverInfo.name.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) : "";
							const detectedName = data.serverInfo?.title || data.serverInfo?.name || "";
							const detectedDesc = data.serverInfo?.description || "";
							if (!updated.id?.trim() && detectedId) updated.id = detectedId;
							if (!updated.name?.trim() && detectedName) updated.name = detectedName;
							if (!updated.description?.trim() && detectedDesc) updated.description = detectedDesc;
						}
						return updated;
					});
				} catch (err) {
					setFormTestResult({
						ok: false,
						message: err instanceof Error ? err.message : String(err)
					});
				} finally {
					setFormTesting(false);
				}
			};
			const fetchToolsForServer = async (server) => {
				setToolsLoading(true);
				setToolsError("");
				try {
					const data = await (await fetch(API_ENDPOINTS.mcpServersTools, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ server })
					})).json();
					if (data.ok) {
						if (data.serverInfo) setToolsServerInfo(data.serverInfo);
						if (data.detectedTransport) setToolsDetectedTransport(data.detectedTransport);
						if (server.id) setServers((prev) => prev.map((s) => s.id === server.id ? {
							...s,
							detectedTransport: data.detectedTransport || s.detectedTransport,
							serverInfo: data.serverInfo || s.serverInfo,
							tools: data.tools || s.tools,
							lastTestedAt: Date.now()
						} : s));
						if (Array.isArray(data.toolDetails)) setToolsList(data.toolDetails);
						else if (Array.isArray(data.tools)) setToolsList(data.tools.map((t) => typeof t === "string" ? { name: t } : t));
					} else {
						setToolsList([]);
						setToolsError(data.message || "Failed to fetch tools from MCP server");
					}
				} catch (err) {
					setToolsList([]);
					setToolsError(err instanceof Error ? err.message : String(err));
				} finally {
					setToolsLoading(false);
				}
			};
			const handleOpenTools = (server, source = "card") => {
				setToolsTargetServer(server);
				setToolsSource(source);
				setToolsDisabledSet(new Set(Array.isArray(server.disabledTools) ? server.disabledTools : []));
				setToolsList([]);
				setToolsServerInfo(null);
				setToolsDetectedTransport(null);
				setToolsModalOpen(true);
				fetchToolsForServer(server);
			};
			const handleFormOpenTools = () => {
				if (formServer.transport === "stdio" && !formServer.command?.trim()) {
					setFormError(t("mcpServers.form.command") + " is required for stdio");
					return;
				}
				if (formServer.transport !== "stdio" && !formServer.url?.trim()) {
					setFormError(t("mcpServers.form.url") + " is required for HTTP/SSE");
					return;
				}
				const envMap = {};
				for (const item of envEntries) if (item.key.trim()) envMap[item.key.trim()] = item.value;
				const headerMap = {};
				for (const item of headerEntries) if (item.key.trim()) headerMap[item.key.trim()] = item.value;
				const serverObj = {
					id: formServer.id?.trim() || "modal_tools",
					name: formServer.name?.trim() || "MCP Server",
					description: formServer.description?.trim(),
					transport: formServer.transport,
					command: formServer.command?.trim(),
					args: formServer.args || [],
					cwd: formServer.cwd?.trim() || void 0,
					env: Object.keys(envMap).length > 0 ? envMap : void 0,
					url: formServer.url?.trim(),
					headers: Object.keys(headerMap).length > 0 ? headerMap : void 0,
					toolCallTimeoutMs: formServer.toolCallTimeoutMs && formServer.toolCallTimeoutMs > 0 ? Number(formServer.toolCallTimeoutMs) : void 0,
					failOnStartupError: Boolean(formServer.failOnStartupError),
					reconnect: formServer.reconnect,
					disabledTools: formServer.disabledTools || []
				};
				handleOpenTools(serverObj, "form");
			};
			const handleToggleTool = (toolName) => {
				setToolsDisabledSet((prev) => {
					const next = new Set(prev);
					if (next.has(toolName)) next.delete(toolName);
					else next.add(toolName);
					return next;
				});
			};
			const handleToggleAllTools = (enableAll) => {
				if (enableAll) setToolsDisabledSet(/* @__PURE__ */ new Set());
				else setToolsDisabledSet(new Set(toolsList.map((t) => t.name)));
			};
			const handleSaveToolsModal = async () => {
				const disabledArray = Array.from(toolsDisabledSet);
				if (toolsSource === "form") {
					setFormServer((prev) => ({
						...prev,
						disabledTools: disabledArray
					}));
					setToolsModalOpen(false);
					setSuccessMsg(t("mcpServers.toolsModal.saveSuccess"));
					setTimeout(() => setSuccessMsg(""), 3e3);
					return;
				}
				if (!toolsTargetServer?.id) {
					setToolsModalOpen(false);
					return;
				}
				setToolsSaving(true);
				try {
					const updatedServer = {
						...servers.find((s) => s.id === toolsTargetServer.id) || toolsTargetServer,
						disabledTools: disabledArray
					};
					const res = await fetch(API_ENDPOINTS.mcpServersEdit, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ server: updatedServer })
					});
					const data = await res.json();
					if (res.ok && data.ok) {
						setServers((prev) => prev.map((s) => s.id === updatedServer.id ? data.server || updatedServer : s));
						setToolsModalOpen(false);
						setSuccessMsg(t("mcpServers.toolsModal.saveSuccess"));
						setTimeout(() => setSuccessMsg(""), 3e3);
					} else setToolsError(data.error || "Failed to save tool settings");
				} catch (err) {
					setToolsError(err instanceof Error ? err.message : String(err));
				} finally {
					setToolsSaving(false);
				}
			};
			const handleSaveForm = async () => {
				setFormError("");
				if (!formServer.id?.trim()) {
					setFormError(t("mcpServers.form.id") + " is required");
					return;
				}
				if (!/^[a-zA-Z0-9_-]+$/.test(formServer.id.trim())) {
					setFormError("ID can only contain letters, numbers, underscores, and hyphens");
					return;
				}
				if (servers.some((s) => s.id.toLowerCase() === formServer.id?.trim().toLowerCase() && (!isEditing || s.id.toLowerCase() !== editingOriginalId?.toLowerCase()))) {
					setFormError(`Server ID "${formServer.id}" already exists`);
					return;
				}
				if (formServer.transport === "stdio" && !formServer.command?.trim()) {
					setFormError(t("mcpServers.form.command") + " is required for stdio");
					return;
				}
				if (formServer.transport !== "stdio" && !formServer.url?.trim()) {
					setFormError(t("mcpServers.form.url") + " is required for HTTP/SSE");
					return;
				}
				const envMap = {};
				for (const item of envEntries) if (item.key.trim()) envMap[item.key.trim()] = item.value;
				const headerMap = {};
				for (const item of headerEntries) if (item.key.trim()) headerMap[item.key.trim()] = item.value;
				const payload = {
					id: formServer.id.trim(),
					name: formServer.name?.trim() || formServer.id.trim(),
					description: formServer.description?.trim() || void 0,
					transport: formServer.transport || "stdio",
					command: formServer.transport === "stdio" ? formServer.command?.trim() : void 0,
					args: formServer.transport === "stdio" ? formServer.args || [] : void 0,
					cwd: formServer.transport === "stdio" ? formServer.cwd?.trim() || void 0 : void 0,
					env: formServer.transport === "stdio" && Object.keys(envMap).length > 0 ? envMap : void 0,
					url: formServer.transport !== "stdio" ? formServer.url?.trim() : void 0,
					headers: formServer.transport !== "stdio" && Object.keys(headerMap).length > 0 ? headerMap : void 0,
					enabledByDefault: Boolean(formServer.enabledByDefault),
					toolCallTimeoutMs: formServer.toolCallTimeoutMs && formServer.toolCallTimeoutMs > 0 ? Number(formServer.toolCallTimeoutMs) : void 0,
					failOnStartupError: Boolean(formServer.failOnStartupError),
					reconnect: formServer.reconnect,
					disabledTools: formServer.disabledTools || [],
					detectedTransport: formServer.detectedTransport,
					serverInfo: formServer.serverInfo
				};
				setFormSaving(true);
				try {
					const testData = await (await fetch(API_ENDPOINTS.mcpServersTest, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ server: payload })
					})).json();
					if (testData && testData.ok) {
						payload.detectedTransport = testData.detectedTransport || payload.detectedTransport;
						payload.serverInfo = testData.serverInfo || payload.serverInfo;
						payload.lastTestedAt = Date.now();
						const saveRes = await executeSave(payload, isEditing && editingOriginalId ? editingOriginalId : void 0);
						if (saveRes.ok) setFormOpen(false);
						else setFormError(saveRes.error || "Failed to save server");
					} else setSaveConfirm({
						open: true,
						message: testData?.message || "Failed to establish connection to the MCP server.",
						payload
					});
				} catch {
					setSaveConfirm({
						open: true,
						message: "Network request failed while testing connection.",
						payload
					});
				} finally {
					setFormSaving(false);
				}
			};
			const handleConfirmSave = async (payload) => {
				setFormSaving(true);
				setSaveConfirm(null);
				const saveRes = await executeSave(payload, isEditing && editingOriginalId ? editingOriginalId : void 0);
				setFormSaving(false);
				if (saveRes.ok) setFormOpen(false);
				else setFormError(saveRes.error || "Failed to save server");
			};
			const handleExport = () => {
				const mcpServersMap = {};
				for (const s of servers) if (s.transport === "stdio") mcpServersMap[s.id] = {
					command: s.command,
					args: s.args,
					cwd: s.cwd,
					env: s.env
				};
				else mcpServersMap[s.id] = {
					url: s.url,
					headers: s.headers
				};
				const jsonStr = JSON.stringify({ mcpServers: mcpServersMap }, null, 2);
				const blob = new Blob([jsonStr], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = "mcp-servers.json";
				a.click();
				URL.revokeObjectURL(url);
			};
			const handleImportSubmit = async () => {
				setImportError("");
				setImporting(true);
				try {
					const parsed = JSON.parse(importText);
					const res = await fetch(API_ENDPOINTS.mcpServersImport, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ data: parsed })
					});
					const data = await res.json();
					if (res.ok && data.ok) {
						setServers(data.servers || []);
						setImportOpen(false);
						setSuccessMsg(t("mcpServers.importModal.success", { count: data.count || 0 }));
						setTimeout(() => setSuccessMsg(""), 3e3);
					} else setImportError(data.message || t("mcpServers.importModal.error"));
				} catch (err) {
					setImportError(t("mcpServers.importModal.error") + ": " + (err instanceof Error ? err.message : String(err)));
				} finally {
					setImporting(false);
				}
			};
			return e$3("div", { className: "dsh-mcp-settings-page" }, e$3("div", { className: "dsh-mcp-header-card" }, e$3("div", { className: "dsh-mcp-header-title-row" }, e$3("div", null, e$3("h2", { className: "dsh-mcp-page-title" }, t("mcpServers.title")), e$3("p", { className: "dsh-mcp-page-desc" }, t("mcpServers.desc"))), e$3("div", { className: "dsh-mcp-header-actions" }, e$3("button", {
				type: "button",
				className: "dsh-sam-btn primary",
				onClick: handleOpenAdd
			}, e$3(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), t("mcpServers.actions.add")), e$3("button", {
				type: "button",
				className: "dsh-sam-btn secondary",
				onClick: () => {
					setImportText("");
					setImportError("");
					setImportOpen(true);
				}
			}, e$3(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutline16, { size: 14 }), t("mcpServers.actions.import")), e$3("button", {
				type: "button",
				className: "dsh-sam-btn secondary",
				disabled: servers.length === 0,
				onClick: handleExport
			}, e$3(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, { size: 14 }), t("mcpServers.actions.export")), e$3("button", {
				type: "button",
				className: "dsh-sam-btn secondary dsh-mcp-refresh-btn",
				onClick: loadServers,
				title: t("mcpServers.actions.refresh")
			}, e$3(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }))))), successMsg ? e$3("div", { className: "dsh-sam-notice success" }, successMsg) : null, error ? e$3("div", { className: "dsh-sam-notice error" }, error) : null, loading ? e$3("div", {
				className: "dsh-sam-loading",
				style: {
					padding: "48px 0",
					textAlign: "center"
				}
			}, e$3(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
				size: 24,
				className: "dsh-spin"
			})) : servers.length === 0 ? e$3(EmptyState, {
				message: t("mcpServers.table.empty"),
				action: e$3("button", {
					type: "button",
					className: "dsh-sam-btn primary",
					onClick: handleOpenAdd
				}, t("mcpServers.actions.add"))
			}) : e$3("div", { className: "dsh-mcp-server-list" }, servers.map((server) => e$3(McpServerCard, {
				key: server.id,
				server,
				isTesting: testingId === server.id,
				testResult: testResults[server.id],
				onTest: handleTest,
				onOpenTools: handleOpenTools,
				onOpenEdit: handleOpenEdit,
				onDelete: handleDelete,
				t
			}))), e$3(McpServerFormModal, {
				open: formOpen,
				isEditing,
				server: formServer,
				onChange: setFormServer,
				envEntries,
				onEnvChange: setEnvEntries,
				headerEntries,
				onHeaderChange: setHeaderEntries,
				saving: formSaving,
				testing: formTesting,
				error: formError,
				testResult: formTestResult,
				showAdvanced,
				onToggleAdvanced: () => setShowAdvanced((prev) => !prev),
				onTest: handleFormTest,
				onOpenTools: handleFormOpenTools,
				onClose: () => setFormOpen(false),
				onSave: handleSaveForm,
				t
			}), e$3(McpToolsModal, {
				open: toolsModalOpen,
				server: toolsTargetServer,
				loading: toolsLoading,
				error: toolsError,
				toolsList,
				disabledToolsSet: toolsDisabledSet,
				serverInfo: toolsServerInfo,
				detectedTransport: toolsDetectedTransport,
				saving: toolsSaving,
				onToggleTool: handleToggleTool,
				onToggleAllTools: handleToggleAllTools,
				onRefresh: () => fetchToolsForServer(toolsTargetServer),
				onClose: () => setToolsModalOpen(false),
				onSave: handleSaveToolsModal,
				t
			}), e$3(McpImportExportModal, {
				open: importOpen,
				text: importText,
				onChange: setImportText,
				importing,
				error: importError,
				onSubmit: handleImportSubmit,
				onClose: () => setImportOpen(false),
				t
			}), e$3(McpSaveConfirmModal, {
				confirmState: saveConfirm,
				onCancel: () => setSaveConfirm(null),
				onConfirm: handleConfirmSave,
				t
			}));
		}
		//#endregion
		//#region src/client/skills/hooks/useGlobalSkills.ts
		function useGlobalSkills(t) {
			const [skills, setSkills] = react.useState([]);
			const [globalConfig, setGlobalConfig] = react.useState({
				subagentModel: { inherit: true },
				mcp: { enabledServerIds: [] },
				skills: {
					disabledModelSkills: [],
					disabledUserSkills: []
				}
			});
			const [defaultDisabledModelList, setDefaultDisabledModelList] = react.useState([]);
			const [defaultDisabledUserList, setDefaultDisabledUserList] = react.useState([]);
			const [loading, setLoading] = react.useState(true);
			const [saving, setSaving] = react.useState(false);
			const [search, setSearch] = react.useState("");
			const [error, setError] = react.useState("");
			const [successMsg, setSuccessMsg] = react.useState("");
			const [selectedSkillForModal, setSelectedSkillForModal] = react.useState(null);
			const [skillsContentMap, setSkillsContentMap] = react.useState({});
			const [skillsLoadingMap, setSkillsLoadingMap] = react.useState({});
			const defaultDisabledModelSet = react.useMemo(() => new Set(defaultDisabledModelList), [defaultDisabledModelList]);
			const defaultDisabledUserSet = react.useMemo(() => new Set(defaultDisabledUserList), [defaultDisabledUserList]);
			const nonRuntimeSkills = react.useMemo(() => skills.filter((s) => !s.isRuntime), [skills]);
			const filteredSkills = react.useMemo(() => {
				const q = search.trim().toLowerCase();
				if (!q) return skills;
				return skills.filter((s) => s.name.toLowerCase().includes(q) || s.description && s.description.toLowerCase().includes(q));
			}, [skills, search]);
			const enabledCount = react.useMemo(() => nonRuntimeSkills.filter((s) => !defaultDisabledModelSet.has(s.name)).length, [nonRuntimeSkills, defaultDisabledModelSet]);
			const loadSkills = async () => {
				setLoading(true);
				setError("");
				try {
					const [skillsRes, settingsRes] = await Promise.all([fetch(API_ENDPOINTS.skills), fetch(API_ENDPOINTS.getSettings)]);
					if (skillsRes.ok) {
						const skillsData = await skillsRes.json();
						if (skillsData?.ok && Array.isArray(skillsData.skills)) setSkills(skillsData.skills);
					}
					if (settingsRes.ok) {
						const settingsData = await settingsRes.json();
						if (settingsData?.ok && settingsData.globalConfig) {
							setGlobalConfig(settingsData.globalConfig);
							if (settingsData.globalConfig.skills) {
								const mList = settingsData.globalConfig.skills.disabledModelSkills || [];
								const uList = settingsData.globalConfig.skills.disabledUserSkills || [];
								setDefaultDisabledModelList(mList);
								setDefaultDisabledUserList(uList);
							}
						}
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			};
			react.useEffect(() => {
				loadSkills();
			}, []);
			const handleToggleModelInvocable = (skillName) => {
				setSuccessMsg("");
				setError("");
				setDefaultDisabledModelList((prev) => prev.includes(skillName) ? prev.filter((n) => n !== skillName) : [...prev, skillName]);
			};
			const handleToggleUserInvocable = (skillName) => {
				setSuccessMsg("");
				setError("");
				setDefaultDisabledUserList((prev) => prev.includes(skillName) ? prev.filter((n) => n !== skillName) : [...prev, skillName]);
			};
			const handleSaveSkillModal = async (skillName, modelDisabled, userDisabled) => {
				setSaving(true);
				setError("");
				setSuccessMsg("");
				const nextModelList = modelDisabled ? Array.from(/* @__PURE__ */ new Set([...defaultDisabledModelList, skillName])) : defaultDisabledModelList.filter((n) => n !== skillName);
				const nextUserList = userDisabled ? Array.from(/* @__PURE__ */ new Set([...defaultDisabledUserList, skillName])) : defaultDisabledUserList.filter((n) => n !== skillName);
				const payloadGlobalConfig = {
					subagentModel: globalConfig.subagentModel || { inherit: true },
					mcp: globalConfig.mcp || { enabledServerIds: [] },
					skills: {
						disabledModelSkills: nextModelList,
						disabledUserSkills: nextUserList
					}
				};
				try {
					const res = await fetch(API_ENDPOINTS.saveSettings, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							globalConfig: payloadGlobalConfig,
							isDefault: true
						})
					});
					const data = await res.json();
					if (res.ok && data?.ok) {
						setGlobalConfig(payloadGlobalConfig);
						setDefaultDisabledModelList(nextModelList);
						setDefaultDisabledUserList(nextUserList);
						setSelectedSkillForModal(null);
						setSuccessMsg(t("skillsSettings.notices.saved"));
						setTimeout(() => setSuccessMsg(""), 3500);
					} else setError(t("skillsSettings.notices.saveError") + (data?.error || "Unknown error"));
				} catch (err) {
					setError(t("skillsSettings.notices.saveError") + (err instanceof Error ? err.message : String(err)));
				} finally {
					setSaving(false);
				}
			};
			const handleOpenSkillModal = async (skill) => {
				setSelectedSkillForModal(skill);
				const skillName = skill.name;
				if (!skillsContentMap[skillName] && !skill.content) {
					setSkillsLoadingMap((prev) => ({
						...prev,
						[skillName]: true
					}));
					try {
						const res = await fetch(`${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}`);
						if (res.ok) {
							const data = await res.json();
							if (data?.ok && data.skill) setSkillsContentMap((prev) => ({
								...prev,
								[skillName]: data.skill
							}));
							else setSkillsContentMap((prev) => ({
								...prev,
								[skillName]: {
									...skill,
									content: t("sessionSettings.skills.loadError")
								}
							}));
						}
					} catch (err) {
						setSkillsContentMap((prev) => ({
							...prev,
							[skillName]: {
								...skill,
								content: t("sessionSettings.skills.loadErrorWithReason", { reason: err instanceof Error ? err.message : String(err) })
							}
						}));
					} finally {
						setSkillsLoadingMap((prev) => ({
							...prev,
							[skillName]: false
						}));
					}
				}
			};
			const handleCloseSkillModal = () => {
				setSelectedSkillForModal(null);
			};
			return {
				skills,
				filteredSkills,
				globalConfig,
				defaultDisabledModelList,
				defaultDisabledUserList,
				defaultDisabledModelSet,
				defaultDisabledUserSet,
				nonRuntimeSkills,
				enabledCount,
				loading,
				saving,
				search,
				setSearch,
				error,
				successMsg,
				selectedSkillForModal,
				setSelectedSkillForModal,
				skillsContentMap,
				skillsLoadingMap,
				handleToggleModelInvocable,
				handleToggleUserInvocable,
				handleSaveSkillModal,
				handleOpenSkillModal,
				handleCloseSkillModal,
				loadSkills
			};
		}
		//#endregion
		//#region src/client/skills/index.ts
		const e$2 = react.createElement;
		function SkillsSettingsTab({ api: _api, t, close: _close }) {
			const { skills, filteredSkills, nonRuntimeSkills, enabledCount, defaultDisabledModelSet, defaultDisabledUserSet, loading, saving, search, setSearch, error, successMsg, selectedSkillForModal, skillsContentMap, skillsLoadingMap, loadSkills, handleSaveSkillModal, handleOpenSkillModal, handleCloseSkillModal } = useGlobalSkills(t);
			const modalSkill = selectedSkillForModal;
			const modalDetail = modalSkill ? skillsContentMap[modalSkill.name] || modalSkill : null;
			const modalIsModelDisabled = modalSkill ? defaultDisabledModelSet.has(modalSkill.name) : false;
			const modalIsUserDisabled = modalSkill ? defaultDisabledUserSet.has(modalSkill.name) : false;
			const modalIsLoadingContent = modalSkill ? Boolean(skillsLoadingMap[modalSkill.name]) : false;
			return e$2("div", { className: "dsh-sam-page dsh-mcp-settings-page" }, error ? e$2("div", { className: "dsh-sam-notice error" }, error) : null, successMsg ? e$2("div", { className: "dsh-sam-notice success" }, successMsg) : null, e$2("div", { className: "dsh-mcp-header-card" }, e$2("div", { className: "dsh-mcp-header-title-row" }, e$2("div", null, e$2("h2", { className: "dsh-mcp-page-title" }, t("skillsSettings.title")), e$2("p", { className: "dsh-mcp-page-desc" }, t("skillsSettings.desc")), e$2("p", {
				className: "dsh-mcp-page-desc",
				style: { marginTop: "4px" }
			}, t("skillsSettings.skillsStats", {
				total: nonRuntimeSkills.length,
				enabled: enabledCount
			}))))), loading ? e$2("div", { className: "dsh-mcp-loading-card" }, e$2("p", null, t("sessionSettings.skills.refreshing"))) : e$2("div", { className: "dsh-mcp-body-wrap" }, e$2(SearchToolbar, {
				value: search,
				onChange: setSearch,
				placeholder: t("skillsSettings.searchPlaceholder"),
				statsText: search.trim() ? [e$2("span", { key: "match" }, t("sessionSettings.skills.matchedCount", {
					matched: filteredSkills.length,
					total: skills.length
				}))] : void 0,
				actions: e$2("button", {
					type: "button",
					className: "dsh-mcp-text-btn",
					disabled: loading,
					onClick: loadSkills
				}, loading ? e$2(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
					size: 12,
					className: "dsh-spin"
				}) : e$2(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 12 }), t("sessionSettings.skills.refresh"))
			}), filteredSkills.length === 0 ? e$2(EmptyState, { message: t("skillsSettings.noMatch") }) : e$2("div", { className: "dsh-session-skills-list" }, filteredSkills.map((skill) => e$2(SkillCard, {
				key: skill.name,
				skill,
				isModelDisabled: defaultDisabledModelSet.has(skill.name),
				isUserDisabled: defaultDisabledUserSet.has(skill.name),
				onClick: () => handleOpenSkillModal(skill),
				t
			})))), e$2(SkillDetailModal, {
				skill: modalSkill,
				detail: modalDetail,
				isModelDisabled: modalIsModelDisabled,
				isUserDisabled: modalIsUserDisabled,
				loadingContent: modalIsLoadingContent,
				saving,
				onSave: handleSaveSkillModal,
				onClose: handleCloseSkillModal,
				t
			}));
		}
		//#endregion
		//#region src/client/hero/SessionSettingsHeroChip.ts
		const e$1 = react.createElement;
		function SessionSettingsHeroChip({ api, remote, locale, sessions, workspaces }) {
			const [modalOpen, setModalOpen] = react.useState(false);
			const [hasOverride, setHasOverride] = react.useState(false);
			const t = react.useMemo(() => locale?.bind ? locale.bind(LOCALE_NS) : (k) => k, [locale]);
			const sessionsState = react.useSyncExternalStore(sessions?.list?.subscribe ? sessions.list.subscribe.bind(sessions.list) : () => () => {}, sessions?.list?.getSnapshot ? sessions.list.getSnapshot.bind(sessions.list) : () => ({
				current: void 0,
				byId: {}
			}));
			const workspacesState = react.useSyncExternalStore(workspaces?.list?.subscribe ? workspaces.list.subscribe.bind(workspaces.list) : () => () => {}, workspaces?.list?.getSnapshot ? workspaces.list.getSnapshot.bind(workspaces.list) : () => ({
				items: [],
				recentWorkspaceId: void 0
			}));
			const currentSessionId = sessionsState?.current;
			const currentSession = currentSessionId && sessionsState?.byId ? sessionsState.byId[currentSessionId] : currentSessionId && Array.isArray(sessionsState?.items) ? sessionsState.items.find((s) => s?.id === currentSessionId) : void 0;
			const workspaceItems = Array.isArray(workspacesState?.items) ? workspacesState.items : [];
			const currentWorkspace = workspaceItems.find((w) => currentSessionId && Array.isArray(w?.sessionIds) && w.sessionIds.includes(currentSessionId) || currentSession?.cwd && (w?.path === currentSession.cwd || w?.cwd === currentSession.cwd)) ?? (!currentSessionId && workspacesState?.recentWorkspaceId ? workspaceItems.find((w) => w.workspaceId === workspacesState.recentWorkspaceId || w.id === workspacesState.recentWorkspaceId) : workspaceItems[0]);
			const currentWorkspaceId = currentWorkspace?.workspaceId ?? currentWorkspace?.id;
			const currentWorkspaceTitle = currentWorkspace?.title ?? currentWorkspace?.name ?? currentWorkspace?.path;
			const checkOverride = react.useCallback(() => {
				if (!currentSessionId) {
					setHasOverride(false);
					return;
				}
				fetch(`${API_ENDPOINTS.getSettings}?sessionId=${encodeURIComponent(currentSessionId)}`).then((res) => res.json()).then((data) => {
					if (data?.ok) setHasOverride(isSessionCustomized(data.sessionConfig));
				}).catch(() => {});
			}, [currentSessionId]);
			react.useEffect(() => {
				checkOverride();
			}, [checkOverride]);
			react.useEffect(() => {
				if (!modalOpen) return;
				const handleKeyDown = (evt) => {
					if (evt.key === "Escape") setModalOpen(false);
				};
				window.addEventListener("keydown", handleKeyDown);
				return () => window.removeEventListener("keydown", handleKeyDown);
			}, [modalOpen]);
			return e$1(react.Fragment, null, e$1("button", {
				type: "button",
				className: `dsh-hero-session-settings-chip ${modalOpen ? "active" : ""} ${hasOverride ? "customized" : ""}`,
				title: t("sessionSettings.heroChipHint"),
				onClick: () => setModalOpen(true),
				"aria-haspopup": "dialog",
				"aria-expanded": modalOpen
			}, e$1(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline16, {
				size: 16,
				className: "dsh-hero-session-settings-icon"
			}), e$1("span", { className: "dsh-hero-session-settings-label" }, t("sessionSettings.title")), hasOverride ? e$1("span", { className: "dsh-hero-session-settings-badge highlight" }, t("sessionSettings.scope.sessionCustom")) : null), modalOpen ? (0, react_dom.createPortal)(e$1("div", {
				className: "dsh-sam-modal-overlay",
				onClick: (evt) => {
					if (evt.target === evt.currentTarget) setModalOpen(false);
				}
			}, e$1("div", {
				className: "dsh-session-settings-modal-panel",
				role: "dialog",
				"aria-modal": true,
				"aria-label": t("sessionSettings.title")
			}, e$1(SessionSettingsViewPage, {
				api,
				remote,
				t,
				sessionId: currentSessionId,
				workspaceId: currentWorkspaceId,
				workspaceTitle: currentWorkspaceTitle,
				useSessions: (selector) => selector ? selector(sessionsState) : sessionsState,
				useWorkspaces: (selector) => selector ? selector(workspacesState) : workspacesState,
				onClose: () => setModalOpen(false),
				onSave: () => {
					checkOverride();
				}
			}))), document.body) : null);
		}
		const CSS = [
			[
				`
/* ----------------------------------------------------
   Session Settings View Page (conversation.view Tab after 轨迹)
   Hide bottom composer & make settings page fill bottom
   ---------------------------------------------------- */
[data-conversation-scroll]:has([data-session-settings-view]) > [data-composer-seat],
[data-conversation-scroll]:has(.dsh-session-view-root) > [data-composer-seat],
:has(> * > * > [data-session-settings-view]) > [data-composer-seat],
:has(> * > * > .dsh-session-view-root) > [data-composer-seat],
[data-conversation-scroll]:has([data-session-settings-view]) [class*="composerSeat"],
[data-conversation-scroll]:has(.dsh-session-view-root) [class*="composerSeat"] {
  display: none !important;
}

[data-conversation-scroll]:has([data-session-settings-view]),
[data-conversation-scroll]:has(.dsh-session-view-root) {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  overflow: hidden !important;
  scrollbar-gutter: auto !important;
}

[data-conversation-scroll]:has([data-session-settings-view]) > [data-slot="conversation.session"],
[data-conversation-scroll]:has(.dsh-session-view-root) > [data-slot="conversation.session"],
[data-conversation-scroll]:has([data-session-settings-view]) [data-slot="conversation.view"],
[data-conversation-scroll]:has(.dsh-session-view-root) [data-slot="conversation.view"],
[data-conversation-scroll]:has([data-session-settings-view]) [class*="viewArea"],
[data-conversation-scroll]:has(.dsh-session-view-root) [class*="viewArea"] {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  height: 100% !important;
  min-height: 0 !important;
  overflow: hidden !important;
}

.dsh-session-view-root {
  background: var(--dsw-alias-bg-layer-1);
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
  width: 100%;
}
.dsh-session-view-root * {
  box-sizing: border-box;
}

.dsh-sam-status-badge {
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
}
.dsh-sam-status-badge.badge-default {
  background: color-mix(in srgb, var(--dsw-alias-label-tertiary, #888) 15%, transparent);
  color: var(--dsw-alias-label-secondary);
}
.dsh-sam-status-badge.badge-workspace {
  background: color-mix(in srgb, #10b981 15%, transparent);
  color: #10b981;
}
.dsh-sam-status-badge.badge-custom {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 15%, transparent);
  color: var(--dsw-alias-brand-primary, #1383fe);
}

.dsh-sam-notice {
  border-radius: 6px;
  font-size: 13px;
  line-height: 20px;
  padding: 10px 14px;
}
.dsh-sam-notice.success {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.dsh-sam-notice.error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
.dsh-sam-notice.info {
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}
.dsh-sam-notices-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 16px;
}
.dsh-sam-notices-block .dsh-sam-notice {
  margin: 0;
}

.dsh-sam-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 0;
}
.dsh-sam-modal-subtitle {
  padding: 14px 24px 0;
}
.dsh-sam-modal-subtitle .dsh-sam-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 0;
}

.dsh-sam-btn {
  align-items: center;
  border-radius: 6px;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  gap: 6px;
  justify-content: center;
  line-height: 1;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
  vertical-align: middle;
}
.dsh-sam-btn.primary {
  background: var(--dsw-alias-brand-primary);
  border: 1px solid var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary-foreground);
  height: 32px;
  padding: 0 12px;
}
.dsh-sam-btn.primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary));
  border-color: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary));
}
.dsh-sam-btn.secondary {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  height: 34px;
  padding: 0 13px;
}
.dsh-sam-btn.secondary:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-sam-btn.default-btn {
  background: rgba(147, 51, 234, 0.12);
  border: 1px solid rgba(147, 51, 234, 0.3);
  color: var(--dsw-alias-label-primary);
  height: 34px;
  padding: 0 13px;
}
.dsh-sam-btn.default-btn:hover:not(:disabled) {
  background: rgba(147, 51, 234, 0.22);
}
.dsh-sam-btn.tertiary {
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  height: 34px;
  padding: 0 13px;
}
.dsh-sam-btn.tertiary:hover {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}
.dsh-sam-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Modal and view footer action buttons symmetry */
.dsh-mcp-modal-footer .dsh-sam-btn.primary,
.dsh-sam-actions .dsh-sam-btn.primary,
.dsh-view-footer-right .dsh-sam-btn.primary {
  height: 32px;
  min-width: 68px;
  padding: 0 14px;
}
.dsh-mcp-modal-footer .dsh-sam-btn.secondary,
.dsh-mcp-modal-footer .dsh-sam-btn.tertiary,
.dsh-mcp-modal-footer .dsh-sam-btn.default-btn,
.dsh-sam-actions .dsh-sam-btn.secondary,
.dsh-sam-actions .dsh-sam-btn.tertiary,
.dsh-sam-actions .dsh-sam-btn.default-btn,
.dsh-view-footer-right .dsh-sam-btn.secondary,
.dsh-view-footer-right .dsh-sam-btn.tertiary,
.dsh-view-footer-right .dsh-sam-btn.default-btn {
  height: 34px;
  min-width: 70px;
  padding: 0 15px;
}

@keyframes dsh-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.dsh-spin {
  animation: dsh-spin 1s linear infinite;
}
`,
				`
/* Header & Clone Toolbar */
.dsh-session-view-header {
  background: var(--dsw-alias-bg-layer-2);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 10px;
  padding: 14px 24px;
  position: relative;
}
.dsh-session-view-header-top {
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 24px;
  width: 100%;
}
.dsh-session-view-header .dsh-sam-close-btn {
  position: absolute;
  right: 24px;
  top: 24px;
}
.dsh-session-view-title {
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  margin: 0;
}
.dsh-clone-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-session-view-header-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Session ID Chip */
.dsh-session-id-chip {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: inline-flex;
  font-family: monospace;
  font-size: 12px;
  gap: 6px;
  line-height: 16px;
  padding: 4px 10px;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.dsh-session-id-chip:hover {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
}
.dsh-session-id-chip.copied {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.dsh-header-workspace-chip {
  cursor: default;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Clone Toolbar */
.dsh-clone-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-clone-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
}
.dsh-clone-input {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 12px;
  height: 30px;
  outline: none;
  padding: 0 10px;
  transition: border-color 0.15s;
  width: 250px;
}
.dsh-clone-input:focus {
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-clone-btn {
  font-size: 12px;
  height: 30px;
  padding: 0 12px;
}
.dsh-btn-icon-left {
  margin-right: 6px;
}

.dsh-view-notice {
  margin: 12px 24px 0;
}

/* Split Body */
.dsh-session-view-body {
  display: flex;
  flex: 1 1 0%;
  min-height: 0;
  overflow: hidden;
}

/* Left Sub-sidebar (clean layout: icon + title + badge) */
.dsh-session-view-sidebar {
  background: var(--dsw-alias-bg-layer-2);
  border-right: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 4px;
  overflow-y: auto;
  padding: 16px 12px;
  width: 230px;
}
.dsh-view-sidebar-item {
  align-items: center;
  background: 0 0;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  transition: background-color 0.15s, border-color 0.15s;
  width: 100%;
}
.dsh-view-sidebar-item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-view-sidebar-item.active {
  background: var(--dsw-alias-bg-layer-1);
  border-color: var(--dsw-alias-border-l2);
  box-shadow: var(--dsw-shadow-lv1);
}
.dsh-view-item-icon {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 6px;
  color: var(--dsw-alias-brand-primary);
  display: flex;
  flex-shrink: 0;
  height: 28px;
  justify-content: center;
  width: 28px;
}
.dsh-view-sidebar-item.active .dsh-view-item-icon {
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary-foreground);
}
.dsh-view-item-title {
  color: var(--dsw-alias-label-primary);
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  min-width: 0;
}
.dsh-view-sidebar-item.active .dsh-view-item-title {
  font-weight: 600;
}
.dsh-view-item-badge {
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  flex-shrink: 0;
  font-size: 11px;
  max-width: 80px;
  overflow: hidden;
  padding: 2px 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-view-item-badge.highlight {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  font-weight: 600;
}

/* Right Content Panel */
.dsh-session-view-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 24px 32px 60px;
}
.dsh-view-content-inner {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 760px;
}

/* Section Header inside Content Panel */
.dsh-section-header {
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
  padding-bottom: 12px;
}
.dsh-section-title {
  color: var(--dsw-alias-label-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  margin: 0;
}
.dsh-section-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
  margin: 0;
}

/* Footer Actions */
.dsh-session-view-footer {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 14px 28px;
}
.dsh-view-footer-left {
  align-items: center;
  display: flex;
  gap: 10px;
}
.dsh-view-footer-right {
  align-items: center;
  display: flex;
  gap: 10px;
}
`,
				`
/* Forms & Selectors */
.dsh-sam-mode-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-sam-mode-item {
  align-items: flex-start;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  transition: border-color 0.15s, background-color 0.15s;
}
.dsh-sam-mode-item:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-sam-mode-item.selected {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-sam-mode-item input[type="radio"] {
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
  margin-top: 3px;
}
.dsh-sam-mode-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dsh-sam-mode-title-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-sam-mode-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
}
.dsh-sam-title-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  padding: 1px 6px;
}
.dsh-sam-title-badge.inherit {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--dsw-alias-label-secondary);
}
.dsh-sam-title-badge.custom {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 30%, transparent);
  color: var(--dsw-alias-brand-primary, #1383fe);
}
.dsh-sam-title-badge.default {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--dsw-alias-label-tertiary);
}
.dsh-sam-title-badge.workspace {
  background: color-mix(in srgb, #10b981 15%, transparent);
  border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  color: #10b981;
}
.dsh-sam-mode-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-sam-fields-panel {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}
.dsh-sam-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dsh-sam-field-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  font-weight: 500;
}
.dsh-sam-select {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  height: 36px;
  line-height: 20px;
  max-width: 100%;
  min-width: 0;
  padding: 0 10px;
  width: 100%;
}
.dsh-sam-select:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-sam-select:disabled {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-tertiary);
  cursor: not-allowed;
  opacity: 0.7;
}

/* Effective Model Preview Card */
.dsh-sam-effective-model-card {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px dashed var(--dsw-alias-border-l1);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding: 14px 16px;
}
.dsh-sam-effective-model-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.dsh-sam-effective-model-title {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: flex;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  text-transform: uppercase;
}
.dsh-sam-effective-model-source {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  padding: 2px 6px;
}
.dsh-sam-effective-model-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.dsh-sam-effective-model-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dsh-sam-effective-model-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.dsh-sam-effective-model-value {
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 13px;
  font-weight: 500;
}
`,
				`
/* Hero Session Settings Chip */
.dsh-hero-session-settings-seat {
  align-items: center;
  display: inline-flex;
  flex-shrink: 0;
  margin-left: 4px;
}
.dsh-hero-session-settings-chip {
  align-items: center;
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary, #ffffff);
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  gap: 4px;
  min-height: 28px;
  line-height: 20px;
  max-width: 240px;
  padding: 0 8px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  user-select: none;
}
.dsh-hero-session-settings-chip:hover,
.dsh-hero-session-settings-chip.active {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
  border-color: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.15));
  color: var(--dsw-alias-label-primary, #ffffff);
}
.dsh-hero-session-settings-chip.customized {
  border-color: var(--dsw-color-brand, #1383fe);
  color: var(--dsw-color-brand, #1383fe);
}
.dsh-hero-session-settings-icon {
  color: var(--dsw-alias-label-tertiary);
  flex-shrink: 0;
  transition: color 0.15s;
}
.dsh-hero-session-settings-chip:hover .dsh-hero-session-settings-icon {
  color: var(--dsw-alias-label-primary);
}
.dsh-hero-session-settings-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-hero-session-settings-badge {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  margin-left: 2px;
  padding: 1px 6px;
}
.dsh-hero-session-settings-badge.highlight {
  background: var(--dsw-color-brand-transparent, rgba(19, 131, 254, 0.1));
  border-color: var(--dsw-color-brand, #1383fe);
  color: var(--dsw-color-brand, #1383fe);
}

/* Modal panel in Hero dialog */
.dsh-session-settings-modal-panel {
  background: var(--dsw-alias-bg-layer-1, #1e1e20);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
  border-radius: 16px;
  box-shadow: var(--dsw-shadow-lv3, 0 16px 36px rgba(0, 0, 0, 0.4));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: min(720px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
  max-width: calc(100vw - 48px);
  overflow: hidden;
  padding: 0;
  position: relative;
  width: 900px;
  z-index: 1;
}
.dsh-session-settings-modal-panel .dsh-session-view-root {
  border-radius: 16px;
  flex: 1 1 0%;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
}
`,
				`
/* Set Default Modal & Diff Layout */
.dsh-set-default-modal {
  max-width: 720px;
  width: min(720px, calc(100vw - 48px));
}
.dsh-set-default-title-row {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-modal-workspace-chip {
  cursor: default;
  font-size: 12px;
  font-weight: 500;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}
.dsh-set-default-modal .dsh-sam-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 0;
}
.dsh-set-default-scope-row {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.dsh-set-default-scope-label {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.dsh-set-default-scope-tabs {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  display: inline-flex;
  padding: 2px;
}
.dsh-set-default-scope-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 14px;
  transition: background-color 0.15s, color 0.15s;
}
.dsh-set-default-scope-btn:hover {
  color: var(--dsw-alias-label-primary);
}
.dsh-set-default-scope-btn.active {
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  color: var(--dsw-alias-brand-primary, #1383fe);
  font-weight: 600;
}
.dsh-set-default-modal-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
}
.dsh-diff-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dsh-diff-row {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dsh-diff-row-header {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
}
.dsh-diff-row-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
}
.dsh-diff-changed-tag {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 15%, transparent);
  border-radius: 4px;
  color: var(--dsw-alias-brand-primary, #1383fe);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
}
.dsh-diff-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.dsh-diff-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
}
.dsh-diff-col.before {
  border-right: 1px solid var(--dsw-alias-border-l2);
}
.dsh-diff-col.after {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #1383fe) 5%, transparent);
}
.dsh-diff-col-title {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
}
.dsh-diff-col-value {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
}
.dsh-diff-col-value.changed {
  color: var(--dsw-alias-brand-primary, #1383fe);
  font-weight: 500;
}
`
			].join("\n\n"),
			[`
/* MCP session checklist */
.dsh-session-mcp-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-mcp-quick-bar {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-bottom: 2px;
}
.dsh-mcp-select-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  line-height: 16px;
  padding: 6px 12px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.dsh-mcp-select-btn:hover {
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-1));
  border-color: var(--dsw-alias-border-l1);
}
.dsh-mcp-select-btn.active {
  background: rgba(88, 166, 255, 0.1);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.dsh-mcp-text-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  height: 34px;
  justify-content: center;
  line-height: 1;
  padding: 0 12px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  vertical-align: middle;
}
.dsh-mcp-text-btn:hover {
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-1));
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-mcp-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-session-mcp-card {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}
.dsh-session-mcp-card:hover {
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-mcp-card.active {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-mcp-card.disabled {
  background: var(--dsw-alias-bg-layer-1);
  border-style: dashed;
  opacity: 0.85;
}
.dsh-session-mcp-card.readonly {
  opacity: 0.8;
}
.dsh-session-mcp-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  width: 100%;
}
.dsh-session-mcp-identity {
  align-items: center;
  display: flex;
  flex: 1 1 0%;
  gap: 10px;
  min-width: 0;
}
.dsh-session-mcp-icon {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  color: var(--dsw-alias-brand-primary);
  display: flex;
  flex: none;
  height: 32px;
  justify-content: center;
  width: 32px;
}
.dsh-session-mcp-title-wrap {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.dsh-session-mcp-name {
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
}
.dsh-session-mcp-id {
  color: var(--dsw-alias-label-secondary);
  font-family: monospace;
  font-size: 12px;
  line-height: 16px;
}
.dsh-session-mcp-switch-wrap {
  align-items: center;
  display: flex;
  flex-shrink: 0;
}
.dsh-session-mcp-switch-wrap .dsh-mcp-switch-btn {
  cursor: pointer;
  pointer-events: auto;
}
.dsh-session-mcp-badges-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0;
}
.dsh-session-mcp-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
  margin: 0;
}
.dsh-session-mcp-target-box {
  display: flex;
  width: 100%;
}
.dsh-session-mcp-target {
  background: var(--dsw-alias-bg-layer-1);
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  display: inline-block;
  font-family: monospace;
  font-size: 11px;
  line-height: 16px;
  overflow: hidden;
  padding: 4px 8px;
  text-overflow: ellipsis;
  user-select: text;
  white-space: nowrap;
  width: 100%;
}
.dsh-session-mcp-footer {
  align-items: center;
  display: flex;
  justify-content: flex-end;
  margin-top: 2px;
  width: 100%;
}
.dsh-session-tools-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  height: 28px;
  line-height: 16px;
  padding: 0 10px;
  transition: background-color 0.15s, border-color 0.15s;
}
.dsh-session-tools-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-session-tools-mode-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  padding: 2px 6px;
}
.dsh-session-tools-mode-badge.default {
  background: rgba(147, 51, 234, 0.1);
  color: #a855f7;
}
.dsh-session-tools-mode-badge.custom {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.dsh-session-tools-mode-badge.all-active {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.dsh-session-tools-modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 6px;
}
.dsh-session-tools-mode-tabs {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  padding: 3px;
}
.dsh-session-tools-mode-tab {
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: flex;
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  justify-content: center;
  line-height: 18px;
  padding: 6px 14px;
  transition: background-color 0.15s, color 0.15s;
}
.dsh-session-tools-mode-tab:hover {
  color: var(--dsw-alias-label-primary);
}
.dsh-session-tools-mode-tab.active {
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  color: var(--dsw-alias-brand-primary, #1383fe);
  font-weight: 600;
}
`, `
/* ----------------------------------------------------
   MCP Servers Management (Settings -> Plugins Tab)
   ---------------------------------------------------- */
.dsh-mcp-settings-page {
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}
.dsh-mcp-header-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-mcp-header-title-row {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}
.dsh-mcp-page-title {
  color: var(--dsw-alias-label-primary);
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
  margin: 0;
}
.dsh-mcp-page-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 4px 0 0;
}
.dsh-mcp-header-actions {
  align-items: center;
  display: flex;
  gap: 8px;
}
.dsh-mcp-refresh-btn {
  align-items: center;
  border-radius: 6px;
  display: inline-flex;
  height: 34px;
  justify-content: center;
  min-width: 34px !important;
  padding: 0 !important;
  width: 34px;
}

/* Server Cards List */
.dsh-mcp-server-list {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}
.dsh-mcp-server-card {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.dsh-mcp-server-card:hover {
  border-color: var(--dsw-alias-border-l2);
}
.dsh-mcp-card-top {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
.dsh-mcp-card-identity {
  align-items: center;
  display: flex;
  gap: 10px;
  min-width: 0;
}
.dsh-mcp-transport-icon {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px;
  color: var(--dsw-alias-brand-primary);
  display: flex;
  flex: none;
  height: 32px;
  justify-content: center;
  width: 32px;
}
.dsh-mcp-title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dsh-mcp-card-name {
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
}
.dsh-mcp-card-id {
  color: var(--dsw-alias-label-secondary);
  font-family: monospace;
  font-size: 12px;
  line-height: 16px;
}
.dsh-mcp-badges {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh-mcp-proto-badge {
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
}
.dsh-mcp-proto-badge.stdio {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.dsh-mcp-proto-badge.streamable-http-or-sse,
.dsh-mcp-proto-badge.streamable-http {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.dsh-mcp-proto-badge.sse {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.dsh-mcp-proto-badge.timeout {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}
.dsh-mcp-proto-badge.count {
  background: var(--dsw-alias-bg-layer-3, rgba(255, 255, 255, 0.08));
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
}
.dsh-mcp-default-badge {
  background: rgba(147, 51, 234, 0.12);
  border-radius: 4px;
  color: #a855f7;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
}
.dsh-mcp-proto-badge.website {
  background: rgba(88, 166, 255, 0.12);
  color: #58a6ff;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s;
}
.dsh-mcp-proto-badge.website:hover {
  background: rgba(88, 166, 255, 0.22);
  text-decoration: underline;
}
.dsh-mcp-custom-icon {
  border-radius: 4px;
  display: inline-block;
  object-fit: contain;
  vertical-align: middle;
}
.dsh-mcp-label-row {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.dsh-mcp-label-row .dsh-sam-field-label {
  margin-bottom: 0;
}
.dsh-mcp-autofill-btn {
  align-items: center;
  background: rgba(88, 166, 255, 0.1);
  border: 1px solid rgba(88, 166, 255, 0.25);
  border-radius: 4px;
  color: var(--dsw-alias-brand-primary, #58a6ff);
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  gap: 3px;
  line-height: 14px;
  padding: 2px 6px;
  transition: background-color 0.15s, border-color 0.15s;
}
.dsh-mcp-autofill-btn:hover {
  background: rgba(88, 166, 255, 0.2);
  border-color: var(--dsw-alias-brand-primary, #58a6ff);
}
.dsh-mcp-card-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 18px;
  margin: 0;
}
.dsh-mcp-target-box {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  padding: 8px 10px;
}
.dsh-mcp-code-preview {
  color: var(--dsw-alias-label-primary);
  display: block;
  font-family: monospace;
  font-size: 12px;
  line-height: 16px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.dsh-mcp-inline-test {
  align-items: center;
  border-radius: 6px;
  display: flex;
  font-size: 12px;
  gap: 6px;
  line-height: 16px;
  padding: 6px 10px;
}
.dsh-mcp-inline-test.success {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.dsh-mcp-inline-test.error {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}
.dsh-mcp-card-footer {
  align-items: center;
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  padding-top: 10px;
}
.dsh-mcp-mini-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 12px;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  transition: background-color 0.15s;
}
.dsh-mcp-mini-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-mcp-footer-right {
  align-items: center;
  display: flex;
  gap: 6px;
}
.dsh-mcp-icon-btn {
  align-items: center;
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: inline-flex;
  height: 28px;
  justify-content: center;
  padding: 0;
  transition: background-color 0.15s, color 0.15s;
  width: 28px;
}
.dsh-mcp-icon-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-mcp-icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* Empty Card */
.dsh-mcp-empty-card {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}
.dsh-mcp-empty-icon {
  color: var(--dsw-alias-label-secondary);
}
.dsh-mcp-empty-text {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  max-width: 400px;
}

/* Form Modal Elements */
.dsh-sam-modal-overlay {
  align-items: center;
  backdrop-filter: var(--dsw-mask-blur);
  background: var(--dsw-alias-bg-mask-1);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 1000;
}
.dsh-sam-modal-panel {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 20px;
  box-shadow: var(--dsw-shadow-lv3);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: min(680px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
  max-width: calc(100vw - 48px);
  overflow: hidden;
  padding: 0;
  position: relative;
  width: 680px;
  z-index: 1;
}
.dsh-sam-modal-panel * {
  box-sizing: border-box;
}
.dsh-mcp-form-modal {
  width: 720px;
}
.dsh-sam-modal-panel .dsh-sam-header-row {
  align-items: center;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 20px 24px 16px;
}
.dsh-sam-title {
  color: var(--dsw-alias-label-primary);
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
  margin: 0;
}
.dsh-sam-close-btn {
  align-items: center;
  background: 0 0;
  border: none;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: flex;
  font-size: 16px;
  height: 28px;
  justify-content: center;
  padding: 0;
  width: 28px;
}
.dsh-sam-close-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-sam-modal-body {
  display: flex;
  flex: 1 1 0%;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px;
}
.dsh-mcp-form-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 0;
}

/* Top Switch Card */
.dsh-mcp-switch-card {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  outline: none;
  padding: 12px 16px;
  transition: border-color 0.15s, background-color 0.15s;
  user-select: none;
}
.dsh-mcp-switch-card:hover {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.dsh-mcp-switch-card:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-mcp-switch-card.active {
  border-color: var(--dsw-alias-state-success-primary);
}
.dsh-mcp-switch-card.disabled {
  cursor: not-allowed !important;
  opacity: 0.55;
}
.dsh-mcp-switch-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dsh-mcp-switch-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}
.dsh-mcp-switch-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 16px;
}
.dsh-mcp-switch-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9999px;
  cursor: pointer;
  display: inline-flex;
  flex-shrink: 0;
  height: 24px;
  padding: 2px;
  pointer-events: auto;
  position: relative;
  transition: background-color 0.2s, border-color 0.2s;
  width: 44px;
}
.dsh-mcp-switch-btn.active {
  background: var(--dsw-alias-state-success-primary);
  border-color: var(--dsw-alias-state-success-primary);
}
.dsh-mcp-switch-thumb {
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: block;
  height: 18px;
  transform: translateX(0);
  transition: transform 0.2s ease-in-out;
  width: 18px;
}
.dsh-mcp-switch-btn.active .dsh-mcp-switch-thumb {
  transform: translateX(20px);
}

.dsh-mcp-form-row {
  display: grid;
  gap: 14px;
  grid-template-columns: 1fr 1fr;
  width: 100%;
}
.flex-1 {
  flex: 1;
  min-width: 0;
}
.dsh-mcp-textarea {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 13px;
  line-height: 18px;
  padding: 8px 10px;
  resize: vertical;
  width: 100%;
}
.dsh-mcp-textarea:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}

/* KV Rows for Headers & ENV */
.dsh-mcp-kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-mcp-kv-row {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(120px, 0.8fr) minmax(180px, 1.2fr) 34px;
  width: 100%;
}
.dsh-mcp-kv-row .dsh-sam-select {
  height: 34px;
}
.dsh-mcp-kv-del-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: inline-flex;
  height: 34px;
  justify-content: center;
  padding: 0;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  width: 34px;
}
.dsh-mcp-kv-del-btn:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* Add Item Button */
.dsh-mcp-add-btn {
  align-items: center;
  align-self: flex-start;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  gap: 6px;
  height: 32px;
  justify-content: center;
  line-height: 20px;
  margin-top: 4px;
  padding: 0 12px;
  transition: background-color 0.15s, border-color 0.15s;
}
.dsh-mcp-add-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-brand-primary);
}

/* Advanced Settings Box */
.dsh-mcp-advanced-box {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color 0.15s;
}
.dsh-mcp-advanced-header {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  outline: none;
  padding: 12px 16px;
  user-select: none;
}
.dsh-mcp-advanced-header:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-mcp-advanced-header:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -1px;
}
.dsh-mcp-advanced-title-wrap {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  width: 100%;
}
.dsh-mcp-advanced-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
}
.dsh-mcp-advanced-badge {
  color: var(--dsw-alias-brand-primary);
  font-size: 12px;
  font-weight: 500;
}
.dsh-mcp-advanced-content {
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}
.dsh-mcp-switch-card.mini {
  padding: 10px 14px;
}
.dsh-mcp-form-row-3 {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: 100%;
}
.dsh-mcp-field-hint {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 16px;
  margin-top: 2px;
}

.dsh-sam-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.dsh-mcp-modal-footer {
  align-items: center;
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  margin-top: 0;
  padding: 16px 24px;
  width: 100%;
}
.dsh-mcp-modal-footer-left,
.dsh-mcp-modal-footer-right {
  align-items: center;
  display: flex;
  gap: 8px;
}
.dsh-mcp-modal-footer-right {
  margin-left: auto;
}

/* Import Modal */
.dsh-mcp-import-modal {
  width: 680px;
}
.dsh-mcp-import-modal .dsh-sam-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 6px 0 10px;
}
.dsh-mcp-import-textarea {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  display: flex;
  flex: 1 1 0%;
  font-family: monospace;
  font-size: 12px;
  line-height: 18px;
  min-height: 280px;
  padding: 12px 14px;
  resize: vertical;
  width: 100%;
}
.dsh-mcp-import-textarea:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}

/* Tools Management Modal & Tool Cards */
.dsh-mcp-tools-modal {
  height: min(720px, calc(100vh - 48px));
  max-width: 780px;
  width: 92vw;
}
.dsh-mcp-tools-header-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.dsh-mcp-tools-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 10px;
}
.dsh-mcp-tools-search-box {
  flex: 1 1 200px;
  min-width: 180px;
}
.dsh-mcp-search-wrap {
  align-items: center;
  display: flex;
  position: relative;
  width: 100%;
}
.dsh-mcp-search-icon {
  color: var(--dsw-alias-label-tertiary);
  left: 10px;
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}
.dsh-mcp-search-input {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  height: 32px;
  line-height: 20px;
  padding: 0 10px 0 32px;
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
}
.dsh-mcp-search-input:focus {
  border-color: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
  outline: none;
}
.dsh-mcp-search-input::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-mcp-tools-toolbar-actions {
  align-items: center;
  display: flex;
  gap: 8px;
}
.dsh-mcp-tools-toolbar-actions .dsh-sam-btn {
  font-size: 12px;
  height: 34px;
  min-width: unset;
  padding: 0 12px;
}
.dsh-mcp-tools-stats-bar {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: flex;
  font-size: 12px;
  justify-content: space-between;
  line-height: 18px;
  margin-bottom: 8px;
  padding: 0 2px;
}
.dsh-mcp-tools-list {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 8px;
  max-height: 480px;
  min-height: 120px;
  overflow-y: auto;
  padding-right: 4px;
}
.dsh-mcp-tool-card {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}
.dsh-mcp-tool-card:hover {
  border-color: var(--dsw-alias-border-l1);
}
.dsh-mcp-tool-card.disabled {
  background: var(--dsw-alias-bg-layer-1);
  border-style: dashed;
  opacity: 0.85;
}
.dsh-mcp-tool-card-main {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  width: 100%;
}
.dsh-mcp-tool-card-left {
  align-items: flex-start;
  display: flex;
  flex: 1 1 0%;
  gap: 10px;
  min-width: 0;
  user-select: text;
}
.dsh-mcp-tool-card .dsh-mcp-switch-btn {
  cursor: pointer;
  pointer-events: auto;
}
.dsh-mcp-tool-desc,
.dsh-mcp-tool-name,
.dsh-mcp-tool-schema-preview {
  user-select: text;
}
.dsh-mcp-tool-info {
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  min-width: 0;
}
.dsh-mcp-tool-title-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-mcp-tool-name {
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  word-break: break-all;
}
.dsh-mcp-tool-status-pill {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  padding: 2px 6px;
}
.dsh-mcp-tool-status-pill.active {
  background: rgba(46, 160, 67, 0.15);
  color: var(--dsw-alias-state-success-primary, #2ea043);
}
.dsh-mcp-tool-status-pill.disabled {
  background: rgba(218, 54, 51, 0.15);
  color: var(--dsw-alias-state-error-primary, #da3633);
}
.dsh-mcp-tool-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  margin: 4px 0 0;
}
.dsh-mcp-tool-schema-btn {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  gap: 4px;
  line-height: 16px;
  padding: 4px 10px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.dsh-mcp-tool-schema-btn:hover {
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2));
  border-color: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
  text-decoration: none;
}
.dsh-mcp-tool-schema-btn.active {
  background: rgba(88, 166, 255, 0.1);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.dsh-mcp-tool-schema-preview {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  font-family: monospace;
  font-size: 11px;
  line-height: 16px;
  margin: 0;
  max-height: 220px;
  overflow: auto;
  padding: 8px 10px;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Expanded Parameter Box & Segmented View */
.dsh-mcp-tool-expanded-box {
  border-top: 1px dashed var(--dsw-alias-border-l2);
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
}
.dsh-mcp-tool-expanded-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
}
.dsh-mcp-tool-param-stats {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 500;
}
.dsh-mcp-tool-view-switch {
  align-items: center;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  display: inline-flex;
  gap: 2px;
  padding: 2px;
}
.dsh-mcp-seg-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font-size: 11px;
  line-height: 14px;
  padding: 3px 8px;
  transition: background-color 0.15s, color 0.15s;
}
.dsh-mcp-seg-btn:hover {
  color: var(--dsw-alias-label-primary);
}
.dsh-mcp-seg-btn.active {
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2));
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.dsh-mcp-tool-params-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 2px;
}
.dsh-mcp-param-row {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
}
.dsh-mcp-param-top {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh-mcp-param-name {
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}
.dsh-mcp-param-type {
  background: rgba(88, 166, 255, 0.1);
  border-radius: 4px;
  color: var(--dsw-alias-brand-primary);
  font-family: monospace;
  font-size: 11px;
  line-height: 14px;
  padding: 1px 5px;
}
.dsh-mcp-param-badge {
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
  padding: 1px 5px;
}
.dsh-mcp-param-badge.required {
  background: rgba(218, 54, 51, 0.12);
  color: var(--dsw-alias-state-error-primary, #da3633);
}
.dsh-mcp-param-badge.optional {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.dsh-mcp-param-default {
  background: var(--dsw-alias-bg-layer-2);
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary);
  font-family: monospace;
  font-size: 10px;
  line-height: 14px;
  padding: 1px 5px;
}
.dsh-mcp-param-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  margin: 0;
  word-break: break-word;
}
.dsh-mcp-param-enum {
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  font-family: monospace;
  font-size: 10px;
  line-height: 14px;
}
.dsh-mcp-mini-badge.danger {
  background: rgba(218, 54, 51, 0.15);
  border-radius: 4px;
  color: var(--dsw-alias-state-error-primary, #da3633);
  font-size: 10px;
  font-weight: 600;
  line-height: 12px;
  margin-left: 4px;
  padding: 1px 5px;
}
.dsh-mcp-proto-badge.disabled-tools {
  background: rgba(218, 54, 51, 0.12);
  color: var(--dsw-alias-state-error-primary, #da3633);
}
.dsh-mcp-proto-badge.server-version {
  background: rgba(88, 166, 255, 0.12);
  color: var(--dsw-alias-brand-primary, #58a6ff);
  font-family: monospace;
  font-weight: 600;
}

/* MCP Pre-save Test Confirmation Modal */
.dsh-mcp-confirm-overlay {
  z-index: 1050;
}
.dsh-mcp-confirm-modal {
  height: auto;
  max-height: min(520px, calc(100vh - 48px));
  max-width: 480px;
  min-height: unset;
  width: 90vw;
}
.dsh-mcp-confirm-modal .dsh-sam-header svg {
  color: var(--dsw-alias-state-warning-primary, #d29922);
}
.dsh-mcp-confirm-msg {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
  margin: 0 0 10px;
}
.dsh-mcp-confirm-detail {
  background: rgba(218, 54, 51, 0.08);
  border: 1px solid rgba(218, 54, 51, 0.2);
  border-radius: 6px;
  color: var(--dsw-alias-state-error-primary, #da3633);
  font-family: monospace;
  font-size: 12px;
  line-height: 16px;
  margin-bottom: 12px;
  max-height: 160px;
  overflow-y: auto;
  padding: 8px 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.dsh-mcp-confirm-prompt {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  margin: 0 0 16px;
}
.dsh-mcp-confirm-modal .dsh-sam-actions {
  margin-top: 0;
}
`].join("\n\n"),
			`
/* Skills Session Management */
.dsh-session-skills-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dsh-skills-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 4px;
}
.dsh-skills-search-input {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  height: 32px;
  line-height: 20px;
  outline: none;
  padding: 0 10px 0 32px;
  transition: border-color 0.15s;
  width: 100%;
}
.dsh-skills-search-input:focus {
  border-color: var(--dsw-alias-brand-primary);
}
.dsh-session-skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Skill Badges */
.dsh-skill-badge {
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  padding: 2px 6px;
}
.dsh-skill-badge.source-project {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.dsh-skill-badge.source-user {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.dsh-skill-badge.source-bundled {
  background: rgba(147, 51, 234, 0.12);
  color: #a855f7;
}
.dsh-skill-badge.source-runtime {
  background: rgba(107, 114, 128, 0.15);
  color: var(--dsw-alias-label-secondary);
}
.dsh-skill-badge.status-disabled {
  background: rgba(218, 54, 51, 0.12);
  color: var(--dsw-alias-state-error-primary, #da3633);
}
.dsh-skill-badge.status-enabled {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

/* Standalone Skill Modal */
.dsh-skill-modal {
  display: flex;
  flex-direction: column;
  height: auto;
  max-height: 88vh;
  max-width: 720px;
  width: 90vw;
}
.dsh-skill-modal-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 16px;
  max-height: calc(88vh - 140px);
  overflow-y: auto;
  padding: 8px 2px;
}
.dsh-skill-modal-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-skill-modal-section-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  margin: 0;
}
.dsh-skill-modal-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  margin: 0;
}
.dsh-skill-runtime-note {
  background: rgba(245, 158, 11, 0.08);
  border: 1px dashed rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  color: var(--dsw-alias-state-warning-primary, #f59e0b);
  font-size: 12px;
  line-height: 16px;
  padding: 8px 12px;
}
.dsh-skill-detail-meta {
  color: var(--dsw-alias-label-secondary);
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 4px;
}
.dsh-skill-detail-path {
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  word-break: break-all;
}
.dsh-skill-content-block {
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-primary);
  font-family: monospace;
  font-size: 12px;
  line-height: 18px;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
`
		].join("\n\n");
		//#endregion
		//#region src/client/index.ts
		const e = react.createElement;
		const inject = [
			"slots",
			"connection",
			"locale",
			"sessions",
			"workspaces",
			"remote",
			"remote.session"
		];
		function apply(ctx) {
			const slots = ctx.get("slots");
			const connection = ctx.get("connection");
			const locale = ctx.get("locale");
			const remote = ctx.get("remote") || ctx.remote;
			if (!slots || !connection || !locale) return;
			ctx.effect(() => {
				locale.register(LOCALE_NS, {
					zh: flattenDictionary(zh),
					en: flattenDictionary(en)
				});
				return () => {};
			}, "session-settings: locale");
			let translator = locale.bind(LOCALE_NS);
			ctx.effect(() => {
				const unsub = locale.subscribe(() => {
					translator = locale.bind(LOCALE_NS);
				});
				return () => {
					if (typeof unsub === "function") unsub();
				};
			}, "session-settings: locale updates");
			ctx.effect(() => {
				const style = document.createElement("style");
				style.dataset.plugin = "@local/dsh-session-settings";
				style.textContent = CSS;
				document.head.appendChild(style);
				return () => style.remove();
			}, "session-settings: styles");
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "mcp-servers",
				order: 25,
				label: () => translator("mcpServers.tabLabel")
			}, function McpSettingsSection(props) {
				return e(McpServersSettingsTab, {
					...props,
					api: connection.api,
					t: translator
				});
			}));
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "skills",
				order: 26,
				label: () => translator("skillsSettings.tabLabel")
			}, function SkillsSettingsSection(props) {
				return e(SkillsSettingsTab, {
					...props,
					api: connection.api,
					t: translator
				});
			}));
			slots.inject("conversation.view", () => slots.register({
				name: "conversation.view",
				id: "session-settings",
				order: 20,
				label: () => translator("sessionSettings.title")
			}, function SessionSettingsTabSlot(props) {
				const sessionsService = ctx.get("sessions");
				const workspacesService = ctx.get("workspaces");
				return e(SessionSettingsViewPage, {
					...props,
					remote,
					api: connection.api,
					t: translator,
					useSessions: (selector) => {
						const snap = sessionsService?.list?.getSnapshot?.() || {};
						return selector ? selector(snap) : snap;
					},
					useWorkspaces: (selector) => {
						const snap = workspacesService?.list?.getSnapshot?.() || {};
						return selector ? selector(snap) : snap;
					}
				});
			}));
			ctx.effect(() => {
				let frame = 0;
				const updateNavIcons = () => {
					if (document.querySelector("[role=\"dialog\"]") === null) return;
					const navButtons = document.querySelectorAll("button[class*=\"navCell\"]");
					for (const btn of Array.from(navButtons)) {
						const label = btn.querySelector("span[class*=\"navLabel\"]");
						if (!label) continue;
						if (label.textContent === "MCP 服务器" || label.textContent === "MCP Servers") {
							const iconSvg = btn.querySelector("svg[class*=\"navIcon\"]");
							if (iconSvg && !iconSvg.getAttribute("data-mcp-official-icon")) {
								iconSvg.setAttribute("data-mcp-official-icon", "true");
								iconSvg.setAttribute("viewBox", "0 0 16 16");
								iconSvg.innerHTML = `
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12.3368 1.53569L11.931 4.43172H14.8086V5.79673H11.7404L11.1962 9.67859H14.2839V11.0436H11.0056L10.4994 14.6529L9.14873 14.4643L9.62731 11.0436H5.75876L5.25252 14.6529L3.90186 14.4643L4.38043 11.0436H1.69141V9.67859H4.57104L5.11417 5.79673H2.21609V4.43172H5.30581L5.73724 1.34713L7.08995 1.53569L6.68414 4.43172H10.5527L10.9841 1.34713L12.3368 1.53569ZM5.94937 9.67859H9.81791L10.361 5.79673H6.49353L5.94937 9.67859Z" />
            `;
							}
						}
						if (label.textContent === "技能" || label.textContent === "Skills") {
							const iconSvg = btn.querySelector("svg[class*=\"navIcon\"]");
							if (iconSvg && !iconSvg.getAttribute("data-skills-official-icon")) {
								iconSvg.setAttribute("data-skills-official-icon", "true");
								iconSvg.setAttribute("viewBox", "0 0 16 16");
								iconSvg.innerHTML = `
            <path fill="currentColor" d="M12.5113 15.4067C12.4395 15.6249 12.1308 15.6249 12.059 15.4067L11.643 14.1416C11.454 13.567 11.0033 13.1164 10.4288 12.9274L9.16369 12.5113C8.94544 12.4395 8.94544 12.1308 9.16369 12.059L10.4288 11.643C11.0033 11.454 11.454 11.0033 11.643 10.4288L12.059 9.16369C12.1308 8.94544 12.4395 8.94544 12.5113 9.16369L12.9274 10.4288C13.1164 11.0033 13.567 11.454 14.1416 11.643L15.4067 12.059C15.6249 12.1308 15.6249 12.4395 15.4067 12.5113L14.1416 12.9274C13.567 13.1164 13.1164 13.567 12.9274 14.1416L12.5113 15.4067Z" />
            <path fill="currentColor" d="M9.02246 0.546878C9.9822 0.546878 10.7564 0.545403 11.374 0.612307C12.0042 0.680586 12.5515 0.826244 13.0273 1.17188C13.3052 1.37376 13.5501 1.61868 13.752 1.89649C14.0975 2.37225 14.2432 2.91984 14.3115 3.54981C14.3784 4.16727 14.377 4.94206 14.377 5.90137V8.51367C13.9611 8.29533 13.5071 8.13985 13.0273 8.06055V5.90137C13.0273 4.9121 13.0259 4.22322 12.9688 3.69532C12.9129 3.18044 12.8098 2.89782 12.6592 2.69043C12.5406 2.52724 12.3966 2.38326 12.2334 2.26465C12.026 2.11404 11.7437 2.0109 11.2285 1.95508C10.7005 1.89789 10.0122 1.89649 9.02246 1.89649H6.55371C5.56395 1.89649 4.87569 1.89787 4.34766 1.95508C3.83242 2.01092 3.55022 2.11398 3.34278 2.26465C3.17953 2.38329 3.03564 2.52719 2.91699 2.69043C2.76642 2.89782 2.66325 3.18042 2.60742 3.69532C2.55027 4.22322 2.54883 4.9121 2.54883 5.90137V10.0986C2.54883 11.0878 2.55031 11.7768 2.60742 12.3047C2.66326 12.8196 2.76642 13.1032 2.91699 13.3105C3.03558 13.4736 3.17966 13.6178 3.34278 13.7363C3.5502 13.8869 3.83265 13.9901 4.34766 14.0459C4.87568 14.1031 5.56398 14.1035 6.55371 14.1035H8.08399C8.27443 14.6025 8.55077 15.0585 8.89551 15.4541H6.55371C5.59402 15.4541 4.81976 15.4546 4.20215 15.3877C3.57204 15.3194 3.02468 15.1738 2.54883 14.8281C2.27111 14.6263 2.02606 14.3813 1.82422 14.1035C1.47883 13.6278 1.33293 13.08 1.26465 12.4502C1.19783 11.8327 1.19922 11.0579 1.19922 10.0986V5.90137C1.19922 4.94206 1.1978 4.16727 1.26465 3.54981C1.33295 2.91984 1.47867 2.37225 1.82422 1.89649C2.02613 1.61864 2.27098 1.37379 2.54883 1.17188C3.02472 0.826181 3.57197 0.6806 4.20215 0.612307C4.81976 0.545393 5.594 0.546877 6.55371 0.546878H9.02246ZM9.19629 9.14649H4.5459V7.84571H9.19629V9.14649ZM11.0303 6.10645H4.5459V4.80567H11.0303V6.10645Z" />
            `;
							}
						}
					}
				};
				const scheduleUpdate = () => {
					if (frame !== 0) return;
					frame = requestAnimationFrame(() => {
						frame = 0;
						updateNavIcons();
					});
				};
				const observer = new MutationObserver(scheduleUpdate);
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				return () => {
					if (frame !== 0) cancelAnimationFrame(frame);
					observer.disconnect();
				};
			}, "session-settings: official sidebar nav icons");
			ctx.effect(() => {
				let unmounted = false;
				let currentRoot = null;
				let currentContainer = null;
				let frame = 0;
				const checkMount = () => {
					if (unmounted) return;
					const heroRow = document.querySelector("div[class*=\"heroWorkspaceRow\"], div[class*=\"workspaceRow\"]");
					if (!heroRow) {
						if (currentRoot) {
							currentRoot.unmount();
							currentRoot = null;
							currentContainer = null;
						}
						return;
					}
					if (currentContainer && heroRow.contains(currentContainer)) {
						const seatBtn = heroRow.querySelector("button[class*=\"seat\"], div[class*=\"seat\"], [class*=\"agentPreset\"]");
						if (seatBtn && seatBtn.parentNode === heroRow && currentContainer.previousElementSibling !== seatBtn) seatBtn.after(currentContainer);
						return;
					}
					if (currentRoot) {
						currentRoot.unmount();
						currentRoot = null;
						currentContainer = null;
					}
					const container = document.createElement("div");
					container.setAttribute("data-dsh-hero-session-settings", "");
					container.className = "dsh-hero-session-settings-seat";
					const seatBtn = heroRow.querySelector("button[class*=\"seat\"], div[class*=\"seat\"], [class*=\"agentPreset\"]");
					if (seatBtn && seatBtn.parentNode === heroRow) seatBtn.after(container);
					else heroRow.appendChild(container);
					currentContainer = container;
					currentRoot = (0, react_dom_client.createRoot)(container);
					currentRoot.render(e(SessionSettingsHeroChip, {
						remote,
						api: connection.api,
						locale: ctx.get("locale"),
						sessions: ctx.get("sessions"),
						workspaces: ctx.get("workspaces")
					}));
				};
				const scheduleCheck = () => {
					if (frame !== 0) return;
					frame = requestAnimationFrame(() => {
						frame = 0;
						checkMount();
					});
				};
				const observer = new MutationObserver(scheduleCheck);
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				scheduleCheck();
				return () => {
					unmounted = true;
					if (frame !== 0) cancelAnimationFrame(frame);
					observer.disconnect();
					if (currentRoot) {
						currentRoot.unmount();
						currentRoot = null;
						currentContainer = null;
					}
				};
			}, "session-settings: hero chip");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map