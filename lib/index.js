import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { Client, SSEClientTransport, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
//#region lib/types/types.js
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
//#region lib/types/server/common/paths.js
function getStorageDir(ensureExists = false) {
	const dshHome = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
	const storageDir = path.join(dshHome, "storages");
	if (ensureExists) try {
		if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
	} catch {}
	return storageDir;
}
function getMcpStoragePath(ensureDir = false) {
	return path.join(getStorageDir(ensureDir), "mcp_servers.json");
}
function getSessionSettingsStoragePath(ensureDir = false) {
	return path.join(getStorageDir(ensureDir), "session_settings.json");
}
//#endregion
//#region lib/types/server/mcp/storage.js
function loadMcpStore() {
	try {
		const file = getMcpStoragePath();
		if (fs.existsSync(file)) {
			const content = fs.readFileSync(file, "utf8");
			if (content.trim()) {
				const data = JSON.parse(content);
				if (data && typeof data === "object" && data.servers) return { servers: data.servers };
			}
		}
	} catch (err) {
		console.error("[session-settings:mcp-storage] Failed to load MCP store:", err);
	}
	return { servers: {} };
}
function saveMcpStore(store) {
	try {
		const file = getMcpStoragePath(true);
		const tmp = `${file}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
		fs.renameSync(tmp, file);
	} catch (err) {
		console.error("[session-settings:mcp-storage] Failed to save MCP store:", err);
	}
}
//#endregion
//#region lib/types/server/session/storage.js
const DEFAULT_GLOBAL_SETTINGS = {
	subagentModel: {
		inherit: true,
		allowAgentSelectModel: true,
		overrideForkModel: false
	},
	mcp: { enabledServerIds: [] },
	skills: {
		disabledModelSkills: [],
		disabledUserSkills: []
	}
};
const DEFAULT_SESSION_SETTINGS = {
	subagentModel: { mode: "workspace" },
	mcp: { mode: "workspace" },
	skills: { mode: "workspace" }
};
function normalizeSubagentModelTarget(raw) {
	if (!raw || typeof raw !== "object") return void 0;
	const provider = typeof raw.provider === "string" ? raw.provider.trim() : "";
	const model = typeof raw.model === "string" ? raw.model.trim() : "";
	if (!provider || !model) return void 0;
	return {
		provider,
		model,
		reasoningEffort: typeof raw.reasoningEffort === "string" && raw.reasoningEffort.trim() ? raw.reasoningEffort.trim() : void 0
	};
}
function normalizeGlobalSettings(raw) {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_GLOBAL_SETTINGS };
	const subagentModel = {
		allowAgentSelectModel: raw.subagentModel?.allowAgentSelectModel !== false,
		overrideForkModel: raw.subagentModel?.overrideForkModel === true
	};
	if (raw.subagentModel && typeof raw.subagentModel === "object") {
		if (raw.subagentModel.inherit === true) subagentModel.inherit = true;
		else {
			const modelPayload = raw.subagentModel.model;
			const target = normalizeSubagentModelTarget(modelPayload);
			if (target) {
				subagentModel.inherit = false;
				subagentModel.model = target;
			} else subagentModel.inherit = true;
		}
	} else subagentModel.inherit = true;
	const rawMcp = raw.mcp;
	const enabledServerIds = Array.isArray(rawMcp?.enabledServerIds) ? rawMcp.enabledServerIds.filter((id) => typeof id === "string" && id.trim().length > 0) : [];
	const toolsMode = {};
	if (rawMcp?.toolsMode && typeof rawMcp.toolsMode === "object") {
		for (const [k, v] of Object.entries(rawMcp.toolsMode)) if (typeof k === "string" && (v === "custom" || v === "global")) toolsMode[k] = v;
	}
	const disabledTools = {};
	if (rawMcp?.disabledTools && typeof rawMcp.disabledTools === "object") {
		for (const [k, v] of Object.entries(rawMcp.disabledTools)) if (typeof k === "string" && Array.isArray(v)) disabledTools[k] = v.filter((name) => typeof name === "string" && name.trim().length > 0);
	}
	const mcp = {
		enabledServerIds,
		...Object.keys(toolsMode).length > 0 ? { toolsMode } : {},
		...Object.keys(disabledTools).length > 0 ? { disabledTools } : {}
	};
	const rawSkills = raw.skills;
	return {
		subagentModel,
		mcp,
		skills: {
			disabledModelSkills: Array.isArray(rawSkills?.disabledModelSkills) ? rawSkills.disabledModelSkills.filter((s) => typeof s === "string" && s.trim().length > 0) : [],
			disabledUserSkills: Array.isArray(rawSkills?.disabledUserSkills) ? rawSkills.disabledUserSkills.filter((s) => typeof s === "string" && s.trim().length > 0) : []
		}
	};
}
function normalizeSubagentModelConfig(raw) {
	if (!raw || typeof raw !== "object") return { mode: "workspace" };
	const mode = raw.mode === "custom" ? "custom" : raw.mode === "global" ? "global" : "workspace";
	const allowAgentSelectModel = raw.allowAgentSelectModel !== void 0 ? Boolean(raw.allowAgentSelectModel) : void 0;
	const overrideForkModel = raw.overrideForkModel !== void 0 ? Boolean(raw.overrideForkModel) : void 0;
	const extraFlags = {
		...allowAgentSelectModel !== void 0 ? { allowAgentSelectModel } : {},
		...overrideForkModel !== void 0 ? { overrideForkModel } : {}
	};
	if (mode === "custom") {
		if (raw.inherit === true) return {
			mode: "custom",
			inherit: true,
			...extraFlags
		};
		const modelPayload = raw.model;
		const target = normalizeSubagentModelTarget(modelPayload);
		if (target) return {
			mode: "custom",
			inherit: false,
			model: target,
			...extraFlags
		};
		return {
			mode: "custom",
			inherit: true,
			...extraFlags
		};
	}
	return {
		mode,
		...extraFlags
	};
}
function normalizeMcpConfig(raw) {
	if (!raw || typeof raw !== "object") return { mode: "workspace" };
	const mode = raw.mode === "custom" ? "custom" : raw.mode === "global" ? "global" : "workspace";
	if (mode === "custom") {
		const enabledServerIds = Array.isArray(raw.enabledServerIds) ? raw.enabledServerIds.filter((id) => typeof id === "string" && id.trim().length > 0) : [];
		const toolsMode = {};
		if (raw.toolsMode && typeof raw.toolsMode === "object") {
			for (const [k, v] of Object.entries(raw.toolsMode)) if (typeof k === "string" && (v === "custom" || v === "global")) toolsMode[k] = v;
		}
		const disabledTools = {};
		if (raw.disabledTools && typeof raw.disabledTools === "object") {
			for (const [k, v] of Object.entries(raw.disabledTools)) if (typeof k === "string" && Array.isArray(v)) disabledTools[k] = v.filter((name) => typeof name === "string" && name.trim().length > 0);
		}
		return {
			mode: "custom",
			enabledServerIds,
			...Object.keys(toolsMode).length > 0 ? { toolsMode } : {},
			...Object.keys(disabledTools).length > 0 ? { disabledTools } : {}
		};
	}
	return { mode };
}
function normalizeSkillsConfig(raw) {
	if (!raw || typeof raw !== "object") return { mode: "workspace" };
	const mode = raw.mode === "custom" ? "custom" : raw.mode === "global" ? "global" : "workspace";
	if (mode === "custom") return {
		mode: "custom",
		disabledModelSkills: Array.isArray(raw.disabledModelSkills) ? raw.disabledModelSkills.filter((s) => typeof s === "string" && s.trim().length > 0) : [],
		disabledUserSkills: Array.isArray(raw.disabledUserSkills) ? raw.disabledUserSkills.filter((s) => typeof s === "string" && s.trim().length > 0) : []
	};
	return { mode };
}
function normalizeSessionSettings(raw) {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_SESSION_SETTINGS };
	return {
		subagentModel: normalizeSubagentModelConfig(raw.subagentModel),
		mcp: normalizeMcpConfig(raw.mcp),
		skills: normalizeSkillsConfig(raw.skills)
	};
}
function loadSessionSettingsStore() {
	try {
		const file = getSessionSettingsStoragePath();
		if (fs.existsSync(file)) {
			const content = fs.readFileSync(file, "utf8");
			if (content.trim()) {
				const data = JSON.parse(content);
				if (data && typeof data === "object") {
					const globalConfig = normalizeGlobalSettings(data.globalConfig);
					const workspaces = {};
					if (data.workspaces && typeof data.workspaces === "object") {
						for (const [id, w] of Object.entries(data.workspaces)) if (w && typeof w === "object") workspaces[id] = normalizeSessionSettings(w);
					}
					const sessions = {};
					if (data.sessions && typeof data.sessions === "object") {
						for (const [id, s] of Object.entries(data.sessions)) if (s && typeof s === "object") sessions[id] = normalizeSessionSettings(s);
					}
					return {
						globalConfig,
						workspaces,
						sessions
					};
				}
			}
		}
	} catch (err) {
		console.error("[session-settings:storage] Failed to load session settings store:", err);
	}
	return {
		globalConfig: { ...DEFAULT_GLOBAL_SETTINGS },
		workspaces: {},
		sessions: {}
	};
}
function saveSessionSettingsStore(store) {
	try {
		const file = getSessionSettingsStoragePath(true);
		const tmp = `${file}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
		fs.renameSync(tmp, file);
	} catch (err) {
		console.error("[session-settings:storage] Failed to save session settings store:", err);
	}
}
function renameMcpInConfig(mcp, oldId, newId) {
	if (!mcp) return false;
	let changed = false;
	if (Array.isArray(mcp.enabledServerIds) && mcp.enabledServerIds.includes(oldId)) {
		mcp.enabledServerIds = mcp.enabledServerIds.map((id) => id === oldId ? newId : id);
		changed = true;
	}
	if (mcp.toolsMode && oldId in mcp.toolsMode) {
		mcp.toolsMode[newId] = mcp.toolsMode[oldId];
		delete mcp.toolsMode[oldId];
		changed = true;
	}
	if (mcp.disabledTools && oldId in mcp.disabledTools) {
		mcp.disabledTools[newId] = mcp.disabledTools[oldId];
		delete mcp.disabledTools[oldId];
		changed = true;
	}
	return changed;
}
function renameServerIdInSessionStore(store, oldId, newId) {
	if (!oldId || !newId || oldId === newId) return false;
	let changed = false;
	if (store.globalConfig?.mcp) {
		if (renameMcpInConfig(store.globalConfig.mcp, oldId, newId)) changed = true;
	}
	if (store.workspaces) {
		for (const wsConfig of Object.values(store.workspaces)) if (wsConfig?.mcp && renameMcpInConfig(wsConfig.mcp, oldId, newId)) changed = true;
	}
	if (store.sessions) {
		for (const sCfg of Object.values(store.sessions)) if (sCfg?.mcp && renameMcpInConfig(sCfg.mcp, oldId, newId)) changed = true;
	}
	return changed;
}
function resolveEffectiveSubagentModel(store, sessionId, workspaceId) {
	const globalCfg = store.globalConfig?.subagentModel;
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
	const wsModel = workspaceId ? store.workspaces?.[workspaceId]?.subagentModel : void 0;
	const wsAllow = wsModel?.allowAgentSelectModel !== void 0 ? wsModel.allowAgentSelectModel : globalAllow;
	const wsOverrideFork = wsModel?.overrideForkModel !== void 0 ? wsModel.overrideForkModel : globalOverrideFork;
	const workspaceResult = wsModel?.mode === "custom" && wsModel.inherit === false && wsModel.model ? {
		mode: "custom",
		inherit: false,
		model: wsModel.model,
		allowAgentSelectModel: wsAllow,
		overrideForkModel: wsOverrideFork
	} : wsModel?.mode === "custom" && wsModel.inherit === true ? {
		mode: "custom",
		inherit: true,
		allowAgentSelectModel: wsAllow,
		overrideForkModel: wsOverrideFork
	} : {
		...globalResult,
		allowAgentSelectModel: wsAllow,
		overrideForkModel: wsOverrideFork
	};
	if (sessionId && store.sessions?.[sessionId]?.subagentModel) {
		const sModel = store.sessions[sessionId].subagentModel;
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
	if (workspaceId && wsModel) return workspaceResult;
	return globalResult;
}
function resolveEffectiveMcp(store, mcpStore, sessionId, workspaceId) {
	const defaultMcpIds = Object.values(mcpStore.servers).filter((s) => s.enabledByDefault).map((s) => s.id);
	const globalMcp = store.globalConfig?.mcp;
	const globalEnabledIds = Array.isArray(globalMcp?.enabledServerIds) ? globalMcp.enabledServerIds : defaultMcpIds;
	const globalToolsMode = globalMcp?.toolsMode || {};
	const globalDisabledTools = globalMcp?.disabledTools || {};
	let mode = "global";
	let enabledServerIds = [];
	let toolsMode = {};
	let disabledTools = {};
	let resolved = false;
	if (sessionId && store.sessions?.[sessionId]?.mcp) {
		const sMcp = store.sessions[sessionId].mcp;
		if (sMcp.mode === "custom") {
			mode = "custom";
			enabledServerIds = sMcp.enabledServerIds || [];
			toolsMode = sMcp.toolsMode || {};
			disabledTools = sMcp.disabledTools || {};
			resolved = true;
		} else if (sMcp.mode === "workspace") {
			if (workspaceId && store.workspaces?.[workspaceId]?.mcp?.mode === "custom") {
				const wsMcp = store.workspaces[workspaceId].mcp;
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
	if (!resolved && workspaceId && store.workspaces?.[workspaceId]?.mcp?.mode === "custom") {
		const wsMcp = store.workspaces[workspaceId].mcp;
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
	const effectiveDisabledTools = {};
	for (const server of Object.values(mcpStore.servers)) if (toolsMode[server.id] === "custom" && disabledTools[server.id]) effectiveDisabledTools[server.id] = disabledTools[server.id];
	else effectiveDisabledTools[server.id] = Array.isArray(server.disabledTools) ? server.disabledTools : [];
	return {
		mode,
		enabledServerIds,
		toolsMode,
		disabledTools,
		effectiveDisabledTools
	};
}
function resolveEffectiveSkills(store, sessionId, workspaceId) {
	const globalSkills = store.globalConfig?.skills;
	const globalModelSkills = globalSkills?.disabledModelSkills || [];
	const globalUserSkills = globalSkills?.disabledUserSkills || [];
	let mode = "global";
	let disabledModelSkills = [];
	let disabledUserSkills = [];
	let resolved = false;
	if (sessionId && store.sessions?.[sessionId]?.skills) {
		const sSkills = store.sessions[sessionId].skills;
		if (sSkills.mode === "custom") {
			mode = "custom";
			disabledModelSkills = sSkills.disabledModelSkills || [];
			disabledUserSkills = sSkills.disabledUserSkills || [];
			resolved = true;
		} else if (sSkills.mode === "workspace") {
			if (workspaceId && store.workspaces?.[workspaceId]?.skills?.mode === "custom") {
				const wsSkills = store.workspaces[workspaceId].skills;
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
	if (!resolved && workspaceId && store.workspaces?.[workspaceId]?.skills?.mode === "custom") {
		const wsSkills = store.workspaces[workspaceId].skills;
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
		disabledModelSkills,
		disabledUserSkills,
		effectiveDisabledModelSkills: disabledModelSkills,
		effectiveDisabledUserSkills: disabledUserSkills
	};
}
//#endregion
//#region lib/types/server/mcp/naming.js
const MAX_PUBLIC_NAME_LENGTH = 64;
const INVALID_NAME_CHARS = /[^A-Za-z0-9_-]/g;
const HASH_LENGTH = 12;
/**
* Deterministic public tool name calculation, matching DSH @deepseek-ai/dsh-mcp-client
*/
function publicToolName(serverName, rawName) {
	const joined = `mcp__${serverName}__${rawName}`;
	const normalized = joined.replace(INVALID_NAME_CHARS, "_");
	if (normalized === joined && normalized.length <= MAX_PUBLIC_NAME_LENGTH) return normalized;
	const hash = createHash("sha256").update(`${serverName}\0${rawName}`).digest("hex").slice(0, HASH_LENGTH);
	return `${normalized.slice(0, 51)}_${hash}`;
}
//#endregion
//#region lib/types/server/mcp/manager.js
let cachedOfficialPlugin = null;
/**
* Resolve the official @deepseek-ai/dsh-mcp-client Cordis plugin module directly via ctx.loader.
*/
async function loadOfficialMcpClientPlugin(ctx) {
	if (cachedOfficialPlugin) return cachedOfficialPlugin;
	const loader = ctx.loader ?? (typeof ctx.get === "function" ? ctx.get("loader") : void 0);
	if (!loader) {
		console.warn("[session-settings] [MCP-LOADER] Cordis loader service is not available on context.", {
			hasCtx: Boolean(ctx),
			availableServices: typeof ctx.reflect?.store === "object" ? Object.keys(ctx.reflect?.store ?? {}) : void 0
		});
		return null;
	}
	if (typeof loader.import !== "function") {
		console.warn("[session-settings] [MCP-LOADER] Loader service exists but does not have .import() method.", {
			loaderType: typeof loader,
			loaderKeys: Object.keys(loader)
		});
		return null;
	}
	try {
		const raw = await loader.import("@deepseek-ai/dsh-mcp-client");
		const mod = typeof loader.unwrapExports === "function" ? loader.unwrapExports(raw) : raw;
		if (mod && (typeof mod === "function" || typeof mod.apply === "function")) {
			cachedOfficialPlugin = mod;
			return mod;
		} else console.warn("[session-settings] [MCP-LOADER] Imported @deepseek-ai/dsh-mcp-client, but module shape does not match Cordis Plugin:", {
			rawType: typeof raw,
			rawKeys: raw && typeof raw === "object" ? Object.keys(raw) : void 0,
			modType: typeof mod,
			modKeys: mod && typeof mod === "object" ? Object.keys(mod) : void 0
		});
	} catch (err) {
		const errorObj = err instanceof Error ? err : new Error(String(err));
		console.warn("[session-settings] [MCP-LOADER] Failed to import @deepseek-ai/dsh-mcp-client via loader:", {
			name: errorObj.name,
			message: errorObj.message,
			code: errorObj.code,
			stack: errorObj.stack,
			baseUrl: ctx.baseUrl ?? ctx.root?.baseUrl
		});
	}
	return null;
}
var McpManager = class {
	ctx;
	getMcpStore;
	getSessionSettingsStore;
	/** Map of serverId -> active Cordis Plugin Fork instance of @deepseek-ai/dsh-mcp-client */
	officialForks = /* @__PURE__ */ new Map();
	/** Map of publicToolName -> { serverId, rawName } metadata */
	toolMeta = /* @__PURE__ */ new Map();
	/** Map of serverId -> Set of publicToolNames registered for that server */
	serverToolMap = /* @__PURE__ */ new Map();
	/** Active sync promises to prevent race conditions */
	activeSyncs = /* @__PURE__ */ new Map();
	constructor(ctx, getMcpStore, getSessionSettingsStore) {
		this.ctx = ctx;
		this.getMcpStore = getMcpStore;
		this.getSessionSettingsStore = getSessionSettingsStore;
	}
	/**
	* Check if an MCP server is currently needed (enabled by default or enabled in any active session).
	*/
	isServerNeeded(serverId) {
		const server = this.getMcpStore().servers[serverId];
		if (!server) return false;
		if (server.enabledByDefault) return true;
		const sessionSettingsStore = this.getSessionSettingsStore?.();
		if (sessionSettingsStore) {
			if (sessionSettingsStore.globalConfig?.mcp?.enabledServerIds?.includes(serverId)) return true;
			if (sessionSettingsStore.workspaces) {
				for (const wsConfig of Object.values(sessionSettingsStore.workspaces)) if (wsConfig?.mcp?.mode === "custom" && wsConfig.mcp.enabledServerIds?.includes(serverId)) return true;
			}
			if (sessionSettingsStore.sessions) {
				for (const sessionConfig of Object.values(sessionSettingsStore.sessions)) if (sessionConfig.mcp?.mode === "custom" && sessionConfig.mcp.enabledServerIds?.includes(serverId)) return true;
			}
		}
		return false;
	}
	/**
	* Get metadata for a public tool name.
	*/
	getToolMeta(publicName) {
		return this.toolMeta.get(publicName);
	}
	/**
	* Check if a tool is an MCP tool managed by this plugin.
	*/
	isMcpTool(publicName) {
		return this.toolMeta.has(publicName) || publicName.startsWith("mcp__");
	}
	/**
	* Mount official @deepseek-ai/dsh-mcp-client plugin instance dynamically in memory.
	*/
	async mountOfficialClient(server, officialPlugin) {
		this.unmountOfficialClient(server.id);
		const baseConfig = {
			serverName: server.id,
			toolCallTimeoutMs: server.toolCallTimeoutMs ?? 6e4,
			failOnStartupError: Boolean(server.failOnStartupError),
			reconnect: {
				enabled: server.reconnect?.enabled ?? true,
				initialDelayMs: server.reconnect?.initialDelayMs ?? 500,
				maxDelayMs: server.reconnect?.maxDelayMs ?? 3e4,
				maxAttempts: server.reconnect?.maxAttempts ?? 10
			}
		};
		const officialConfig = server.transport === "stdio" ? {
			...baseConfig,
			transport: "stdio",
			command: server.command ?? "",
			args: server.args ?? [],
			env: server.env ?? {},
			cwd: server.cwd ?? ""
		} : {
			...baseConfig,
			transport: "streamable-http",
			url: server.url ?? "",
			headers: server.headers ?? {}
		};
		try {
			const fork = this.ctx.plugin(officialPlugin, officialConfig);
			this.officialForks.set(server.id, fork);
			if (Array.isArray(server.toolDetails)) {
				const names = /* @__PURE__ */ new Set();
				for (const t of server.toolDetails) {
					const pub = publicToolName(server.id, t.name);
					this.toolMeta.set(pub, {
						serverId: server.id,
						rawName: t.name
					});
					names.add(pub);
				}
				this.serverToolMap.set(server.id, names);
			}
			return true;
		} catch (err) {
			console.error(`[session-settings] [MCP-MOUNT] Failed to mount official mcp-client for server "${server.name || server.id}" (${server.id}):`, {
				error: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : void 0,
				config: {
					serverName: server.id,
					transport: server.transport,
					endpoint: server.transport === "stdio" ? server.command : server.url
				}
			});
			return false;
		}
	}
	/**
	* Unmount official mcp-client fork for a server.
	*/
	unmountOfficialClient(serverId) {
		const fork = this.officialForks.get(serverId);
		if (fork) {
			try {
				fork.dispose();
			} catch {}
			this.officialForks.delete(serverId);
		}
		const existingNames = this.serverToolMap.get(serverId);
		if (existingNames) {
			for (const pubName of existingNames) this.toolMeta.delete(pubName);
			this.serverToolMap.delete(serverId);
		}
	}
	/**
	* Ensure all servers in the given list are mounted on-demand.
	*/
	async ensureServersMounted(serverIds) {
		if (!Array.isArray(serverIds) || serverIds.length === 0) return;
		const store = this.getMcpStore();
		const pending = serverIds.filter((id) => !this.officialForks.has(id)).map((id) => store.servers[id]).filter((s) => Boolean(s));
		if (pending.length === 0) return;
		await Promise.all(pending.map((server) => this.syncServer(server)));
	}
	/**
	* Synchronize tool registrations for a single server by mounting/unmounting official client fork.
	*/
	async syncServer(server) {
		if (!server || !server.id) return;
		if (!this.isServerNeeded(server.id)) {
			this.unmountOfficialClient(server.id);
			return;
		}
		if (this.activeSyncs.has(server.id)) return this.activeSyncs.get(server.id);
		const syncPromise = (async () => {
			try {
				const liveServer = this.getMcpStore().servers[server.id] || server;
				const officialPlugin = await loadOfficialMcpClientPlugin(this.ctx);
				if (officialPlugin) await this.mountOfficialClient(liveServer, officialPlugin);
				else console.error(`[session-settings] [MCP-SYNC] Official @deepseek-ai/dsh-mcp-client plugin not found in DSH environment. Skipping mount for server "${server.name || server.id}" (${server.id}).`, {
					serverId: server.id,
					serverName: server.name,
					transport: server.transport,
					target: server.transport === "stdio" ? `${server.command} ${(server.args || []).join(" ")}` : server.url
				});
			} catch (err) {
				console.error(`[session-settings] [MCP-SYNC] Sync failed for MCP server "${server.name || server.id}" (${server.id}):`, {
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : void 0
				});
			} finally {
				this.activeSyncs.delete(server.id);
			}
		})();
		this.activeSyncs.set(server.id, syncPromise);
		return syncPromise;
	}
	/**
	* Synchronize all servers in the store.
	*/
	syncAll() {
		const store = this.getMcpStore();
		const allServers = Object.values(store.servers);
		for (const serverId of Array.from(this.officialForks.keys())) if (!store.servers[serverId] || !this.isServerNeeded(serverId)) this.unmountOfficialClient(serverId);
		for (const server of allServers) if (this.isServerNeeded(server.id)) this.syncServer(server).catch(() => {});
		else this.unmountOfficialClient(server.id);
	}
	/**
	* Teardown and unmount all official client forks on plugin unload.
	*/
	dispose() {
		for (const fork of this.officialForks.values()) try {
			fork.dispose();
		} catch {}
		this.officialForks.clear();
		this.toolMeta.clear();
		this.serverToolMap.clear();
	}
};
//#endregion
//#region lib/types/server/mcp/tester/stdio-runner.js
/**
* STDIO transport tester powered by official @modelcontextprotocol/client.
*/
/** Test an MCP server over STDIO transport */
async function testStdioConnection(server) {
	const command = server.command?.trim();
	if (!command) return {
		ok: false,
		message: "stdio 模式需要填写启动命令 (command)"
	};
	let stderrBuffer = "";
	const transport = new StdioClientTransport({
		command,
		args: server.args ?? [],
		env: server.env ?? {},
		cwd: server.cwd?.trim() || void 0,
		stderr: "pipe"
	});
	transport.stderr?.on("data", (chunk) => {
		stderrBuffer += chunk.toString("utf8");
		if (stderrBuffer.length > 2048) stderrBuffer = stderrBuffer.slice(-2048);
	});
	const testTimeoutMs = typeof server.toolCallTimeoutMs === "number" && server.toolCallTimeoutMs > 0 ? Math.max(server.toolCallTimeoutMs, 5e3) : 6e4;
	const probeTimeoutMs = Math.min(Math.max(Math.floor(testTimeoutMs / 4), 5e3), 15e3);
	const client = new Client({
		name: "dsh-mcp-tester",
		version: "1.0.0"
	}, { versionNegotiation: {
		mode: "auto",
		probe: {
			timeoutMs: probeTimeoutMs,
			maxRetries: 0
		}
	} });
	try {
		await client.connect(transport, {
			timeout: testTimeoutMs,
			signal: AbortSignal.timeout(testTimeoutMs)
		});
		const listResult = await client.listTools(void 0, {
			timeout: testTimeoutMs,
			signal: AbortSignal.timeout(testTimeoutMs)
		});
		const serverVersion = client.getServerVersion();
		const protocolVersion = client.getNegotiatedProtocolVersion();
		const discoverResult = client.getDiscoverResult();
		const supportedVersions = discoverResult && Array.isArray(discoverResult.supportedVersions) ? discoverResult.supportedVersions : protocolVersion ? [protocolVersion] : [];
		const toolDetails = (listResult?.tools || []).map((t) => {
			const item = t;
			return {
				name: typeof t === "string" ? t : typeof item.name === "string" ? item.name : typeof item.id === "string" ? item.id : "",
				description: typeof item.description === "string" ? item.description : void 0,
				inputSchema: item.inputSchema && typeof item.inputSchema === "object" ? item.inputSchema : void 0
			};
		});
		const toolNames = toolDetails.map((t) => t.name).filter(Boolean);
		const count = toolNames.length;
		return {
			ok: true,
			count,
			tools: toolNames,
			toolDetails,
			serverInfo: {
				name: serverVersion?.name,
				title: serverVersion?.title,
				version: serverVersion?.version,
				description: serverVersion?.description,
				websiteUrl: serverVersion?.websiteUrl,
				icons: serverVersion?.icons,
				protocolVersion,
				supportedVersions
			},
			supportedVersions,
			detectedTransport: "stdio",
			message: count > 0 ? `成功获取到 ${count} 个工具` : "成功连接并完成 MCP 握手 (未声明可用工具)"
		};
	} catch (err) {
		const stderrDetail = stderrBuffer.trim() ? `\n(stderr: ${stderrBuffer.trim().slice(-300)})` : "";
		return {
			ok: false,
			message: `STDIO 连接测试失败${err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /timeout|timed out|aborted/i.test(err.message)) ? ` (已等待 ${Math.round(testTimeoutMs / 1e3)} 秒)` : ""}: ${err instanceof Error ? err.message : String(err)}${stderrDetail}`
		};
	} finally {
		await client.close().catch(() => {});
	}
}
//#endregion
//#region lib/types/server/mcp/tester/http-runner.js
/**
* Streamable HTTP & SSE transport tester powered by official @modelcontextprotocol/client.
*/
/** Test an MCP server over Streamable HTTP or SSE transport */
async function testHttpConnection(server) {
	const urlStr = server.url?.trim();
	if (!urlStr) return {
		ok: false,
		message: "HTTP/SSE 模式需要填写服务器地址 (url)"
	};
	let parsedUrl;
	try {
		parsedUrl = new URL(urlStr);
	} catch (err) {
		return {
			ok: false,
			message: `URL 格式不正确: ${err instanceof Error ? err.message : String(err)}`
		};
	}
	const isSsePath = parsedUrl.pathname.includes("/sse");
	const testTimeoutMs = typeof server.toolCallTimeoutMs === "number" && server.toolCallTimeoutMs > 0 ? Math.max(server.toolCallTimeoutMs, 3e3) : 3e4;
	const probeTimeoutMs = Math.min(Math.max(Math.floor(testTimeoutMs / 3), 3e3), 1e4);
	const customHeaders = server.headers ?? {};
	const runTestWithTransport = async (transport, transportKind) => {
		const client = new Client({
			name: "dsh-mcp-tester",
			version: "1.0.0"
		}, { versionNegotiation: {
			mode: "auto",
			probe: {
				timeoutMs: probeTimeoutMs,
				maxRetries: 0
			}
		} });
		try {
			await client.connect(transport, {
				timeout: testTimeoutMs,
				signal: AbortSignal.timeout(testTimeoutMs)
			});
			const listResult = await client.listTools(void 0, {
				timeout: testTimeoutMs,
				signal: AbortSignal.timeout(testTimeoutMs)
			});
			const serverVersion = client.getServerVersion();
			const protocolVersion = client.getNegotiatedProtocolVersion();
			const discoverResult = client.getDiscoverResult();
			const supportedVersions = discoverResult && Array.isArray(discoverResult.supportedVersions) ? discoverResult.supportedVersions : protocolVersion ? [protocolVersion] : [];
			const toolDetails = (listResult?.tools || []).map((t) => {
				const item = t;
				return {
					name: typeof t === "string" ? t : typeof item.name === "string" ? item.name : typeof item.id === "string" ? item.id : "",
					description: typeof item.description === "string" ? item.description : void 0,
					inputSchema: item.inputSchema && typeof item.inputSchema === "object" ? item.inputSchema : void 0
				};
			});
			const toolNames = toolDetails.map((t) => t.name).filter(Boolean);
			const count = toolNames.length;
			return {
				ok: true,
				count,
				tools: toolNames,
				toolDetails,
				serverInfo: {
					name: serverVersion?.name,
					title: serverVersion?.title,
					version: serverVersion?.version,
					description: serverVersion?.description,
					websiteUrl: serverVersion?.websiteUrl,
					icons: serverVersion?.icons,
					protocolVersion,
					supportedVersions
				},
				supportedVersions,
				detectedTransport: transportKind,
				message: count > 0 ? `成功获取到 ${count} 个工具` : "成功连接并完成 MCP 握手 (未声明可用工具)"
			};
		} finally {
			await client.close().catch(() => {});
		}
	};
	if (isSsePath) try {
		return await runTestWithTransport(new SSEClientTransport(parsedUrl, { requestInit: { headers: customHeaders } }), "sse");
	} catch (err) {
		return {
			ok: false,
			message: `SSE 连接测试失败: ${err instanceof Error ? err.message : String(err)}`
		};
	}
	try {
		return await runTestWithTransport(new StreamableHTTPClientTransport(parsedUrl, {
			requestInit: { headers: customHeaders },
			reconnectionOptions: {
				maxRetries: 0,
				initialReconnectionDelay: 0,
				maxReconnectionDelay: 0,
				reconnectionDelayGrowFactor: 1
			}
		}), "streamable-http");
	} catch (httpErr) {
		const errMsg = httpErr instanceof Error ? httpErr.message : String(httpErr);
		if (!/fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET|timeout/i.test(errMsg) && /unexpected content|405|text\/event-stream/i.test(errMsg)) try {
			return await runTestWithTransport(new SSEClientTransport(parsedUrl, { requestInit: { headers: customHeaders } }), "sse");
		} catch (sseErr) {
			return {
				ok: false,
				message: `Streamable HTTP 失败 (${errMsg})，尝试降级 SSE 亦失败: ${sseErr instanceof Error ? sseErr.message : String(sseErr)}`
			};
		}
		return {
			ok: false,
			message: `HTTP 连接测试失败: ${errMsg}`
		};
	}
}
//#endregion
//#region lib/types/server/mcp/tester/index.js
/** Test if an MCP server can be connected to and successfully list its tools via MCP JSON-RPC protocol */
async function testMcpConnection(server) {
	if (!server.transport) return {
		ok: false,
		message: "缺少传输协议类型 (transport)"
	};
	if (server.transport === "stdio") return testStdioConnection(server);
	if (server.transport === "streamable-http" || server.transport === "streamable-http-or-sse") return testHttpConnection(server);
	return {
		ok: false,
		message: `不支持的传输协议: ${server.transport}`
	};
}
//#endregion
//#region lib/types/server/common/http.js
async function readRequestBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}
//#endregion
//#region lib/types/server/mcp/routes.js
function sendJson(res, statusCode, data) {
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.writeHead(statusCode);
	res.end(JSON.stringify(data));
}
function sendMethodNotAllowed(res) {
	sendJson(res, 405, {
		ok: false,
		error: "Method Not Allowed"
	});
}
function getSanitizedServers(store) {
	return Object.values(store.servers).map((s) => {
		const { toolDetails, tools, disabledTools, ...rest } = s;
		return {
			...rest,
			tools: Array.isArray(tools) ? tools.length : 0,
			disabledTools: Array.isArray(disabledTools) ? disabledTools.length : 0
		};
	});
}
function parseServerConfig(incoming, existing) {
	const id = (typeof incoming.id === "string" ? incoming.id : "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
	const name = (typeof incoming.name === "string" ? incoming.name : "").trim();
	if (!id || !name) return { error: "Server ID and name are required" };
	const rawTransport = incoming.transport;
	const transport = rawTransport === "stdio" ? "stdio" : rawTransport === "streamable-http" || rawTransport === "streamable-http-or-sse" || rawTransport === "sse" ? "streamable-http" : null;
	if (!transport) return { error: "Valid transport (stdio, streamable-http) is required" };
	if (transport === "stdio" && !incoming.command?.trim()) return { error: "Command is required for stdio transport" };
	if (transport !== "stdio" && !incoming.url?.trim()) return { error: "URL is required for HTTP/SSE transport" };
	const now = Date.now();
	const toolCallTimeoutMs = typeof incoming.toolCallTimeoutMs === "number" && incoming.toolCallTimeoutMs > 0 ? Math.floor(incoming.toolCallTimeoutMs) : void 0;
	const failOnStartupError = typeof incoming.failOnStartupError === "boolean" ? incoming.failOnStartupError : void 0;
	let reconnect = void 0;
	if (incoming.reconnect && typeof incoming.reconnect === "object") reconnect = {
		enabled: typeof incoming.reconnect.enabled === "boolean" ? incoming.reconnect.enabled : void 0,
		initialDelayMs: typeof incoming.reconnect.initialDelayMs === "number" && incoming.reconnect.initialDelayMs >= 0 ? Math.floor(incoming.reconnect.initialDelayMs) : void 0,
		maxDelayMs: typeof incoming.reconnect.maxDelayMs === "number" && incoming.reconnect.maxDelayMs >= 0 ? Math.floor(incoming.reconnect.maxDelayMs) : void 0,
		maxAttempts: typeof incoming.reconnect.maxAttempts === "number" && incoming.reconnect.maxAttempts >= 0 ? Math.floor(incoming.reconnect.maxAttempts) : void 0
	};
	const disabledTools = Array.isArray(incoming.disabledTools) ? Array.from(new Set(incoming.disabledTools.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean))) : existing?.disabledTools;
	return {
		config: {
			id,
			name,
			description: incoming.description?.trim() || void 0,
			transport,
			command: incoming.command?.trim() || void 0,
			args: Array.isArray(incoming.args) ? incoming.args.filter((a) => typeof a === "string") : [],
			env: incoming.env && typeof incoming.env === "object" ? incoming.env : void 0,
			cwd: incoming.cwd?.trim() || void 0,
			url: incoming.url?.trim() || void 0,
			headers: incoming.headers && typeof incoming.headers === "object" ? incoming.headers : void 0,
			enabledByDefault: Boolean(incoming.enabledByDefault),
			toolCallTimeoutMs: toolCallTimeoutMs ?? existing?.toolCallTimeoutMs,
			failOnStartupError: failOnStartupError ?? existing?.failOnStartupError,
			reconnect: reconnect ?? existing?.reconnect,
			disabledTools: Array.isArray(disabledTools) && disabledTools.length > 0 ? disabledTools : void 0,
			tools: Array.isArray(incoming.tools) ? incoming.tools : existing?.tools,
			toolDetails: incoming.toolDetails ?? existing?.toolDetails,
			detectedTransport: incoming.detectedTransport ?? existing?.detectedTransport,
			serverInfo: incoming.serverInfo ?? existing?.serverInfo,
			lastTestedAt: incoming.lastTestedAt ?? existing?.lastTestedAt,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now
		},
		id
	};
}
function registerMcpRoutes(webServer, getMcpStore, setMcpStore, mcpManager, getSessionSettingsStore, setSessionSettingsStore) {
	const unregisterListRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersList,
		handler: async (req, res) => {
			if (req.method !== "GET") {
				sendMethodNotAllowed(res);
				return;
			}
			try {
				const currentStore = loadMcpStore();
				setMcpStore(currentStore);
				sendJson(res, 200, {
					ok: true,
					servers: getSanitizedServers(currentStore)
				});
			} catch (err) {
				sendJson(res, 500, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	});
	const unregisterAddRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersAdd,
		handler: async (req, res) => {
			if (req.method !== "POST") {
				sendMethodNotAllowed(res);
				return;
			}
			try {
				const bodyStr = await readRequestBody(req);
				const parsed = JSON.parse(bodyStr || "{}");
				const { error, config, id } = parseServerConfig(parsed.server || parsed);
				if (error || !config || !id) {
					sendJson(res, 400, {
						ok: false,
						error: error || "Invalid server configuration"
					});
					return;
				}
				const mcpStore = getMcpStore();
				mcpStore.servers[id] = config;
				saveMcpStore(mcpStore);
				setMcpStore(mcpStore);
				mcpManager?.syncServer(config);
				sendJson(res, 200, {
					ok: true,
					server: config
				});
			} catch (err) {
				sendJson(res, 400, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	});
	const unregisterEditRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersEdit,
		handler: async (req, res) => {
			if (req.method !== "POST") {
				sendMethodNotAllowed(res);
				return;
			}
			try {
				const bodyStr = await readRequestBody(req);
				const parsed = JSON.parse(bodyStr || "{}");
				const incoming = parsed.server || parsed;
				const originalId = typeof parsed.originalId === "string" ? parsed.originalId.trim() : "";
				const mcpStore = getMcpStore();
				const isRename = Boolean(originalId && mcpStore.servers[originalId]);
				const { error, config, id } = parseServerConfig(incoming, isRename ? mcpStore.servers[originalId] : typeof incoming.id === "string" ? mcpStore.servers[incoming.id.trim()] : void 0);
				if (error || !config || !id) {
					sendJson(res, 400, {
						ok: false,
						error: error || "Invalid server configuration"
					});
					return;
				}
				if (isRename && originalId !== id) {
					delete mcpStore.servers[originalId];
					mcpManager?.unmountOfficialClient(originalId);
					const currentSessionSettings = getSessionSettingsStore ? getSessionSettingsStore() : loadSessionSettingsStore();
					if (renameServerIdInSessionStore(currentSessionSettings, originalId, id)) {
						saveSessionSettingsStore(currentSessionSettings);
						setSessionSettingsStore?.(currentSessionSettings);
					}
				}
				mcpStore.servers[id] = config;
				saveMcpStore(mcpStore);
				setMcpStore(mcpStore);
				mcpManager?.syncServer(config);
				sendJson(res, 200, {
					ok: true,
					server: config
				});
			} catch (err) {
				sendJson(res, 400, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	});
	const unregisterRmRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersRm,
		handler: async (req, res) => {
			if (req.method !== "POST") {
				sendMethodNotAllowed(res);
				return;
			}
			try {
				const bodyStr = await readRequestBody(req);
				const parsed = bodyStr ? JSON.parse(bodyStr) : {};
				const url = new URL(req.url ?? "/", "http://localhost");
				const targetId = (parsed.id || url.searchParams.get("id") || "").trim();
				if (!targetId) {
					sendJson(res, 400, {
						ok: false,
						error: "Server ID is required"
					});
					return;
				}
				const mcpStore = getMcpStore();
				if (mcpStore.servers[targetId]) {
					delete mcpStore.servers[targetId];
					saveMcpStore(mcpStore);
					setMcpStore(mcpStore);
					mcpManager?.unmountOfficialClient(targetId);
				}
				sendJson(res, 200, {
					ok: true,
					id: targetId
				});
			} catch (err) {
				sendJson(res, 400, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	});
	const unregisterToolviewRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersToolview,
		handler: async (req, res) => {
			if (req.method !== "GET") {
				sendMethodNotAllowed(res);
				return;
			}
			const targetId = (new URL(req.url ?? "/", "http://localhost").searchParams.get("id") || "").trim();
			const currentStore = loadMcpStore();
			setMcpStore(currentStore);
			if (!targetId || !currentStore.servers[targetId]) {
				sendJson(res, 404, {
					ok: false,
					error: "Server not found"
				});
				return;
			}
			const s = currentStore.servers[targetId];
			sendJson(res, 200, {
				ok: true,
				cached: true,
				tools: s.tools || [],
				toolDetails: s.toolDetails || [],
				disabledTools: Array.isArray(s.disabledTools) ? s.disabledTools : [],
				serverInfo: s.serverInfo,
				detectedTransport: s.detectedTransport
			});
		}
	});
	const unregisterToolsRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersTools,
		handler: async (req, res) => {
			if (req.method !== "POST") {
				sendMethodNotAllowed(res);
				return;
			}
			try {
				const bodyStr = await readRequestBody(req);
				const parsed = JSON.parse(bodyStr || "{}");
				const testPayload = parsed.server || parsed;
				const mcpStore = getMcpStore();
				const targetId = (typeof testPayload.id === "string" ? testPayload.id : "").trim();
				const existing = targetId ? mcpStore.servers[targetId] : void 0;
				const testResult = await testMcpConnection(existing ? {
					...existing,
					...testPayload
				} : testPayload);
				if (targetId && mcpStore.servers[targetId] && testResult.ok) {
					const s = mcpStore.servers[targetId];
					if (testResult.tools) s.tools = testResult.tools;
					if (testResult.toolDetails) s.toolDetails = testResult.toolDetails;
					if (testResult.detectedTransport) s.detectedTransport = testResult.detectedTransport;
					if (testResult.serverInfo) s.serverInfo = testResult.serverInfo;
					s.lastTestedAt = Date.now();
					saveMcpStore(mcpStore);
					setMcpStore(mcpStore);
					mcpManager?.syncServer(s);
				}
				sendJson(res, 200, testResult);
			} catch (err) {
				sendJson(res, 400, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	});
	const unregisterTestRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersTest,
		handler: async (req, res) => {
			if (req.method !== "POST") {
				sendMethodNotAllowed(res);
				return;
			}
			try {
				const bodyStr = await readRequestBody(req);
				const parsed = JSON.parse(bodyStr || "{}");
				const testPayload = parsed.server || parsed;
				const mcpStore = getMcpStore();
				const targetId = (typeof testPayload.id === "string" ? testPayload.id : "").trim();
				const existing = targetId ? mcpStore.servers[targetId] : void 0;
				const testResult = await testMcpConnection(existing ? {
					...existing,
					...testPayload
				} : testPayload);
				if (targetId && mcpStore.servers[targetId] && testResult.ok) {
					const s = mcpStore.servers[targetId];
					if (testResult.tools) s.tools = testResult.tools;
					if (testResult.toolDetails) s.toolDetails = testResult.toolDetails;
					if (testResult.detectedTransport) s.detectedTransport = testResult.detectedTransport;
					if (testResult.serverInfo) s.serverInfo = testResult.serverInfo;
					s.lastTestedAt = Date.now();
					saveMcpStore(mcpStore);
					setMcpStore(mcpStore);
					mcpManager?.syncServer(s);
				}
				sendJson(res, 200, testResult);
			} catch (err) {
				sendJson(res, 400, {
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	});
	const unregisterImportRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.mcpServersImport,
		handler: async (req, res) => {
			if (req.method !== "POST") {
				sendMethodNotAllowed(res);
				return;
			}
			try {
				const bodyStr = await readRequestBody(req);
				const parsed = JSON.parse(bodyStr || "{}");
				const rootObj = parsed.data || parsed;
				const serversMap = rootObj.mcpServers || rootObj;
				if (!serversMap || typeof serversMap !== "object" || Array.isArray(serversMap)) {
					sendJson(res, 400, {
						ok: false,
						message: "Invalid JSON format: expected mcpServers object mapping"
					});
					return;
				}
				const mcpStore = getMcpStore();
				let count = 0;
				for (const [key, rawVal] of Object.entries(serversMap)) {
					if (!rawVal || typeof rawVal !== "object") continue;
					const raw = rawVal;
					const id = (typeof raw.id === "string" ? raw.id : key).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
					if (!id) continue;
					const name = (typeof raw.name === "string" ? raw.name : key).trim() || id;
					const transport = raw.transport === "stdio" ? "stdio" : raw.transport === "streamable-http" || raw.transport === "streamable-http-or-sse" || raw.transport === "sse" ? "streamable-http" : raw.url ? "streamable-http" : "stdio";
					const existing = mcpStore.servers[id];
					const now = Date.now();
					const serverConfig = {
						id,
						name,
						description: typeof raw.description === "string" ? raw.description.trim() : existing?.description,
						transport,
						command: typeof raw.command === "string" ? raw.command.trim() : existing?.command,
						args: Array.isArray(raw.args) ? raw.args.filter((a) => typeof a === "string") : existing?.args || [],
						env: raw.env && typeof raw.env === "object" ? raw.env : existing?.env,
						cwd: typeof raw.cwd === "string" ? raw.cwd.trim() : existing?.cwd,
						url: typeof raw.url === "string" ? raw.url.trim() : existing?.url,
						headers: raw.headers && typeof raw.headers === "object" ? raw.headers : existing?.headers,
						enabledByDefault: typeof raw.enabledByDefault === "boolean" ? raw.enabledByDefault : existing?.enabledByDefault ?? true,
						toolCallTimeoutMs: typeof raw.toolCallTimeoutMs === "number" ? raw.toolCallTimeoutMs : existing?.toolCallTimeoutMs,
						failOnStartupError: typeof raw.failOnStartupError === "boolean" ? raw.failOnStartupError : existing?.failOnStartupError,
						reconnect: raw.reconnect && typeof raw.reconnect === "object" ? raw.reconnect : existing?.reconnect,
						disabledTools: Array.isArray(raw.disabledTools) ? raw.disabledTools : existing?.disabledTools,
						tools: existing?.tools,
						toolDetails: existing?.toolDetails,
						detectedTransport: existing?.detectedTransport,
						serverInfo: existing?.serverInfo,
						lastTestedAt: existing?.lastTestedAt,
						createdAt: existing?.createdAt ?? now,
						updatedAt: now
					};
					mcpStore.servers[id] = serverConfig;
					count++;
				}
				saveMcpStore(mcpStore);
				setMcpStore(mcpStore);
				mcpManager?.syncAll();
				const sanitizedServers = getSanitizedServers(mcpStore);
				sendJson(res, 200, {
					ok: true,
					count,
					servers: sanitizedServers
				});
			} catch (err) {
				sendJson(res, 400, {
					ok: false,
					message: err instanceof Error ? err.message : String(err)
				});
			}
		}
	});
	return () => {
		unregisterListRoute();
		unregisterAddRoute();
		unregisterEditRoute();
		unregisterRmRoute();
		unregisterToolviewRoute();
		unregisterToolsRoute();
		unregisterTestRoute();
		unregisterImportRoute();
	};
}
//#endregion
//#region lib/types/server/session/resolution.js
/**
* Resolves the effective session ID from an Agent.
* If the agent belongs to a subagent session, returns the parent session ID so that
* the subagent inherits the root/parent session's configured overrides.
* Otherwise, returns the session ID or agent ID directly.
*/
function resolveAgentSessionId(agent, ctx) {
	if (!agent) return void 0;
	const session = agent.session;
	if (session?.header?.origin === "subagent" && session.header.parentSession) {
		let parentId = session.header.parentSession;
		if (ctx) try {
			const sessionsService = ctx.get("sessions");
			while (parentId) {
				const parentSession = sessionsService?.get?.(parentId);
				if (parentSession?.header?.origin === "subagent" && parentSession.header.parentSession) parentId = parentSession.header.parentSession;
				else break;
			}
		} catch {}
		return parentId;
	}
	return session?.id ?? agent.id;
}
/**
* Resolves the working directory (cwd) for a given session ID,
* checking live sessions first, then inspecting persistent session storage.
*/
async function resolveSessionCwd(ctx, sessionId) {
	if (!sessionId) return void 0;
	try {
		const liveSession = ctx.get("sessions")?.get?.(sessionId);
		if (liveSession?.header?.cwd) return liveSession.header.cwd;
		const persistence = ctx.get("sessionPersistence");
		if (persistence && typeof persistence.stat === "function") {
			const stated = await persistence.stat(sessionId);
			if (stated?.header?.cwd) return stated.header.cwd;
		}
	} catch {}
}
/**
* Resolves the workspace ID associated with a given session ID.
*/
async function resolveWorkspaceForSession(ctx, sessionId) {
	if (!sessionId) return void 0;
	try {
		const workspaceRegistry = ctx.get("workspaceRegistry");
		if (workspaceRegistry && typeof workspaceRegistry.list === "function") {
			const matched = workspaceRegistry.list().find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(sessionId));
			if (matched?.id) return matched.id;
		}
		const rawCwd = await resolveSessionCwd(ctx, sessionId);
		if (rawCwd && workspaceRegistry && typeof workspaceRegistry.resolveByPath === "function") {
			const matchedWorkspace = await workspaceRegistry.resolveByPath(rawCwd);
			if (matchedWorkspace?.id) return matchedWorkspace.id;
		}
	} catch {}
}
//#endregion
//#region lib/types/server/skills/discovery.js
function classifySkillSource(skill) {
	if (!skill) return {
		isRuntime: false,
		source: "user-dsh"
	};
	const metaType = typeof skill.metadata?.type === "string" ? skill.metadata.type.toLowerCase() : typeof skill.metadata?.scope === "string" ? skill.metadata.scope.toLowerCase() : void 0;
	if (metaType === "user" || metaType === "user-dsh" || metaType === "user-agents") return {
		isRuntime: false,
		source: "user-dsh"
	};
	if (metaType === "project" || metaType === "project-dsh" || metaType === "project-agents") return {
		isRuntime: false,
		source: "project-dsh"
	};
	if (metaType === "preset" || metaType === "runtime" || metaType === "bundled") return {
		isRuntime: true,
		source: "runtime"
	};
	const src = (skill.source || "").toLowerCase();
	switch (src) {
		case "user-dsh":
		case "user-agents": return {
			isRuntime: false,
			source: src
		};
		case "project-dsh":
		case "project-agents": return {
			isRuntime: false,
			source: src
		};
		case "custom":
		case "custom-preset":
		case "bundled-preset":
		case "preset":
		case "runtime":
		case "bundled": return {
			isRuntime: true,
			source: src
		};
		default:
			if (src.includes("user")) return {
				isRuntime: false,
				source: "user-dsh"
			};
			if (src.includes("project")) return {
				isRuntime: false,
				source: "project-dsh"
			};
			return {
				isRuntime: true,
				source: src || "runtime"
			};
	}
}
function compareSkills(a, b) {
	const aRuntime = Boolean(a.isRuntime);
	if (aRuntime !== Boolean(b.isRuntime)) return aRuntime ? 1 : -1;
	return a.name.localeCompare(b.name);
}
function resolveSessionPreset(session) {
	if (!session) return void 0;
	if (typeof session.snapshotEvents === "function") {
		const events = session.snapshotEvents();
		for (let index = events.length - 1; index >= 0; index -= 1) {
			const event = events[index];
			if (event?.type === "agent-preset/selected") return event.data?.agentPreset;
		}
	}
	return session.header?.agentPreset;
}
async function resolveScopes(ctx, sessionId) {
	const sessionsService = ctx.get("sessions");
	const agentsService = ctx.get("agents");
	const presets = ctx.get("agentPresets");
	if (sessionId) {
		const session = sessionsService?.get?.(sessionId);
		const liveAgent = agentsService?.get?.(sessionId);
		if (liveAgent) return [liveAgent];
		if (presets && typeof presets.standingKeyFor === "function") try {
			let presetId = resolveSessionPreset(session);
			if (!presetId) {
				const persistence = ctx.get("sessionPersistence");
				if (persistence && typeof persistence.stat === "function") try {
					presetId = (await persistence.stat(sessionId))?.header?.agentPreset;
				} catch {}
			}
			const standingKey = await presets.standingKeyFor(presetId);
			if (standingKey) return [standingKey];
		} catch {}
		return [void 0];
	}
	if (presets && typeof presets.standingKeyFor === "function") try {
		const defaultKey = await presets.standingKeyFor();
		if (defaultKey) return [defaultKey];
	} catch {}
	return [void 0];
}
function resolveSkillRegistryService(ctx, scope) {
	const presets = ctx.get("agentPresets");
	if (scope && typeof scope === "object" && "ctx" in scope && presets && typeof presets.serviceFor === "function") try {
		const service = presets.serviceFor(scope, "skills");
		if (service) return service;
	} catch {}
	return ctx.get("skills");
}
async function getAvailableSkills(ctx, sessionId) {
	const map = /* @__PURE__ */ new Map();
	const targetCwd = await resolveSessionCwd(ctx, sessionId);
	const scopes = await resolveScopes(ctx, sessionId);
	for (const scope of scopes) {
		const skillsService = resolveSkillRegistryService(ctx, scope);
		if (skillsService && typeof skillsService.list === "function") try {
			const list = await skillsService.list({
				cwd: targetCwd,
				scope
			});
			if (Array.isArray(list)) {
				for (const s of list) if (!map.has(s.name)) {
					const { isRuntime, source } = classifySkillSource(s);
					map.set(s.name, {
						name: s.name,
						description: s.description || "",
						whenToUse: s.whenToUse,
						provider: s.provider || "skills-registry",
						source,
						modelInvocable: s.invocation?.modelInvocable ?? true,
						userInvocable: s.invocation?.userInvocable ?? true,
						isRuntime
					});
				}
			}
		} catch {}
	}
	return Array.from(map.values()).sort(compareSkills);
}
async function getSkillDetail(ctx, name, sessionId) {
	const targetCwd = await resolveSessionCwd(ctx, sessionId);
	const scopes = await resolveScopes(ctx, sessionId);
	for (const scope of scopes) {
		const skillsService = resolveSkillRegistryService(ctx, scope);
		if (skillsService && typeof skillsService.get === "function") try {
			const s = await skillsService.get(name, {
				cwd: targetCwd,
				scope
			});
			if (s) {
				const { isRuntime, source } = classifySkillSource(s);
				const resolvedPath = s.path || (s.resourceBase?.kind === "directory" ? s.resourceBase.path : void 0);
				return {
					name: s.name,
					description: s.description || "",
					whenToUse: s.whenToUse,
					provider: s.provider || "skills-registry",
					source,
					path: resolvedPath,
					content: s.content,
					modelInvocable: s.invocation?.modelInvocable ?? true,
					userInvocable: s.invocation?.userInvocable ?? true,
					isRuntime
				};
			}
		} catch {}
	}
	return null;
}
//#endregion
//#region lib/types/server/session/routes.js
function registerSessionSettingsRoutes(ctx, webServer, getSessionSettingsStore, setSessionSettingsStore, mcpManager) {
	const unregisterGetSettingsRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.getSettings,
		handler: async (req, res) => {
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			if (req.method !== "GET") {
				res.writeHead(405);
				res.end(JSON.stringify({
					ok: false,
					error: "Method Not Allowed"
				}));
				return;
			}
			const querySessionId = new URL(req.url ?? "/", "http://localhost").searchParams.get("sessionId") || void 0;
			const queryWorkspaceId = await resolveWorkspaceForSession(ctx, querySessionId);
			try {
				const sessionSettingsStore = getSessionSettingsStore();
				const sessionEntry = querySessionId ? sessionSettingsStore.sessions[querySessionId] : void 0;
				const workspaceEntry = queryWorkspaceId ? sessionSettingsStore.workspaces?.[queryWorkspaceId] : void 0;
				const rawConfig = sessionEntry || {
					subagentModel: { mode: "workspace" },
					mcp: { mode: "workspace" },
					skills: { mode: "workspace" }
				};
				res.writeHead(200);
				res.end(JSON.stringify({
					ok: true,
					sessionId: querySessionId,
					workspaceId: queryWorkspaceId,
					sessionConfig: rawConfig,
					workspaceConfig: workspaceEntry || {
						subagentModel: { mode: "global" },
						mcp: { mode: "global" },
						skills: { mode: "global" }
					},
					globalConfig: sessionSettingsStore.globalConfig
				}));
			} catch (err) {
				res.writeHead(500);
				res.end(JSON.stringify({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}));
			}
		}
	});
	const unregisterSaveSettingsRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.saveSettings,
		handler: async (req, res) => {
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			if (req.method !== "POST") {
				res.writeHead(405);
				res.end(JSON.stringify({
					ok: false,
					error: "Method Not Allowed"
				}));
				return;
			}
			try {
				const bodyStr = await readRequestBody(req);
				const parsed = JSON.parse(bodyStr || "{}");
				const targetSessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : void 0;
				const targetWorkspaceId = await resolveWorkspaceForSession(ctx, targetSessionId);
				const isSaveWorkspaceDefault = Boolean(parsed.isWorkspaceDefault && targetWorkspaceId);
				const isSaveDefault = !isSaveWorkspaceDefault && Boolean(parsed.isDefault || !targetSessionId || parsed.saveAsDefault);
				const sessionSettingsStore = getSessionSettingsStore();
				const incomingConfig = normalizeSessionSettings(parsed.config ?? parsed);
				if (incomingConfig.subagentModel.mode === "custom" && !incomingConfig.subagentModel.inherit && (!incomingConfig.subagentModel.model?.provider || !incomingConfig.subagentModel.model?.model)) {
					res.writeHead(400);
					res.end(JSON.stringify({
						ok: false,
						error: "Subagent model custom mode requires provider and model"
					}));
					return;
				}
				if (!sessionSettingsStore.workspaces) sessionSettingsStore.workspaces = {};
				if (isSaveDefault) {
					if (parsed.isRestoringDefault) sessionSettingsStore.globalConfig = {
						subagentModel: {
							inherit: true,
							allowAgentSelectModel: true,
							overrideForkModel: false
						},
						mcp: { enabledServerIds: [] },
						skills: {
							disabledModelSkills: [],
							disabledUserSkills: []
						}
					};
					else {
						const incomingGlobal = normalizeGlobalSettings(parsed.globalConfig ?? parsed.config ?? parsed);
						try {
							const allSkills = await getAvailableSkills(ctx, void 0);
							const runtimeSkillNames = new Set(allSkills.filter((s) => s.isRuntime).map((s) => s.name));
							if (incomingGlobal.skills?.disabledModelSkills) incomingGlobal.skills.disabledModelSkills = incomingGlobal.skills.disabledModelSkills.filter((name) => !runtimeSkillNames.has(name));
							if (incomingGlobal.skills?.disabledUserSkills) incomingGlobal.skills.disabledUserSkills = incomingGlobal.skills.disabledUserSkills.filter((name) => !runtimeSkillNames.has(name));
						} catch {}
						sessionSettingsStore.globalConfig = incomingGlobal;
					}
				} else if (isSaveWorkspaceDefault && targetWorkspaceId) {
					if (parsed.isRestoringDefault) delete sessionSettingsStore.workspaces[targetWorkspaceId];
					else {
						try {
							const allSkills = await getAvailableSkills(ctx, void 0);
							const runtimeSkillNames = new Set(allSkills.filter((s) => s.isRuntime).map((s) => s.name));
							if (incomingConfig.skills?.disabledModelSkills) incomingConfig.skills.disabledModelSkills = incomingConfig.skills.disabledModelSkills.filter((name) => !runtimeSkillNames.has(name));
							if (incomingConfig.skills?.disabledUserSkills) incomingConfig.skills.disabledUserSkills = incomingConfig.skills.disabledUserSkills.filter((name) => !runtimeSkillNames.has(name));
						} catch {}
						sessionSettingsStore.workspaces[targetWorkspaceId] = incomingConfig;
					}
				}
				if (targetSessionId && !isSaveWorkspaceDefault) {
					if (isSaveDefault) delete sessionSettingsStore.sessions[targetSessionId];
					else if (incomingConfig.subagentModel.mode === "workspace" && incomingConfig.subagentModel.allowAgentSelectModel === void 0 && incomingConfig.subagentModel.overrideForkModel === void 0 && incomingConfig.mcp.mode === "workspace" && incomingConfig.skills.mode === "workspace") delete sessionSettingsStore.sessions[targetSessionId];
					else sessionSettingsStore.sessions[targetSessionId] = incomingConfig;
				}
				saveSessionSettingsStore(sessionSettingsStore);
				setSessionSettingsStore(sessionSettingsStore);
				mcpManager?.syncAll();
				ctx.emit("skills/change");
				const sessionEntry = targetSessionId && sessionSettingsStore.sessions[targetSessionId];
				const workspaceEntry = targetWorkspaceId && sessionSettingsStore.workspaces?.[targetWorkspaceId];
				res.writeHead(200);
				res.end(JSON.stringify({
					ok: true,
					sessionId: targetSessionId,
					workspaceId: targetWorkspaceId,
					sessionConfig: sessionEntry || incomingConfig,
					workspaceConfig: workspaceEntry || {
						subagentModel: { mode: "global" },
						mcp: { mode: "global" },
						skills: { mode: "global" }
					},
					globalConfig: sessionSettingsStore.globalConfig
				}));
			} catch (err) {
				res.writeHead(400);
				res.end(JSON.stringify({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}));
			}
		}
	});
	const unregisterDeleteSettingsRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.deleteSettings,
		handler: async (req, res) => {
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			if (req.method !== "POST") {
				res.writeHead(405);
				res.end(JSON.stringify({
					ok: false,
					error: "Method Not Allowed"
				}));
				return;
			}
			try {
				let targetSessionId = new URL(req.url ?? "/", "http://localhost").searchParams.get("sessionId")?.trim() || void 0;
				if (!targetSessionId) {
					const bodyStr = await readRequestBody(req);
					targetSessionId = (bodyStr ? JSON.parse(bodyStr) : {}).sessionId?.trim() || void 0;
				}
				if (!targetSessionId) {
					res.writeHead(400);
					res.end(JSON.stringify({
						ok: false,
						error: "Session ID is required"
					}));
					return;
				}
				const sessionSettingsStore = getSessionSettingsStore();
				const targetWorkspaceId = await resolveWorkspaceForSession(ctx, targetSessionId);
				if (targetSessionId && sessionSettingsStore.sessions[targetSessionId]) {
					delete sessionSettingsStore.sessions[targetSessionId];
					saveSessionSettingsStore(sessionSettingsStore);
					setSessionSettingsStore(sessionSettingsStore);
					mcpManager?.syncAll();
					ctx.emit("skills/change");
				}
				res.writeHead(200);
				res.end(JSON.stringify({
					ok: true,
					sessionId: targetSessionId,
					workspaceId: targetWorkspaceId,
					sessionConfig: {
						subagentModel: { mode: "workspace" },
						mcp: { mode: "workspace" },
						skills: { mode: "workspace" }
					},
					workspaceConfig: targetWorkspaceId && sessionSettingsStore.workspaces?.[targetWorkspaceId] ? sessionSettingsStore.workspaces[targetWorkspaceId] : {
						subagentModel: { mode: "global" },
						mcp: { mode: "global" },
						skills: { mode: "global" }
					},
					globalConfig: sessionSettingsStore.globalConfig
				}));
			} catch (err) {
				res.writeHead(500);
				res.end(JSON.stringify({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}));
			}
		}
	});
	return () => {
		unregisterGetSettingsRoute();
		unregisterSaveSettingsRoute();
		unregisterDeleteSettingsRoute();
	};
}
//#endregion
//#region lib/types/server/skills/routes.js
function registerSkillsRoutes(ctx, webServer) {
	const unregisterSkillsListRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.skills,
		handler: async (req, res) => {
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			if (req.method !== "GET") {
				res.writeHead(405);
				res.end(JSON.stringify({
					ok: false,
					error: "Method Not Allowed"
				}));
				return;
			}
			const reqSessionId = (new URL(req.url ?? "/", "http://localhost").searchParams.get("sessionId") || "").trim() || void 0;
			try {
				const skills = await getAvailableSkills(ctx, reqSessionId);
				res.writeHead(200);
				res.end(JSON.stringify({
					ok: true,
					skills
				}));
			} catch (err) {
				res.writeHead(500);
				res.end(JSON.stringify({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}));
			}
		}
	});
	const unregisterSkillContentRoute = webServer.register({
		kind: "exact",
		path: API_ENDPOINTS.skillsContent,
		handler: async (req, res) => {
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			if (req.method !== "GET") {
				res.writeHead(405);
				res.end(JSON.stringify({
					ok: false,
					error: "Method Not Allowed"
				}));
				return;
			}
			const url = new URL(req.url ?? "/", "http://localhost");
			const skillName = (url.searchParams.get("name") || "").trim();
			const reqSessionId = (url.searchParams.get("sessionId") || "").trim() || void 0;
			if (!skillName) {
				res.writeHead(400);
				res.end(JSON.stringify({
					ok: false,
					error: "Skill name is required"
				}));
				return;
			}
			try {
				const skill = await getSkillDetail(ctx, skillName, reqSessionId);
				if (!skill) {
					res.writeHead(404);
					res.end(JSON.stringify({
						ok: false,
						error: `Skill "${skillName}" not found`
					}));
					return;
				}
				res.writeHead(200);
				res.end(JSON.stringify({
					ok: true,
					skill
				}));
			} catch (err) {
				res.writeHead(500);
				res.end(JSON.stringify({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}));
			}
		}
	});
	return () => {
		unregisterSkillsListRoute();
		unregisterSkillContentRoute();
	};
}
//#endregion
//#region lib/types/server/subagent-model/interceptor.js
/**
* Set of child session IDs where the calling Agent explicitly provided provider/model
* in the delegation tool call (subagent / subagent_fork).
*/
const explicitModelSubagents = /* @__PURE__ */ new Set();
/**
* Checks whether the child agent was spawned by the "fork" provider.
*/
function isForkSubagent(session) {
	if (!session) return false;
	if (session.header?.origin === "subagent" && session.header?.isSeeded === true) return true;
	if (typeof session.snapshotEvents === "function") {
		const events = session.snapshotEvents();
		for (let i = events.length - 1; i >= 0; i--) {
			const ev = events[i];
			if (ev?.type === "subagent/descriptor") return ev.data?.provider === "fork";
		}
	}
	return false;
}
/**
* Checks whether the Agent explicitly selected a custom provider/model
* for this child subagent run.
*/
function hasAgentSelectedModel(session, ctx) {
	if (!session?.header?.id) return false;
	if (explicitModelSubagents.has(session.header.id)) return true;
	if (ctx && session.header?.parentSession) try {
		const parentSession = ctx.get("sessions")?.get?.(session.header.parentSession);
		if (parentSession && typeof parentSession.snapshotEvents === "function") {
			const events = parentSession.snapshotEvents();
			let matchedCallId;
			for (let i = events.length - 1; i >= 0; i--) {
				const ev = events[i];
				if (ev?.type === "tool/result") {
					if ((ev.data?.message?.content?.[0]?.value)?.subagentId === session.header.id) {
						matchedCallId = ev.data?.message?.source?.callId;
						break;
					}
				}
			}
			if (matchedCallId) for (let i = events.length - 1; i >= 0; i--) {
				const ev = events[i];
				if (ev?.type === "assistant/message" && Array.isArray(ev.data?.message?.content)) {
					for (const block of ev.data.message.content) if (block?.type === "tool-call" && block.id === matchedCallId) {
						const args = block.args;
						if (args?.provider && args?.model) {
							explicitModelSubagents.add(session.header.id);
							return true;
						}
					}
				}
			}
		}
	} catch {}
	return false;
}
function registerSubagentModelInterceptor(ctx, getSessionSettingsStore) {
	ctx.on("tools/result", (exec, result) => {
		if (exec?.name === "subagent" || exec?.name?.startsWith("subagent_")) {
			const args = exec?.args;
			const hasExplicitModel = Boolean(args?.provider && args?.model);
			const subagentId = result?.value?.subagentId ?? result?.value?.childId ?? result?.content?.[0]?.value?.subagentId;
			if (subagentId && hasExplicitModel) explicitModelSubagents.add(subagentId);
		}
	});
	ctx.inject(["tools"], (toolsCtx) => {
		if (typeof toolsCtx?.tools?.guard === "function") toolsCtx.tools.guard((exec) => {
			if (exec?.name === "list_subagent_models") {
				const agent = exec.agent;
				const session = agent?.session;
				if (session) {
					const sessionId = session.header?.origin === "subagent" ? resolveAgentSessionId(agent, ctx) ?? session.header?.parentSession : session.header?.id;
					if (resolveEffectiveSubagentModel(getSessionSettingsStore(), sessionId).allowAgentSelectModel === false) return "list_subagent_models is disabled by user settings for this session";
				}
			}
		});
	});
	ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
		const transformed = await next();
		const agent = context?.agent;
		const session = agent?.session;
		if (!session) return transformed;
		const isSubagent = session.header?.origin === "subagent";
		const sessionId = isSubagent ? resolveAgentSessionId(agent, ctx) ?? session.header?.parentSession : session.header?.id;
		const workspaceId = await resolveWorkspaceForSession(ctx, sessionId);
		const effectiveCfg = resolveEffectiveSubagentModel(getSessionSettingsStore(), sessionId, workspaceId);
		if (effectiveCfg.allowAgentSelectModel === false && Array.isArray(transformed.tools)) transformed.tools = transformed.tools.filter((t) => t.name !== "list_subagent_models").map((tool) => {
			if (tool.name === "subagent" || tool.name.startsWith("subagent_")) {
				if (tool.parameters && typeof tool.parameters === "object") {
					const rawProps = tool.parameters.properties;
					if (rawProps && typeof rawProps === "object") {
						const newProps = { ...rawProps };
						delete newProps.model;
						delete newProps.provider;
						delete newProps.reasoning_effort;
						const rawReq = tool.parameters.required;
						const newReq = Array.isArray(rawReq) ? rawReq.filter((r) => r !== "model" && r !== "provider" && r !== "reasoning_effort") : rawReq;
						const updatedParams = {
							...tool.parameters,
							properties: newProps
						};
						if (newReq) updatedParams.required = newReq;
						let updatedDescription = tool.description;
						if (typeof updatedDescription === "string" && updatedDescription.includes("Child LLM selection is optional.")) updatedDescription = updatedDescription.replace(/Child LLM selection is optional\..*?default effort\./g, "").trim();
						return {
							...tool,
							parameters: updatedParams,
							...updatedDescription !== void 0 ? { description: updatedDescription } : {}
						};
					}
				}
			}
			return tool;
		});
		if (isSubagent) {
			if (isForkSubagent(session) && effectiveCfg.overrideForkModel !== true) return transformed;
			const hasCustomModel = !effectiveCfg.inherit && Boolean(effectiveCfg.model?.provider && effectiveCfg.model?.model);
			if ((effectiveCfg.allowAgentSelectModel === false ? hasCustomModel : hasCustomModel && !hasAgentSelectedModel(session, ctx)) && effectiveCfg.model) {
				if (agent?.options) {
					agent.options.provider = effectiveCfg.model.provider;
					agent.options.model = effectiveCfg.model.model;
				}
				return {
					...transformed,
					variables: {
						...transformed.variables,
						provider: effectiveCfg.model.provider,
						model: effectiveCfg.model.model
					}
				};
			}
		}
		return transformed;
	});
	ctx.on("agent/request", async (payload, next) => {
		const proposal = await next();
		const session = payload?.agent?.session;
		if (!session?.header || session.header.origin !== "subagent") return proposal;
		const parentId = resolveAgentSessionId(payload?.agent, ctx) ?? session.header.parentSession;
		const workspaceId = await resolveWorkspaceForSession(ctx, parentId);
		const effectiveCfg = resolveEffectiveSubagentModel(getSessionSettingsStore(), parentId, workspaceId);
		if (isForkSubagent(session) && effectiveCfg.overrideForkModel !== true) return proposal;
		const hasCustomModel = !effectiveCfg.inherit && Boolean(effectiveCfg.model?.provider && effectiveCfg.model?.model);
		if (effectiveCfg.allowAgentSelectModel === false) {
			if (!hasCustomModel || !effectiveCfg.model) return proposal;
			if (payload.agent?.options) {
				payload.agent.options.provider = effectiveCfg.model.provider;
				payload.agent.options.model = effectiveCfg.model.model;
				if (effectiveCfg.model.reasoningEffort) payload.agent.options.reasoningEffort = effectiveCfg.model.reasoningEffort;
			}
			return {
				...proposal,
				provider: effectiveCfg.model.provider,
				model: effectiveCfg.model.model,
				...effectiveCfg.model.reasoningEffort ? { reasoningEffort: effectiveCfg.model.reasoningEffort } : {}
			};
		}
		if (hasAgentSelectedModel(session, ctx)) return proposal;
		if (hasCustomModel && effectiveCfg.model) {
			if (payload.agent?.options) {
				payload.agent.options.provider = effectiveCfg.model.provider;
				payload.agent.options.model = effectiveCfg.model.model;
				if (effectiveCfg.model.reasoningEffort) payload.agent.options.reasoningEffort = effectiveCfg.model.reasoningEffort;
			}
			return {
				...proposal,
				provider: effectiveCfg.model.provider,
				model: effectiveCfg.model.model,
				...effectiveCfg.model.reasoningEffort ? { reasoningEffort: effectiveCfg.model.reasoningEffort } : {}
			};
		}
		return proposal;
	});
}
//#endregion
//#region lib/types/server/mcp/interceptor.js
function registerMcpInterceptors(ctx, getSessionSettingsStore, getMcpStore, mcpManager) {
	ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
		const sessionId = resolveAgentSessionId(context?.agent);
		const workspaceId = await resolveWorkspaceForSession(ctx, sessionId);
		const sessionSettingsStore = getSessionSettingsStore();
		const mcpStore = getMcpStore();
		const effectiveMcp = resolveEffectiveMcp(sessionSettingsStore, mcpStore, sessionId, workspaceId);
		const enabledServerIds = new Set(effectiveMcp.enabledServerIds);
		if (effectiveMcp.enabledServerIds.length > 0) await mcpManager?.ensureServersMounted(effectiveMcp.enabledServerIds);
		const transformed = await next();
		if (!transformed || !Array.isArray(transformed.tools) || transformed.tools.length === 0) return transformed;
		const allServers = Object.values(mcpStore.servers);
		const disabledPublicNamesByServer = /* @__PURE__ */ new Map();
		for (const server of allServers) {
			const disabledList = effectiveMcp.effectiveDisabledTools[server.id] ?? [];
			if (disabledList.length > 0) {
				const disabledSet = /* @__PURE__ */ new Set();
				for (const rawName of disabledList) {
					disabledSet.add(publicToolName(server.id, rawName));
					disabledSet.add(`mcp__${server.id}__${rawName}`);
				}
				disabledPublicNamesByServer.set(server.id, disabledSet);
			}
		}
		const filteredTools = transformed.tools.filter((tool) => {
			if (!tool || typeof tool.name !== "string") return true;
			const meta = mcpManager?.getToolMeta(tool.name);
			if (meta) {
				if (!enabledServerIds.has(meta.serverId)) return false;
				if ((effectiveMcp.effectiveDisabledTools[meta.serverId] ?? []).includes(meta.rawName)) return false;
				return true;
			}
			if (tool.name.startsWith("mcp__")) for (const server of allServers) {
				const prefix = `mcp__${server.id}__`;
				if (tool.name.startsWith(prefix)) {
					if (!enabledServerIds.has(server.id)) return false;
					const disabledSet = disabledPublicNamesByServer.get(server.id);
					if (disabledSet && disabledSet.has(tool.name)) return false;
				}
			}
			return true;
		});
		return {
			...transformed,
			tools: filteredTools
		};
	});
	ctx.on("tools/pre-execute", async (exec, next) => {
		const toolName = exec?.name;
		if (typeof toolName === "string" && (toolName.startsWith("mcp__") || mcpManager?.isMcpTool(toolName))) {
			const sessionId = resolveAgentSessionId(exec?.agent);
			const workspaceId = await resolveWorkspaceForSession(ctx, sessionId);
			const sessionSettingsStore = getSessionSettingsStore();
			const mcpStore = getMcpStore();
			const effectiveMcp = resolveEffectiveMcp(sessionSettingsStore, mcpStore, sessionId, workspaceId);
			const enabledServerIds = new Set(effectiveMcp.enabledServerIds);
			const meta = mcpManager?.getToolMeta(toolName);
			if (meta) {
				if (!enabledServerIds.has(meta.serverId)) return {
					kind: "deny",
					reason: `unknown tool "${toolName}"`
				};
				if ((effectiveMcp.effectiveDisabledTools[meta.serverId] ?? []).includes(meta.rawName)) return {
					kind: "deny",
					reason: `unknown tool "${toolName}"`
				};
				await mcpManager?.ensureServersMounted([meta.serverId]);
				return next();
			}
			for (const server of Object.values(mcpStore.servers)) {
				const prefix = `mcp__${server.id}__`;
				if (toolName.startsWith(prefix)) {
					if (!enabledServerIds.has(server.id)) return {
						kind: "deny",
						reason: `unknown tool "${toolName}"`
					};
					const disabledList = effectiveMcp.effectiveDisabledTools[server.id] ?? [];
					if (disabledList.length > 0) {
						if (new Set(disabledList.flatMap((raw) => [publicToolName(server.id, raw), `mcp__${server.id}__${raw}`])).has(toolName)) return {
							kind: "deny",
							reason: `unknown tool "${toolName}"`
						};
					}
				}
			}
		}
		return next();
	});
}
//#endregion
//#region lib/types/server/skills/interceptor.js
function registerSkillsInterceptors(ctx, getSessionSettingsStore) {
	let cleanupDecorate = null;
	const decorateSkillRegistry = () => {
		const skillsService = ctx.get("skills");
		if (skillsService && !skillsService.__sessionSettingsDecorated) {
			skillsService.__sessionSettingsDecorated = true;
			const origSnapshot = skillsService.snapshot.bind(skillsService);
			skillsService.snapshot = async function(options = {}) {
				const snapshot = await origSnapshot(options);
				if (!snapshot || !Array.isArray(snapshot.skills)) return snapshot;
				const sessionId = resolveAgentSessionId(options?.scope);
				const workspaceId = await resolveWorkspaceForSession(ctx, sessionId);
				const effectiveSkills = resolveEffectiveSkills(getSessionSettingsStore(), sessionId, workspaceId);
				const disabledModelSet = new Set(effectiveSkills.effectiveDisabledModelSkills || []);
				const disabledUserSet = new Set(effectiveSkills.effectiveDisabledUserSkills || []);
				if (disabledModelSet.size === 0 && disabledUserSet.size === 0) return snapshot;
				return {
					...snapshot,
					skills: snapshot.skills.map((skill) => {
						const isModelDis = disabledModelSet.has(skill.name);
						const isUserDis = disabledUserSet.has(skill.name);
						if (!isModelDis && !isUserDis) return skill;
						return {
							...skill,
							invocation: {
								modelInvocable: isModelDis ? false : skill.invocation?.modelInvocable ?? true,
								userInvocable: isUserDis ? false : skill.invocation?.userInvocable ?? true
							}
						};
					})
				};
			};
			const origGet = skillsService.get.bind(skillsService);
			skillsService.get = async function(name, options = {}) {
				const definition = await origGet(name, options);
				if (!definition) return definition;
				const sessionId = resolveAgentSessionId(options?.scope);
				const workspaceId = await resolveWorkspaceForSession(ctx, sessionId);
				const effectiveSkills = resolveEffectiveSkills(getSessionSettingsStore(), sessionId, workspaceId);
				const disabledModelSet = new Set(effectiveSkills.effectiveDisabledModelSkills || []);
				const disabledUserSet = new Set(effectiveSkills.effectiveDisabledUserSkills || []);
				if (disabledModelSet.has(definition.name) || disabledUserSet.has(definition.name)) return {
					...definition,
					invocation: {
						modelInvocable: disabledModelSet.has(definition.name) ? false : definition.invocation?.modelInvocable ?? true,
						userInvocable: disabledUserSet.has(definition.name) ? false : definition.invocation?.userInvocable ?? true
					}
				};
				return definition;
			};
			cleanupDecorate = () => {
				if (skillsService.__sessionSettingsDecorated) {
					skillsService.snapshot = origSnapshot;
					skillsService.get = origGet;
					delete skillsService.__sessionSettingsDecorated;
				}
			};
		}
	};
	ctx.effect(() => {
		decorateSkillRegistry();
		return () => {
			cleanupDecorate?.();
		};
	}, "session-settings: skill-registry decoration");
	ctx.on("skills/change", () => {
		decorateSkillRegistry();
	});
	ctx.on("tools/pre-execute", async (exec, next) => {
		const toolName = exec?.name;
		const args = exec?.arguments ?? exec.args;
		if (toolName === "skill" && args && typeof args.name === "string") {
			const targetSkillName = args.name.trim();
			const sessionId = resolveAgentSessionId(exec?.agent);
			const workspaceId = await resolveWorkspaceForSession(ctx, sessionId);
			if ((resolveEffectiveSkills(getSessionSettingsStore(), sessionId, workspaceId).effectiveDisabledModelSkills || []).includes(targetSkillName)) return {
				kind: "deny",
				reason: `skill "${targetSkillName}" is disabled for model invocation in this session`
			};
		}
		return next();
	});
}
//#endregion
//#region lib/types/server/index.js
const name = "session-settings";
const inject = ["webServer", "loader"];
function apply(ctx) {
	let mcpStore = null;
	let sessionSettingsStore = null;
	const getMcpStore = () => {
		if (!mcpStore) mcpStore = loadMcpStore();
		return mcpStore;
	};
	const setMcpStore = (s) => {
		mcpStore = s;
	};
	const getSessionSettingsStore = () => {
		if (!sessionSettingsStore) sessionSettingsStore = loadSessionSettingsStore();
		return sessionSettingsStore;
	};
	const setSessionSettingsStore = (s) => {
		sessionSettingsStore = s;
	};
	const mcpManager = new McpManager(ctx, getMcpStore, getSessionSettingsStore);
	const webServer = ctx.get("webServer");
	if (webServer) {
		const unregisterMcp = registerMcpRoutes(webServer, getMcpStore, setMcpStore, mcpManager, getSessionSettingsStore, setSessionSettingsStore);
		const unregisterSessionSettings = registerSessionSettingsRoutes(ctx, webServer, getSessionSettingsStore, setSessionSettingsStore, mcpManager);
		const unregisterSkills = registerSkillsRoutes(ctx, webServer);
		ctx.effect(() => {
			return () => {
				unregisterMcp();
				unregisterSessionSettings();
				unregisterSkills();
			};
		}, "session-settings: webServer routes");
	}
	ctx.effect(() => {
		return () => {
			mcpManager.dispose();
		};
	}, "session-settings: mcpManager");
	registerSubagentModelInterceptor(ctx, getSessionSettingsStore);
	registerMcpInterceptors(ctx, getSessionSettingsStore, getMcpStore, mcpManager);
	registerSkillsInterceptors(ctx, getSessionSettingsStore);
}
//#endregion
export { API_ENDPOINTS, McpManager, apply, getAvailableSkills, getMcpStoragePath, getSessionSettingsStoragePath, getSkillDetail, inject, loadMcpStore, loadSessionSettingsStore, name, normalizeGlobalSettings, normalizeSessionSettings, publicToolName, readRequestBody, registerMcpInterceptors, registerMcpRoutes, registerSessionSettingsRoutes, registerSkillsInterceptors, registerSkillsRoutes, registerSubagentModelInterceptor, renameServerIdInSessionStore, resolveEffectiveMcp, resolveEffectiveSkills, resolveEffectiveSubagentModel, saveMcpStore, saveSessionSettingsStore, testHttpConnection, testMcpConnection, testStdioConnection };
