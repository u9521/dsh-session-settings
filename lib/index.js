import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { Client, SSEClientTransport, StreamableHTTPClientTransport, UriTemplate } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
//#region lib/types/types.js
const API_BASE = "/api/session-settings";
const API_ENDPOINTS = {
	getSettings: `${API_BASE}/get-settings`,
	saveSettings: `${API_BASE}/save-settings`,
	mcpServersList: `${API_BASE}/mcp-servers/list`,
	mcpServersAdd: `${API_BASE}/mcp-servers/add`,
	mcpServersEdit: `${API_BASE}/mcp-servers/edit`,
	mcpServersRm: `${API_BASE}/mcp-servers/rm`,
	/**
	* The single discovery entry point: connect once and report every primitive
	* the server declares, optionally also rebuilding the official client.
	*/
	mcpServersProbe: `${API_BASE}/mcp-servers/probe`,
	/**
	* The single cache-preview entry point: read what a previous probe stored.
	* Never opens a connection.
	*/
	mcpServersCache: `${API_BASE}/mcp-servers/cache`,
	mcpServersImport: `${API_BASE}/mcp-servers/import`,
	mcpServersResourceRead: `${API_BASE}/mcp-servers/resource-read`,
	mcpServersPromptGet: `${API_BASE}/mcp-servers/prompt-get`,
	skills: `${API_BASE}/skills`,
	skillsContent: `${API_BASE}/skills/content`
};
/**
* The HTTP method each endpoint answers to.
*
* Typed as `Record<ApiEndpointKey, …>` so the method table cannot drift from the
* path table: adding an endpoint without a method (or naming one that does not
* exist) is a compile error. Both halves read this single source — the client to
* send, the server to declare its route methods.
*/
const API_METHODS = {
	getSettings: "GET",
	saveSettings: "POST",
	mcpServersList: "GET",
	mcpServersAdd: "POST",
	mcpServersEdit: "POST",
	mcpServersRm: "POST",
	mcpServersProbe: "POST",
	mcpServersCache: "GET",
	mcpServersImport: "POST",
	mcpServersResourceRead: "POST",
	mcpServersPromptGet: "POST",
	skills: "GET",
	skillsContent: "GET"
};
/** Write targets accepted by `API_ENDPOINTS.saveSettings`. */
const SETTINGS_SCOPE_IDS = [
	"session",
	"workspace",
	"global"
];
function isSettingsScopeId(value) {
	return typeof value === "string" && SETTINGS_SCOPE_IDS.includes(value);
}
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
	},
	sandbox: { allow: [] }
};
const DEFAULT_SESSION_SETTINGS = {
	subagentModel: { mode: "workspace" },
	mcp: { mode: "workspace" },
	skills: { mode: "workspace" },
	sandbox: { mode: "workspace" }
};
/** Longest description that survives normalization; keeps prompt text bounded. */
const MAX_ALLOW_DESCRIPTION_CHARS = 200;
/**
* Normalize one allow entry, or drop it.
*
* A path is the entire payload, so an entry without a usable one carries no
* meaning and is discarded rather than persisted as a grant that resolves to
* nothing. The description is optional and truncated: it is prompt text, and an
* unbounded value here would let a settings document inflate every request.
*/
function normalizeSandboxAllowEntry(raw) {
	if (!raw || typeof raw !== "object") return void 0;
	const entry = raw;
	const path = typeof entry.path === "string" ? entry.path.trim() : "";
	if (!path) return void 0;
	const description = typeof entry.description === "string" ? entry.description.trim() : "";
	return {
		path,
		...description ? { description: description.slice(0, MAX_ALLOW_DESCRIPTION_CHARS) } : {}
	};
}
function normalizeSandboxAllow(raw) {
	if (!Array.isArray(raw)) return [];
	const entries = [];
	for (const item of raw) {
		const entry = normalizeSandboxAllowEntry(item);
		if (entry) entries.push(entry);
	}
	return entries;
}
function normalizeSandboxConfig(raw) {
	if (!raw || typeof raw !== "object") return { mode: "workspace" };
	const mode = raw.mode === "custom" ? "custom" : raw.mode === "global" ? "global" : "workspace";
	if (mode === "custom") return {
		mode: "custom",
		allow: normalizeSandboxAllow(raw.allow)
	};
	return { mode };
}
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
		},
		sandbox: { allow: normalizeSandboxAllow(raw.sandbox?.allow) }
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
		skills: normalizeSkillsConfig(raw.skills),
		sandbox: normalizeSandboxConfig(raw.sandbox)
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
	const globalMcp = store.globalConfig?.mcp;
	const globalEnabledIds = Array.isArray(globalMcp?.enabledServerIds) ? globalMcp.enabledServerIds : [];
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
/**
* The effective extra-writable-directory list for one session.
*
* Scope resolution is deliberately identical to {@link resolveEffectiveMcp}:
* a session naming `custom` owns the answer outright, `workspace` defers to the
* workspace's own `custom` entry and otherwise falls through, and `global`
* takes the deployment list. Two panels offering the same three scopes must not
* disagree about which one wins, so the ladder lives here once rather than
* being re-derived per domain.
*
* The global list is the explicit `allow` array, never a per-entry flag, for the
* same reason MCP's global scope is its explicit id list: an absent field must
* read as "nothing granted", not as "granted by some other entry's default".
*
* @param store - the loaded settings store.
* @param sessionId - the root session whose overrides apply, when known.
* @param workspaceId - the session's workspace, when resolvable.
* @returns the winning `allow` list and the scope that produced it.
*/
function resolveEffectiveSandbox(store, sessionId, workspaceId) {
	const globalAllow = Array.isArray(store.globalConfig?.sandbox?.allow) ? store.globalConfig.sandbox.allow : [];
	let mode = "global";
	let allow = [];
	let resolved = false;
	if (sessionId && store.sessions?.[sessionId]?.sandbox) {
		const sSandbox = store.sessions[sessionId].sandbox;
		if (sSandbox.mode === "custom") {
			mode = "custom";
			allow = sSandbox.allow || [];
			resolved = true;
		} else if (sSandbox.mode === "workspace") {
			if (workspaceId && store.workspaces?.[workspaceId]?.sandbox?.mode === "custom") {
				const wsSandbox = store.workspaces[workspaceId].sandbox;
				mode = "custom";
				allow = wsSandbox.allow || [];
				resolved = true;
			}
		} else if (sSandbox.mode === "global") {
			mode = "global";
			allow = globalAllow;
			resolved = true;
		}
	}
	if (!resolved && workspaceId && store.workspaces?.[workspaceId]?.sandbox?.mode === "custom") {
		const wsSandbox = store.workspaces[workspaceId].sandbox;
		mode = "custom";
		allow = wsSandbox.allow || [];
		resolved = true;
	}
	if (!resolved) {
		mode = "global";
		allow = globalAllow;
	}
	return {
		mode,
		allow
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
const OFFICIAL_PLUGIN_MISSING = "Official @deepseek-ai/dsh-mcp-client plugin is not available in this Host.";
let cachedOfficialPlugin = null;
function delay(ms) {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		if (typeof timer.unref === "function") timer.unref();
	});
}
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
	/** Map of serverId -> last activation/mount error message (cleared on refresh/unmount) */
	lastErrors = /* @__PURE__ */ new Map();
	/** serverIds whose current mount lifecycle we attempted to mount */
	mountAttempted = /* @__PURE__ */ new Set();
	/**
	* serverId -> wall clock when the current mount attempt began.
	*
	* Runtime status is a TRANSIENT observation: a freshly started fork reports
	* zero tools until its handshake completes, which is indistinguishable from a
	* permanent failure without knowing how long it has been that way.
	*/
	mountStartedAt = /* @__PURE__ */ new Map();
	/**
	* serverId -> fingerprint of the config the live fork was mounted with.
	*
	* Lets `syncServer()` skip a teardown+remount when nothing that affects the
	* connection actually changed; a settings save used to rebuild every live
	* connection even when it touched no server config at all.
	*/
	mountedConfigKeys = /* @__PURE__ */ new Map();
	/** Map of serverId -> timestamp of the last manual client refresh */
	lastRefreshAt = /* @__PURE__ */ new Map();
	/** Active sync promises to prevent race conditions */
	activeSyncs = /* @__PURE__ */ new Map();
	constructor(ctx, getMcpStore, getSessionSettingsStore) {
		this.ctx = ctx;
		this.getMcpStore = getMcpStore;
		this.getSessionSettingsStore = getSessionSettingsStore;
	}
	/**
	* Check if an MCP server is currently needed.
	*
	* "Needed" means some scope's explicit `enabledServerIds` names it. There is
	* deliberately no per-server default flag: such a flag could only ever drive
	* mounting, since visibility is resolved from the scope lists, and a server
	* that is connected but visible nowhere is pure cost.
	*/
	isServerNeeded(serverId) {
		if (!this.getMcpStore().servers[serverId]) return false;
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
	* The exact config object handed to the official client.
	*
	* The single source for BOTH the fork's config and its fingerprint, so the
	* two cannot drift: a field added here is automatically part of the identity
	* that decides whether a remount is needed.
	*/
	mountConfigOf(server) {
		const baseConfig = {
			serverName: server.id,
			toolCallTimeoutMs: server.toolCallTimeoutMs ?? 6e4,
			failOnStartupError: Boolean(server.failOnStartupError),
			...server.maxInstructionBytes !== void 0 ? { maxInstructionBytes: server.maxInstructionBytes } : {},
			reconnect: {
				enabled: server.reconnect?.enabled ?? true,
				initialDelayMs: server.reconnect?.initialDelayMs ?? 500,
				maxDelayMs: server.reconnect?.maxDelayMs ?? 3e4,
				maxAttempts: server.reconnect?.maxAttempts ?? 10
			}
		};
		return server.transport === "stdio" ? {
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
	}
	/**
	* Key-order-independent serialization for config comparison.
	*
	* `JSON.stringify` alone would report a change whenever the form re-submits
	* the same `env`/`headers` entries in a different order, causing a remount
	* that changes nothing.
	*/
	canonical(value) {
		if (value === null || typeof value !== "object") return JSON.stringify(value);
		if (Array.isArray(value)) return `[${value.map((entry) => this.canonical(entry)).join(",")}]`;
		return `{${Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${this.canonical(entry)}`).join(",")}}`;
	}
	/**
	* Mount official @deepseek-ai/dsh-mcp-client plugin instance dynamically in memory.
	*/
	async mountOfficialClient(server, officialPlugin, opts = {}) {
		await this.unmountOfficialClient(server.id);
		const officialConfig = this.mountConfigOf(server);
		try {
			const fork = this.ctx.plugin(officialPlugin, officialConfig);
			this.officialForks.set(server.id, fork);
			this.mountAttempted.add(server.id);
			this.mountStartedAt.set(server.id, Date.now());
			this.mountedConfigKeys.set(server.id, this.canonical(officialConfig));
			let settled;
			try {
				settled = Promise.resolve(fork.await()).then(() => void 0, (err) => {
					this.recordMountError(server.id, err);
				});
			} catch (err) {
				this.recordMountError(server.id, err);
				settled = Promise.resolve();
			}
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
			const settleMs = opts.settleMs ?? 0;
			if (settleMs > 0) await Promise.race([settled, delay(settleMs)]);
			return true;
		} catch (err) {
			this.recordMountError(server.id, err);
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
	*
	* The map entry is removed before awaiting dispose() so `isMounted()` turns
	* false immediately; awaiting dispose() makes sure the Cordis fiber has
	* released the `serverName` reservation before a remount reuses it.
	*
	* Unmounting also resets the inferred status ("unknown" instead of "failed").
	*/
	async unmountOfficialClient(serverId) {
		const fork = this.officialForks.get(serverId);
		this.officialForks.delete(serverId);
		const existingNames = this.serverToolMap.get(serverId);
		if (existingNames) {
			for (const pubName of existingNames) this.toolMeta.delete(pubName);
			this.serverToolMap.delete(serverId);
		}
		this.lastErrors.delete(serverId);
		this.mountAttempted.delete(serverId);
		this.mountStartedAt.delete(serverId);
		this.mountedConfigKeys.delete(serverId);
		if (!fork) return;
		try {
			await fork.dispose();
		} catch (err) {
			console.warn(`[session-settings] [MCP-UNMOUNT] Error while disposing official mcp-client fork for "${serverId}":`, err instanceof Error ? err.message : String(err));
		}
	}
	/**
	* True while a non-disposed Cordis fork exists for the server.
	*
	* Do NOT use `officialForks.has()` instead: after the official bridge gives up
	* it unregisters every tool but keeps the fiber alive, so the map entry
	* survives a permanent failure.
	*/
	isMounted(serverId) {
		const fork = this.officialForks.get(serverId);
		return Boolean(fork && fork.uid !== null);
	}
	/**
	* Snapshot of every tool name currently registered on ctx.tools.
	*
	* `tools.schemas()` is presentation-agnostic and restriction-aware, which is
	* exactly what a registration probe needs.
	*/
	collectRegisteredToolNames() {
		const names = /* @__PURE__ */ new Set();
		try {
			const schemas = (typeof this.ctx.get === "function" ? this.ctx.get("tools") : void 0)?.schemas?.();
			if (Array.isArray(schemas)) {
				for (const schema of schemas) if (schema && typeof schema.name === "string") names.add(schema.name);
			}
		} catch {}
		return names;
	}
	/**
	* Inferred runtime status of the official client for one server.
	*
	* Pass a pre-collected `registeredNames` set when computing status for many
	* servers at once to avoid re-walking the registry per server.
	*/
	getServerStatus(serverId, registeredNames) {
		const names = registeredNames ?? this.collectRegisteredToolNames();
		const prefix = `mcp__${serverId}__`;
		let registeredToolCount = 0;
		for (const name of names) if (name.startsWith(prefix)) registeredToolCount++;
		const status = {
			mountAttempted: this.mountAttempted.has(serverId),
			mounted: this.isMounted(serverId),
			registeredToolCount
		};
		const mountStartedAt = this.mountStartedAt.get(serverId);
		if (mountStartedAt !== void 0) status.mountStartedAt = mountStartedAt;
		const lastError = this.lastErrors.get(serverId);
		if (lastError) status.lastError = lastError;
		const lastRefreshAt = this.lastRefreshAt.get(serverId);
		if (lastRefreshAt) status.lastRefreshAt = lastRefreshAt;
		return status;
	}
	/**
	* Tear down and remount the official client for a server, resetting the
	* bridge's reconnect budget — the only way to recover from "giving up after N
	* consecutive failed reconnect attempts".
	*
	* Serialized against in-flight syncs; only mounts when the server is still
	* wanted (or when `force` is set, used by the session card for toggles that
	* have not been saved yet).
	*/
	async refreshServer(server, opts = {}) {
		const serverId = server.id;
		const startedAt = Date.now();
		const inFlight = this.activeSyncs.get(serverId);
		if (inFlight) try {
			await inFlight;
		} catch {}
		const run = (async () => {
			this.lastErrors.delete(serverId);
			await this.unmountOfficialClient(serverId);
			let remounted = false;
			if (Boolean(opts.force) || this.isServerNeeded(serverId)) {
				const liveServer = this.getMcpStore().servers[serverId] ?? server;
				const officialPlugin = await loadOfficialMcpClientPlugin(this.ctx);
				if (officialPlugin) remounted = await this.mountOfficialClient(liveServer, officialPlugin, { settleMs: opts.settleMs ?? 0 });
				else {
					this.recordMountError(serverId, /* @__PURE__ */ new Error(OFFICIAL_PLUGIN_MISSING));
					console.error(`[session-settings] [MCP-REFRESH] ${OFFICIAL_PLUGIN_MISSING} Skipping remount for "${serverId}".`);
				}
			}
			this.lastRefreshAt.set(serverId, Date.now());
			return {
				remounted,
				status: this.getServerStatus(serverId),
				durationMs: Date.now() - startedAt
			};
		})();
		const entry = run.then(() => void 0, () => void 0);
		this.activeSyncs.set(serverId, entry);
		try {
			return await run;
		} finally {
			if (this.activeSyncs.get(serverId) === entry) this.activeSyncs.delete(serverId);
		}
	}
	/** Record a mount/activation failure for status reporting. */
	recordMountError(serverId, err) {
		const message = err instanceof Error ? err.message : String(err);
		this.lastErrors.set(serverId, message);
		console.warn(`[session-settings] [MCP-MOUNT] Official mcp-client activation failed for "${serverId}": ${message}`);
	}
	/**
	* Ensure all servers in the given list are mounted on-demand.
	*/
	async ensureServersMounted(serverIds) {
		if (!Array.isArray(serverIds) || serverIds.length === 0) return;
		const store = this.getMcpStore();
		const pending = serverIds.filter((id) => !this.isMounted(id)).map((id) => store.servers[id]).filter((s) => Boolean(s));
		if (pending.length === 0) return;
		await Promise.all(pending.map((server) => this.syncServer(server)));
	}
	/**
	* Synchronize tool registrations for a single server by mounting/unmounting official client fork.
	*/
	async syncServer(server) {
		if (!server || !server.id) return;
		if (!this.isServerNeeded(server.id)) {
			await this.unmountOfficialClient(server.id);
			return;
		}
		if (this.isMounted(server.id) && this.mountedConfigKeys.get(server.id) === this.canonical(this.mountConfigOf(server))) return;
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
		for (const serverId of Array.from(this.officialForks.keys())) if (!store.servers[serverId] || !this.isServerNeeded(serverId)) this.unmountOfficialClient(serverId).catch(() => {});
		for (const server of allServers) if (this.isServerNeeded(server.id)) this.syncServer(server).catch(() => {});
		else this.unmountOfficialClient(server.id).catch(() => {});
	}
	/**
	* Teardown and unmount all official client forks on plugin unload.
	*/
	async dispose() {
		const forks = Array.from(this.officialForks.values());
		this.officialForks.clear();
		this.toolMeta.clear();
		this.serverToolMap.clear();
		this.lastErrors.clear();
		this.mountAttempted.clear();
		this.mountStartedAt.clear();
		this.mountedConfigKeys.clear();
		this.lastRefreshAt.clear();
		this.activeSyncs.clear();
		await Promise.allSettled(forks.map(async (fork) => {
			try {
				await fork.dispose();
			} catch {}
		}));
	}
};
//#endregion
//#region lib/types/server/mcp/tester/connect.js
/**
* One-shot MCP connection for on-demand discovery and reads.
*
* Every operation in this subsystem (probe, resource read, prompt fetch) needs
* the same thing: open a transport for one configured server, run one call, and
* close. Transport selection, timeout budgeting, the HTTP-to-SSE fallback, and
* the stdio stderr diagnostics were previously inlined in the two probe runners;
* read operations would have been a third copy, so they live here instead.
*
* This is deliberately NOT the official bridge: it opens a short-lived
* connection for the GUI, never registers anything model-visible, and never
* enters a session's context. The mounted official client remains the only
* source of model-facing tools and resources.
*/
/** Resolved timeouts for one server, per transport. */
function resolveTimeouts(server) {
	const isStdio = server.transport === "stdio";
	const fallback = isStdio ? 6e4 : 3e4;
	const configured = server.toolCallTimeoutMs;
	const timeoutMs = typeof configured === "number" && configured > 0 ? Math.max(configured, isStdio ? 5e3 : 3e3) : fallback;
	return {
		timeoutMs,
		probeTimeoutMs: isStdio ? Math.min(Math.max(Math.floor(timeoutMs / 4), 5e3), 15e3) : Math.min(Math.max(Math.floor(timeoutMs / 3), 3e3), 1e4)
	};
}
/**
* Whether one stored transport value is the HTTP family.
*
* `streamable-http-or-sse` and plain `sse` are legacy on-disk spellings: the
* live store still contains entries written by an older release. They name the
* same HTTP family, so they dispatch identically here and the concrete flavour
* is settled during negotiation. Only a value that is neither stdio nor this
* family is an unusable configuration.
*/
function isHttpTransport(transport) {
	return transport === "streamable-http" || transport === "sse" || transport === "streamable-http-or-sse";
}
/**
* Connect to one configured server and hand back a live session.
*
* The caller owns the returned session and MUST close it. Every failure path
* closes whatever it opened before returning, so a failed call leaks no child
* process and no open stream.
*/
async function connectMcpServer(server, override) {
	const resolved = resolveTimeouts(server);
	const opts = {
		timeoutMs: resolved.timeoutMs,
		probeTimeoutMs: resolved.probeTimeoutMs,
		failureLabel: "连接测试失败",
		...override
	};
	if (server.transport === "stdio") return connectStdio(server, opts);
	if (isHttpTransport(server.transport)) return connectHttp(server, opts);
	return {
		ok: false,
		message: `${opts.failureLabel}: 不支持的传输协议 (${String(server.transport)})`
	};
}
/** Open one client over a prepared transport, returning the raw error on failure. */
async function openClient(transport, opts) {
	const client = new Client({
		name: "dsh-mcp-tester",
		version: "1.0.0"
	}, { versionNegotiation: {
		mode: "auto",
		probe: {
			timeoutMs: opts.probeTimeoutMs,
			maxRetries: 0
		}
	} });
	try {
		await client.connect(transport, {
			timeout: opts.timeoutMs,
			signal: AbortSignal.timeout(opts.timeoutMs)
		});
		return { client };
	} catch (err) {
		await client.close().catch(() => {});
		return {
			client,
			error: err instanceof Error ? err : new Error(String(err))
		};
	}
}
/** Human label for the negotiation budget, used in timeout diagnostics. */
function timeoutHint(opts) {
	return ` (已等待 ${Math.round(opts.timeoutMs / 1e3)} 秒)`;
}
/** Whether an error looks like a deadline rather than a protocol or network fault. */
function isTimeoutError(err) {
	return err.name === "TimeoutError" || err.name === "AbortError" || /timeout|timed out|aborted/i.test(err.message);
}
/**
* Failure that indicates a reachable server answered a Streamable HTTP request
* incompatibly. Only these justify an SSE downgrade; a network outage or a DNS
* failure must not be retried as SSE, which would double the wait to report the
* same unreachability.
*/
function looksLikeSseDowngrade(err) {
	const message = err.message;
	if (/fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET|timeout/i.test(message)) return false;
	return /unexpected content|405|text\/event-stream/i.test(message);
}
async function connectStdio(server, opts) {
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
	const opened = await openClient(transport, opts);
	if (opened.error) {
		const stderrDetail = stderrBuffer.trim() ? `\n(stderr: ${stderrBuffer.trim().slice(-300)})` : "";
		const hint = isTimeoutError(opened.error) ? timeoutHint(opts) : "";
		return {
			ok: false,
			message: `STDIO ${opts.failureLabel}${hint}: ${opened.error.message}${stderrDetail}`
		};
	}
	const client = opened.client;
	return {
		ok: true,
		session: {
			client,
			detectedTransport: "stdio",
			close: () => client.close().catch(() => {}),
			diagnostics: () => stderrBuffer.trim() ? `\n(stderr: ${stderrBuffer.trim().slice(-300)})` : ""
		}
	};
}
async function connectHttp(server, opts) {
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
	const headers = server.headers ?? {};
	const isSsePath = parsedUrl.pathname.includes("/sse");
	const attempt = async (transport, kind) => {
		const opened = await openClient(transport, opts);
		if (opened.error) return {
			ok: false,
			error: opened.error
		};
		const client = opened.client;
		return {
			ok: true,
			session: {
				client,
				detectedTransport: kind,
				close: () => client.close().catch(() => {}),
				diagnostics: () => ""
			}
		};
	};
	const sseTransport = () => new SSEClientTransport(parsedUrl, { requestInit: { headers } });
	if (isSsePath) {
		const sseResult = await attempt(sseTransport(), "sse");
		return sseResult.ok ? sseResult : {
			ok: false,
			message: `SSE ${opts.failureLabel}: ${sseResult.error.message}`
		};
	}
	const httpResult = await attempt(new StreamableHTTPClientTransport(parsedUrl, {
		requestInit: { headers },
		reconnectionOptions: {
			maxRetries: 0,
			initialReconnectionDelay: 0,
			maxReconnectionDelay: 0,
			reconnectionDelayGrowFactor: 1
		}
	}), "streamable-http");
	if (httpResult.ok) return httpResult;
	if (!looksLikeSseDowngrade(httpResult.error)) return {
		ok: false,
		message: `HTTP ${opts.failureLabel}: ${httpResult.error.message}`
	};
	const sseResult = await attempt(sseTransport(), "sse");
	if (sseResult.ok) return sseResult;
	return {
		ok: false,
		message: `Streamable HTTP 失败 (${httpResult.error.message})，尝试降级 SSE 亦失败: ${sseResult.error.message}`
	};
}
//#endregion
//#region lib/types/server/mcp/tester/collect.js
/**
* Discovery of one server's declared primitives over a live connection.
*
* Tools, resources, and prompts are collected together because they come from
* the same handshake: the capability snapshot, server version, and negotiated
* protocol all describe one connection, and splitting them across calls would
* mean reconnecting to ask the same server what it supports.
*
* The capability flags are load-bearing rather than decorative. The MCP SDK
* answers a `list*` call for a capability the server never advertised with an
* EMPTY LIST and a console warning — not an error — so an empty result alone
* cannot distinguish "declares nothing" from "does not support this". Only the
* flags can, and the panel needs that distinction to avoid telling a
* tools-only server that it has zero resources.
*/
/** Narrow an unknown value to a string, or undefined. */
function asString(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/** Narrow an unknown value to a finite number, or undefined. */
function asNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** Build the per-request deadline options for one pass. */
function requestOptions(timeoutMs) {
	return {
		timeout: timeoutMs,
		signal: AbortSignal.timeout(timeoutMs)
	};
}
/**
* Read a server's declared capabilities as booleans.
*
* Presence, not truthiness of the inner object: the spec defines the capability
* as an object (possibly empty), so `resources: {}` still means "supported".
*/
function readCapabilities(client) {
	const caps = client.getServerCapabilities();
	return {
		tools: caps?.tools !== void 0,
		resources: caps?.resources !== void 0,
		prompts: caps?.prompts !== void 0
	};
}
/** Project the SDK's Tool list onto the wire-forward shape. */
function mapTools(raw) {
	if (!Array.isArray(raw)) return [];
	return raw.map((tool) => {
		const item = tool ?? {};
		return {
			name: typeof tool === "string" ? tool : asString(item.name) || asString(item.id) || "",
			description: asString(item.description),
			inputSchema: item.inputSchema && typeof item.inputSchema === "object" ? item.inputSchema : void 0
		};
	});
}
/** Project the SDK's Resource list onto the wire-forward shape. */
function mapResources(raw) {
	if (!Array.isArray(raw)) return [];
	const mapped = [];
	for (const resource of raw) {
		const item = resource ?? {};
		const uri = asString(item.uri);
		if (!uri) continue;
		mapped.push({
			uri,
			name: asString(item.name) || uri,
			title: asString(item.title),
			description: asString(item.description),
			mimeType: asString(item.mimeType),
			size: asNumber(item.size)
		});
	}
	return mapped;
}
/**
* Project resource templates, resolving each one's variable names.
*
* `UriTemplate.variableNames` is the SDK's own RFC 6570 parse, so the set the
* panel prompts for is exactly the set `expand` will consume. A template with no
* expressions (`docs://readme`) keeps an empty name list and is still listed
* rather than dropped: it is a server-declared entry, and an empty form reads it
* immediately. Only a genuinely malformed template is skipped, because offering
* a fill-in form whose expansion would throw helps no one.
*/
function mapResourceTemplates(raw) {
	if (!Array.isArray(raw)) return [];
	const mapped = [];
	for (const template of raw) {
		const item = template ?? {};
		const uriTemplate = asString(item.uriTemplate);
		if (!uriTemplate) continue;
		let variableNames = [];
		try {
			variableNames = new UriTemplate(uriTemplate).variableNames;
		} catch {
			continue;
		}
		mapped.push({
			uriTemplate,
			name: asString(item.name) || uriTemplate,
			title: asString(item.title),
			description: asString(item.description),
			mimeType: asString(item.mimeType),
			variableNames
		});
	}
	return mapped;
}
/** Project the SDK's Prompt list onto the wire-forward shape. */
function mapPrompts(raw) {
	if (!Array.isArray(raw)) return [];
	const mapped = [];
	for (const prompt of raw) {
		const item = prompt ?? {};
		const name = asString(item.name);
		if (!name) continue;
		const args = (Array.isArray(item.arguments) ? item.arguments : []).map((arg) => {
			const entry = arg ?? {};
			const argName = asString(entry.name);
			if (!argName) return void 0;
			return {
				name: argName,
				description: asString(entry.description),
				required: entry.required === true
			};
		}).filter((arg) => arg !== void 0);
		mapped.push({
			name,
			title: asString(item.title),
			description: asString(item.description),
			arguments: args.length > 0 ? args : void 0
		});
	}
	return mapped;
}
/**
* Collect every primitive the connected server declares.
*
* Each list call is isolated: a server that advertises `resources` but fails the
* call contributes an empty list and leaves the rest of the discovery intact, so
* one broken primitive cannot blank the whole panel. The corresponding
* capability flag is downgraded to false in that case, keeping the flag an
* honest report of what actually came back.
*
* @param client - already-connected client.
* @param timeoutMs - per-request deadline.
* @returns the collected primitives, capabilities, and server identity.
*/
async function collectDiscovery(client, timeoutMs) {
	const opts = requestOptions(timeoutMs);
	const capabilities = readCapabilities(client);
	const toolDetails = await (async () => {
		try {
			return mapTools((await client.listTools(void 0, opts))?.tools);
		} catch {
			capabilities.tools = false;
			return [];
		}
	})();
	const resourceDetails = await (async () => {
		if (!capabilities.resources) return [];
		try {
			return mapResources((await client.listResources(void 0, opts))?.resources);
		} catch {
			capabilities.resources = false;
			return [];
		}
	})();
	const resourceTemplateDetails = await (async () => {
		if (!capabilities.resources) return [];
		try {
			return mapResourceTemplates((await client.listResourceTemplates(void 0, opts))?.resourceTemplates);
		} catch {
			return [];
		}
	})();
	const promptDetails = await (async () => {
		if (!capabilities.prompts) return [];
		try {
			return mapPrompts((await client.listPrompts(void 0, opts))?.prompts);
		} catch {
			capabilities.prompts = false;
			return [];
		}
	})();
	const serverVersion = client.getServerVersion();
	const protocolVersion = client.getNegotiatedProtocolVersion();
	const discoverResult = client.getDiscoverResult();
	const supportedVersions = discoverResult && Array.isArray(discoverResult.supportedVersions) ? discoverResult.supportedVersions : protocolVersion ? [protocolVersion] : [];
	return {
		toolDetails,
		resourceDetails,
		resourceTemplateDetails,
		promptDetails,
		capabilities,
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
		supportedVersions
	};
}
//#endregion
//#region lib/types/server/mcp/tester/stdio-runner.js
/**
* STDIO transport tester powered by official @modelcontextprotocol/client.
*/
/** Test an MCP server over STDIO transport */
async function testStdioConnection(server) {
	if (!server.command?.trim()) return {
		ok: false,
		message: "stdio 模式需要填写启动命令 (command)"
	};
	const connected = await connectMcpServer(server);
	if (!connected.ok) return {
		ok: false,
		message: connected.message
	};
	const { session } = connected;
	try {
		const timeoutMs = typeof server.toolCallTimeoutMs === "number" && server.toolCallTimeoutMs > 0 ? Math.max(server.toolCallTimeoutMs, 5e3) : 6e4;
		const discovery = await collectDiscovery(session.client, timeoutMs);
		const toolNames = discovery.toolDetails.map((tool) => tool.name);
		const count = toolNames.length;
		return {
			ok: true,
			count,
			tools: toolNames,
			toolDetails: discovery.toolDetails,
			resourceDetails: discovery.resourceDetails,
			resourceTemplateDetails: discovery.resourceTemplateDetails,
			promptDetails: discovery.promptDetails,
			capabilities: discovery.capabilities,
			serverInfo: discovery.serverInfo,
			supportedVersions: discovery.supportedVersions,
			detectedTransport: "stdio",
			message: count > 0 ? `成功获取到 ${count} 个工具` : "成功连接并完成 MCP 握手 (未声明可用工具)"
		};
	} catch (err) {
		return {
			ok: false,
			message: `STDIO 连接测试失败: ${err instanceof Error ? err.message : String(err)}${session.diagnostics()}`
		};
	} finally {
		await session.close();
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
	try {
		new URL(urlStr);
	} catch (err) {
		return {
			ok: false,
			message: `URL 格式不正确: ${err instanceof Error ? err.message : String(err)}`
		};
	}
	const connected = await connectMcpServer(server);
	if (!connected.ok) return {
		ok: false,
		message: connected.message
	};
	const { session } = connected;
	try {
		const timeoutMs = typeof server.toolCallTimeoutMs === "number" && server.toolCallTimeoutMs > 0 ? Math.max(server.toolCallTimeoutMs, 3e3) : 3e4;
		const discovery = await collectDiscovery(session.client, timeoutMs);
		const toolNames = discovery.toolDetails.map((tool) => tool.name);
		const count = toolNames.length;
		return {
			ok: true,
			count,
			tools: toolNames,
			toolDetails: discovery.toolDetails,
			resourceDetails: discovery.resourceDetails,
			resourceTemplateDetails: discovery.resourceTemplateDetails,
			promptDetails: discovery.promptDetails,
			capabilities: discovery.capabilities,
			serverInfo: discovery.serverInfo,
			supportedVersions: discovery.supportedVersions,
			detectedTransport: session.detectedTransport,
			message: count > 0 ? `成功获取到 ${count} 个工具` : "成功连接并完成 MCP 握手 (未声明可用工具)"
		};
	} catch (err) {
		return {
			ok: false,
			message: `${session.detectedTransport === "sse" ? "SSE" : "HTTP"} 连接测试失败: ${err instanceof Error ? err.message : String(err)}`
		};
	} finally {
		await session.close();
	}
}
//#endregion
//#region lib/types/server/mcp/tester/read.js
/**
* On-demand resource reads and prompt fetches for the management panel.
*
* Both operations open their own short-lived connection, run one call, and
* close. They are GUI actions, not model-visible capabilities: nothing here is
* registered on `ctx.tools` or `ctx.mcpResources`, and nothing enters a session.
* The model-facing resource tools belong to `@deepseek-ai/dsh-mcp-resources` and
* are governed separately by the scope policy.
*/
/**
* Per-entry text ceiling, in characters.
*
* A resource is arbitrary server-authored content; a large one would otherwise
* be serialized into an HTTP response and held in browser state. 256 KiB is far
* beyond any read a human does in a preview pane while still bounding the
* response. Truncation is reported per entry AND on the result, so the UI can
* say so instead of silently showing a prefix.
*/
const MAX_TEXT_CHARS = 262144;
/** Truncate one string to the cap, reporting whether it was cut. */
function capText(text) {
	if (text.length <= MAX_TEXT_CHARS) return {
		text,
		truncated: false
	};
	return {
		text: text.slice(0, MAX_TEXT_CHARS),
		truncated: true
	};
}
/** Open a short-lived connection for one read, with read-flavoured diagnostics. */
async function openForRead(server) {
	const connected = await connectMcpServer(server, { failureLabel: "连接失败" });
	if (!connected.ok) return {
		ok: false,
		message: connected.message
	};
	return {
		ok: true,
		session: connected.session
	};
}
/**
* Resolve the addressing mode of one read into a concrete URI.
*
* Template form is expanded HERE rather than in the client for two reasons: the
* client half may not value-import `@modelcontextprotocol/client`, and
* `UriTemplate.expand` silently drops variables it has no value for —
* `db://{table}/{id}` with nothing filled yields the well-formed but wrong
* `"db:///"`. So every variable the template names is required to be present
* and non-blank BEFORE expanding, and a missing one fails the read with the
* exact names listed.
*/
function resolveUri(request) {
	const literal = request.uri?.trim();
	if (literal) return {
		ok: true,
		uri: literal
	};
	const template = request.uriTemplate?.trim();
	if (!template) return {
		ok: false,
		message: "需要提供资源 URI 或资源模板 (uri / uriTemplate)"
	};
	let parsed;
	try {
		parsed = new UriTemplate(template);
	} catch (err) {
		return {
			ok: false,
			message: `资源模板格式不正确: ${err instanceof Error ? err.message : String(err)}`
		};
	}
	const provided = request.variables ?? {};
	const missing = parsed.variableNames.filter((name) => {
		const value = provided[name];
		return typeof value !== "string" || value.trim().length === 0;
	});
	if (missing.length > 0) return {
		ok: false,
		message: `资源模板缺少变量值: ${missing.join(", ")}`
	};
	const scoped = {};
	for (const name of parsed.variableNames) scoped[name] = provided[name];
	return {
		ok: true,
		uri: parsed.expand(scoped)
	};
}
/**
* Read one resource by literal URI or by expanded template.
*
* @param request - addressing form plus the server to reach.
* @returns the resource contents, or a failure with a human-readable reason.
*/
async function readResource(request) {
	const resolved = resolveUri(request);
	if (!resolved.ok) return {
		ok: false,
		message: resolved.message
	};
	const opened = await openForRead(request.server);
	if (!opened.ok) return {
		ok: false,
		message: opened.message
	};
	try {
		const timeoutMs = typeof request.server.toolCallTimeoutMs === "number" && request.server.toolCallTimeoutMs > 0 ? Math.max(request.server.toolCallTimeoutMs, 3e3) : 3e4;
		const result = await opened.session.client.readResource({ uri: resolved.uri }, {
			timeout: timeoutMs,
			signal: AbortSignal.timeout(timeoutMs)
		});
		const contents = (Array.isArray(result?.contents) ? result.contents : []).map((entry) => {
			const item = entry ?? {};
			const uri = typeof item.uri === "string" ? item.uri : resolved.uri;
			const mimeType = typeof item.mimeType === "string" ? item.mimeType : void 0;
			if (typeof item.blob === "string") return {
				uri,
				mimeType,
				blobBytes: item.blob.length
			};
			if (typeof item.text === "string") {
				const capped = capText(item.text);
				return {
					uri,
					mimeType,
					text: capped.text,
					truncated: capped.truncated || void 0
				};
			}
			return {
				uri,
				mimeType
			};
		});
		const truncated = contents.some((entry) => entry.truncated === true);
		return {
			ok: true,
			uri: resolved.uri,
			contents,
			message: truncated ? `已读取资源（内容超过 ${Math.round(MAX_TEXT_CHARS / 1024)} KiB，已截断）` : "已读取资源"
		};
	} catch (err) {
		return {
			ok: false,
			message: `读取资源失败: ${err instanceof Error ? err.message : String(err)}${opened.session.diagnostics()}`
		};
	} finally {
		await opened.session.close();
	}
}
/**
* Reduce one prompt content block to what the panel can show.
*
* Text is preserved verbatim. Images and audio become a MIME-typed description,
* and embedded resources become their URI: this panel never feeds a session, so
* forwarding payload bytes to the browser would buy nothing.
*/
function mapPromptBlock(block) {
	const item = block ?? {};
	const type = typeof item.type === "string" ? item.type : "unknown";
	const mimeType = typeof item.mimeType === "string" ? item.mimeType : void 0;
	if (type === "text") {
		const capped = capText(typeof item.text === "string" ? item.text : "");
		return {
			type: "text",
			text: capped.text,
			mimeType,
			truncated: capped.truncated || void 0
		};
	}
	if (type === "image") return {
		type: "image",
		mimeType,
		description: "图片内容（未传输二进制数据）"
	};
	if (type === "audio") return {
		type: "audio",
		mimeType,
		description: "音频内容（未传输二进制数据）"
	};
	if (type === "resource" || type === "resource_link") {
		const resource = item.resource ?? item;
		const uri = typeof resource.uri === "string" ? resource.uri : void 0;
		return {
			type: "resource",
			mimeType,
			description: uri ? `嵌入资源: ${uri}` : "嵌入资源"
		};
	}
	return {
		type: "unknown",
		mimeType,
		description: `不支持的内容类型: ${type}`
	};
}
/**
* Project one prompt message, preserving its role and content block.
*
* `PromptMessage.content` is a SINGLE content block in the spec, not a list: a
* prompt that wants several blocks emits several messages. The SDK validates
* this, so a non-conformant server is rejected before reaching here and an
* array branch would be unreachable.
*/
function mapPromptMessage(message) {
	const item = message ?? {};
	return {
		role: item.role === "assistant" ? "assistant" : "user",
		blocks: [mapPromptBlock(item.content)]
	};
}
/**
* Render one prompt template by name with the caller's argument values.
*
* @param request - prompt name, argument values, and the server to reach.
* @returns role-tagged messages, or a failure with a human-readable reason.
*/
async function getPrompt(request) {
	const name = request.name?.trim();
	if (!name) return {
		ok: false,
		message: "需要提供提示词名称 (name)"
	};
	const opened = await openForRead(request.server);
	if (!opened.ok) return {
		ok: false,
		message: opened.message
	};
	try {
		const timeoutMs = typeof request.server.toolCallTimeoutMs === "number" && request.server.toolCallTimeoutMs > 0 ? Math.max(request.server.toolCallTimeoutMs, 3e3) : 3e4;
		const args = request.arguments ?? {};
		const result = await opened.session.client.getPrompt({
			name,
			...Object.keys(args).length > 0 ? { arguments: args } : {}
		}, {
			timeout: timeoutMs,
			signal: AbortSignal.timeout(timeoutMs)
		});
		const messages = (Array.isArray(result?.messages) ? result.messages : []).map(mapPromptMessage);
		const truncated = messages.some((message) => message.blocks.some((block) => block.truncated === true));
		return {
			ok: true,
			description: typeof result?.description === "string" ? result.description : void 0,
			messages,
			message: truncated ? `已获取提示词（内容超过 ${Math.round(MAX_TEXT_CHARS / 1024)} KiB，已截断）` : "已获取提示词"
		};
	} catch (err) {
		return {
			ok: false,
			message: `获取提示词失败: ${err instanceof Error ? err.message : String(err)}${opened.session.diagnostics()}`
		};
	} finally {
		await opened.session.close();
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
	return testHttpConnection(server);
}
//#endregion
//#region lib/types/server/common/http.js
/**
* Build a carrier-registered route from one contract endpoint.
*
* The path and the accepted methods are both read from `src/types.ts`, so a
* route can never disagree with what the client sends. Bodies are `buffered`, so
* the carrier reads and size-limits them before the handler runs.
*/
function toFetchRoute(spec) {
	return {
		path: API_ENDPOINTS[spec.endpoint],
		methods: [API_METHODS[spec.endpoint]],
		requestBody: "buffered",
		fetch: spec.handler
	};
}
/** JSON response with the plugin's standard content type. */
function jsonResponse(data, status = 200) {
	return Response.json(data, {
		status,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}
/** The plugin's uniform rejection for a request whose shape violates the contract. */
function badRequest(error) {
	return jsonResponse({
		ok: false,
		error
	}, 400);
}
/** Read and parse a buffered JSON body; `undefined` when it is absent or unparsable. */
async function readJsonBody(request) {
	try {
		const text = await request.text();
		if (!text.trim()) return void 0;
		const parsed = JSON.parse(text);
		return parsed && typeof parsed === "object" ? parsed : void 0;
	} catch {
		return;
	}
}
/** Query string of a read request. */
function requestQuery(request) {
	return new URL(request.url).searchParams;
}
//#endregion
//#region lib/types/server/mcp/routes.js
/**
* How long a manual refresh waits for the freshly mounted official client to
* settle before reading its runtime status. Bounded so the request stays snappy.
*/
const MCP_REFRESH_SETTLE_MS = 3e3;
/**
* Build the client-facing representation of the MCP servers.
*
* Heavy fields (`toolDetails`) are stripped down to counts, and the live
* `runtime` status of the official mcp-client fork is attached. `runtime` is
* response-only and never persisted: `saveMcpStore` always serializes the store
* itself, never this projection.
*/
function getSanitizedServers(store, mcpManager) {
	const registeredNames = mcpManager?.collectRegisteredToolNames();
	return Object.values(store.servers).map((s) => {
		const { toolDetails, resourceDetails, resourceTemplateDetails, promptDetails, capabilities, tools, disabledTools, ...rest } = s;
		const server = {
			...rest,
			tools: Array.isArray(tools) ? tools.length : 0,
			disabledTools: Array.isArray(disabledTools) ? disabledTools.length : 0,
			resourceCount: Array.isArray(resourceDetails) ? resourceDetails.length : 0,
			resourceTemplateCount: Array.isArray(resourceTemplateDetails) ? resourceTemplateDetails.length : 0,
			promptCount: Array.isArray(promptDetails) ? promptDetails.length : 0,
			capabilities
		};
		if (mcpManager) server.runtime = mcpManager.getServerStatus(s.id, registeredNames);
		return server;
	});
}
/** Official `dsh-mcp-client` namespacing contract for `mcp__<serverName>__<tool>`. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
/**
* Fold one successful probe's discovery into the stored server.
*
* The single writer for everything a probe learns. Three call sites (the tools
* endpoint, the test endpoint, and the manual refresh) previously repeated the
* same field list, so every new discovered primitive had to be added in three
* places or one of them would silently drop it. Arrays are assigned only when
* the probe reported them, so a partial result cannot erase a good cache.
*
* @param server - stored config to update in place.
* @param result - a successful probe outcome.
*/
function applyProbeResult(server, result) {
	if (result.tools) server.tools = result.tools;
	if (result.toolDetails) server.toolDetails = result.toolDetails;
	if (result.resourceDetails) server.resourceDetails = result.resourceDetails;
	if (result.resourceTemplateDetails) server.resourceTemplateDetails = result.resourceTemplateDetails;
	if (result.promptDetails) server.promptDetails = result.promptDetails;
	if (result.capabilities) server.capabilities = result.capabilities;
	if (result.detectedTransport) server.detectedTransport = result.detectedTransport;
	if (result.serverInfo) server.serverInfo = result.serverInfo;
	server.lastTestedAt = Date.now();
}
function parseServerConfig(incoming, existing) {
	const id = (typeof incoming.id === "string" ? incoming.id : "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
	const name = (typeof incoming.name === "string" ? incoming.name : "").trim();
	if (!id || !name) return { error: "Server ID and name are required" };
	if (!SERVER_NAME_PATTERN.test(id)) return { error: "Server ID must be 1-32 characters of letters, digits, \"_\" or \"-\"" };
	const rawTransport = incoming.transport;
	const transport = rawTransport === "stdio" ? "stdio" : rawTransport === "streamable-http" || rawTransport === "streamable-http-or-sse" || rawTransport === "sse" ? "streamable-http" : null;
	if (!transport) return { error: "Valid transport (stdio, streamable-http) is required" };
	if (transport === "stdio" && !incoming.command?.trim()) return { error: "Command is required for stdio transport" };
	if (transport !== "stdio" && !incoming.url?.trim()) return { error: "URL is required for HTTP/SSE transport" };
	const now = Date.now();
	const toolCallTimeoutMs = typeof incoming.toolCallTimeoutMs === "number" && incoming.toolCallTimeoutMs > 0 ? Math.floor(incoming.toolCallTimeoutMs) : void 0;
	const failOnStartupError = typeof incoming.failOnStartupError === "boolean" ? incoming.failOnStartupError : void 0;
	let reconnect = void 0;
	if (incoming.reconnect && typeof incoming.reconnect === "object") {
		const atLeastOne = (value) => typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : void 0;
		reconnect = {
			enabled: typeof incoming.reconnect.enabled === "boolean" ? incoming.reconnect.enabled : void 0,
			initialDelayMs: atLeastOne(incoming.reconnect.initialDelayMs),
			maxDelayMs: atLeastOne(incoming.reconnect.maxDelayMs),
			maxAttempts: atLeastOne(incoming.reconnect.maxAttempts)
		};
	}
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
			toolCallTimeoutMs: toolCallTimeoutMs ?? existing?.toolCallTimeoutMs,
			failOnStartupError: failOnStartupError ?? existing?.failOnStartupError,
			maxInstructionBytes: typeof incoming.maxInstructionBytes === "number" && incoming.maxInstructionBytes > 0 ? Math.floor(incoming.maxInstructionBytes) : existing?.maxInstructionBytes,
			reconnect: reconnect ?? existing?.reconnect,
			disabledTools: Array.isArray(disabledTools) && disabledTools.length > 0 ? disabledTools : void 0,
			tools: Array.isArray(incoming.tools) ? incoming.tools : existing?.tools,
			toolDetails: incoming.toolDetails ?? existing?.toolDetails,
			resourceDetails: incoming.resourceDetails ?? existing?.resourceDetails,
			resourceTemplateDetails: incoming.resourceTemplateDetails ?? existing?.resourceTemplateDetails,
			promptDetails: incoming.promptDetails ?? existing?.promptDetails,
			capabilities: incoming.capabilities ?? existing?.capabilities,
			detectedTransport: incoming.detectedTransport ?? existing?.detectedTransport,
			serverInfo: incoming.serverInfo ?? existing?.serverInfo,
			lastTestedAt: incoming.lastTestedAt ?? existing?.lastTestedAt,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now
		},
		id
	};
}
function registerMcpRoutes(connection, getMcpStore, setMcpStore, mcpManager, getSessionSettingsStore, setSessionSettingsStore, invalidatePolicies) {
	const unregisterListRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersList",
		handler: async () => {
			try {
				const currentStore = loadMcpStore();
				setMcpStore(currentStore);
				return jsonResponse({
					ok: true,
					servers: getSanitizedServers(currentStore, mcpManager)
				});
			} catch (err) {
				return jsonResponse({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}, 500);
			}
		}
	}));
	const unregisterAddRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersAdd",
		handler: async (request) => {
			const parsed = await readJsonBody(request);
			if (!parsed) return badRequest("A JSON request body is required");
			const incoming = parsed.server;
			if (!incoming || typeof incoming !== "object") return badRequest("A \"server\" payload is required");
			try {
				const { error, config, id } = parseServerConfig(incoming);
				if (error || !config || !id) return badRequest(error || "Invalid server configuration");
				const mcpStore = getMcpStore();
				mcpStore.servers[id] = config;
				saveMcpStore(mcpStore);
				setMcpStore(mcpStore);
				mcpManager?.syncServer(config);
				invalidatePolicies?.();
				return jsonResponse({
					ok: true,
					server: config
				});
			} catch (err) {
				return badRequest(err instanceof Error ? err.message : String(err));
			}
		}
	}));
	const unregisterEditRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersEdit",
		handler: async (request) => {
			const parsed = await readJsonBody(request);
			if (!parsed) return badRequest("A JSON request body is required");
			const incoming = parsed.server;
			if (!incoming || typeof incoming !== "object") return badRequest("A \"server\" payload is required");
			const originalId = typeof parsed.originalId === "string" ? parsed.originalId.trim() : "";
			try {
				const mcpStore = getMcpStore();
				const isRename = Boolean(originalId && mcpStore.servers[originalId]);
				const { error, config, id } = parseServerConfig(incoming, isRename ? mcpStore.servers[originalId] : typeof incoming.id === "string" ? mcpStore.servers[incoming.id.trim()] : void 0);
				if (error || !config || !id) return badRequest(error || "Invalid server configuration");
				if (isRename && originalId !== id) {
					delete mcpStore.servers[originalId];
					await mcpManager?.unmountOfficialClient(originalId);
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
				invalidatePolicies?.();
				return jsonResponse({
					ok: true,
					server: config
				});
			} catch (err) {
				return badRequest(err instanceof Error ? err.message : String(err));
			}
		}
	}));
	const unregisterRmRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersRm",
		handler: async (request) => {
			const parsed = await readJsonBody(request);
			if (!parsed) return badRequest("A JSON request body is required");
			const targetId = (typeof parsed.id === "string" ? parsed.id : "").trim();
			if (!targetId) return badRequest("Server ID is required");
			try {
				const mcpStore = getMcpStore();
				if (mcpStore.servers[targetId]) {
					delete mcpStore.servers[targetId];
					saveMcpStore(mcpStore);
					setMcpStore(mcpStore);
					await mcpManager?.unmountOfficialClient(targetId);
				}
				return jsonResponse({
					ok: true,
					id: targetId
				});
			} catch (err) {
				return badRequest(err instanceof Error ? err.message : String(err));
			}
		}
	}));
	const unregisterCacheRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersCache",
		handler: async (request) => {
			const targetId = (new URL(request.url).searchParams.get("id") || "").trim();
			const currentStore = loadMcpStore();
			setMcpStore(currentStore);
			if (!targetId || !currentStore.servers[targetId]) return jsonResponse({
				ok: false,
				error: "Server not found"
			}, 404);
			const s = currentStore.servers[targetId];
			return jsonResponse({
				ok: true,
				tools: s.tools || [],
				toolDetails: s.toolDetails || [],
				resourceDetails: s.resourceDetails || [],
				resourceTemplateDetails: s.resourceTemplateDetails || [],
				promptDetails: s.promptDetails || [],
				capabilities: s.capabilities,
				disabledTools: Array.isArray(s.disabledTools) ? s.disabledTools : [],
				serverInfo: s.serverInfo,
				detectedTransport: s.detectedTransport
			});
		}
	}));
	const unregisterProbeRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersProbe",
		handler: async (request) => {
			const parsed = await readJsonBody(request);
			if (!parsed) return badRequest("A JSON request body is required");
			const probePayload = parsed.server;
			if (!probePayload || typeof probePayload !== "object") return badRequest("A \"server\" payload is required");
			try {
				const mcpStore = getMcpStore();
				const targetId = (typeof probePayload.id === "string" ? probePayload.id : "").trim();
				const existing = targetId ? mcpStore.servers[targetId] : void 0;
				const effectiveServer = existing ? {
					...existing,
					...probePayload
				} : probePayload;
				const startedAt = Date.now();
				const probe = await testMcpConnection(effectiveServer);
				if (targetId && mcpStore.servers[targetId] && probe.ok) {
					const s = mcpStore.servers[targetId];
					applyProbeResult(s, probe);
					saveMcpStore(mcpStore);
					setMcpStore(mcpStore);
					mcpManager?.syncServer(s);
					invalidatePolicies?.();
				}
				let remount;
				if (parsed.remount === true) {
					if (!targetId) return badRequest("A \"server.id\" is required to remount");
					if (!mcpStore.servers[targetId]) return jsonResponse({
						ok: false,
						error: `Unknown MCP server "${targetId}"`
					}, 404);
					const outcome = mcpManager ? await mcpManager.refreshServer(mcpStore.servers[targetId], {
						force: parsed.force === true,
						settleMs: probe.ok ? MCP_REFRESH_SETTLE_MS : 0
					}) : void 0;
					remount = {
						id: targetId,
						name: mcpStore.servers[targetId].name,
						ok: probe.ok,
						message: probe.message,
						toolCount: probe.tools?.length ?? 0,
						durationMs: outcome?.durationMs ?? Date.now() - startedAt,
						remounted: outcome?.remounted ?? false,
						status: outcome?.status ?? {
							mountAttempted: false,
							mounted: false,
							registeredToolCount: 0
						}
					};
				}
				return jsonResponse({
					...probe,
					...remount ? { remount } : {},
					...targetId ? { server: getSanitizedServers(mcpStore, mcpManager).find((s) => s.id === targetId) } : {}
				});
			} catch (err) {
				return badRequest(err instanceof Error ? err.message : String(err));
			}
		}
	}));
	const unregisterImportRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersImport",
		handler: async (request) => {
			const parsed = await readJsonBody(request);
			if (!parsed) return badRequest("A JSON request body is required");
			if (parsed.data === void 0) return badRequest("A \"data\" payload is required");
			const rootObj = parsed.data;
			const serversMap = rootObj.mcpServers ?? rootObj;
			try {
				if (!serversMap || typeof serversMap !== "object" || Array.isArray(serversMap)) return jsonResponse({
					ok: false,
					message: "Invalid JSON format: expected mcpServers object mapping"
				}, 400);
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
				invalidatePolicies?.();
				const sanitizedServers = getSanitizedServers(mcpStore, mcpManager);
				return jsonResponse({
					ok: true,
					count,
					servers: sanitizedServers
				});
			} catch (err) {
				return jsonResponse({
					ok: false,
					message: err instanceof Error ? err.message : String(err)
				}, 400);
			}
		}
	}));
	const unregisterResourceReadRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersResourceRead",
		handler: async (request) => {
			const parsed = await readJsonBody(request);
			if (!parsed) return badRequest("A JSON request body is required");
			const target = parsed.server;
			if (!target || typeof target !== "object") return badRequest("A \"server\" payload is required");
			const uri = typeof parsed.uri === "string" ? parsed.uri.trim() : "";
			const uriTemplate = typeof parsed.uriTemplate === "string" ? parsed.uriTemplate.trim() : "";
			if (!uri && !uriTemplate) return badRequest("Either \"uri\" or \"uriTemplate\" is required");
			const variables = parsed.variables && typeof parsed.variables === "object" ? Object.fromEntries(Object.entries(parsed.variables).filter((entry) => {
				return typeof entry[1] === "string";
			})) : void 0;
			return jsonResponse(await readResource({
				server: target,
				...uri ? { uri } : {},
				...uriTemplate ? { uriTemplate } : {},
				...variables ? { variables } : {}
			}));
		}
	}));
	const unregisterPromptGetRoute = connection.fetch.register(toFetchRoute({
		endpoint: "mcpServersPromptGet",
		handler: async (request) => {
			const parsed = await readJsonBody(request);
			if (!parsed) return badRequest("A JSON request body is required");
			const target = parsed.server;
			if (!target || typeof target !== "object") return badRequest("A \"server\" payload is required");
			const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
			if (!name) return badRequest("A \"name\" field is required");
			const args = parsed.arguments && typeof parsed.arguments === "object" ? Object.fromEntries(Object.entries(parsed.arguments).filter((entry) => {
				return typeof entry[1] === "string";
			})) : void 0;
			return jsonResponse(await getPrompt({
				server: target,
				name,
				...args ? { arguments: args } : {}
			}));
		}
	}));
	return async () => {
		await unregisterListRoute();
		await unregisterAddRoute();
		await unregisterEditRoute();
		await unregisterRmRoute();
		await unregisterCacheRoute();
		await unregisterProbeRoute();
		await unregisterImportRoute();
		await unregisterResourceReadRoute();
		await unregisterPromptGetRoute();
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
/**
* Bucket a skill by its provider-declared {@link SkillSource}: `user-*` and
* `project-*` are filesystem-backed, everything else (bundled, runtime, custom)
* ships with the composition and is listed after them.
*/
function classifySkillSource(skill) {
	const source = (skill.source ?? "").toLowerCase();
	if (source.includes("user")) return {
		isRuntime: false,
		source
	};
	if (source.includes("project")) return {
		isRuntime: false,
		source
	};
	return {
		isRuntime: true,
		source: source || "runtime"
	};
}
function compareSkills(a, b) {
	if (Boolean(a.isRuntime) !== Boolean(b.isRuntime)) return a.isRuntime ? 1 : -1;
	return a.name.localeCompare(b.name);
}
/** Durable preset id of a session, read from the header (live, then stored). */
async function resolvePresetId(ctx, sessionId) {
	if (!sessionId) return void 0;
	const live = ctx.get("sessions")?.get?.(sessionId);
	if (live?.header?.agentPreset) return live.header.agentPreset;
	const persistence = ctx.get("sessionPersistence");
	if (typeof persistence?.stat === "function") try {
		return (await persistence.stat(sessionId))?.header?.agentPreset;
	} catch {}
}
/**
* Resolve the skill-registry view scopes for a session's DISPLAY read.
*
* Enforcement lives in each agent's own scope layer, but a scoped read only
* traverses from its key UPWARD — so reading from a preset's generation scope
* can never observe an agent-layer shadow. Display therefore reads the base
* composition and applies the disable flags itself, keeping the GUI independent
* of the mechanism that enforces the policy.
*
* A live agent is used when present because its scope chain includes the
* composition; otherwise the preset registry lends a standing scope lease
* (preset providers register into that layer), which the caller must release.
*/
async function resolveScopes(ctx, sessionId) {
	const liveAgent = sessionId ? ctx.get("agents")?.get?.(sessionId) : void 0;
	if (liveAgent) return {
		scopes: [liveAgent],
		release: async () => {}
	};
	const presets = ctx.get("agentPresets");
	if (typeof presets?.acquireScope === "function") try {
		const lease = await presets.acquireScope(await resolvePresetId(ctx, sessionId));
		if (lease?.key) return {
			scopes: [lease.key],
			release: async () => {
				try {
					await lease[Symbol.asyncDispose]?.();
				} catch {}
			}
		};
	} catch {}
	return {
		scopes: [void 0],
		release: async () => {}
	};
}
/**
* Per-session invocation policy to overlay onto a DISPLAY read.
*
* The registry read is invocation-neutral by design; consumers apply policy at
* their own boundary. Display does the same, so the flags shown in the GUI match
* what enforcement will do without the GUI reaching into a scope layer (a scoped
* read can never see a nearer scope's shadow).
*/
async function resolveDisplayPolicy(ctx, store, sessionId) {
	if (!store) return {
		disabledModel: /* @__PURE__ */ new Set(),
		disabledUser: /* @__PURE__ */ new Set()
	};
	const effective = resolveEffectiveSkills(store, sessionId, await resolveWorkspaceForSession(ctx, sessionId));
	return {
		disabledModel: new Set(effective.effectiveDisabledModelSkills ?? []),
		disabledUser: new Set(effective.effectiveDisabledUserSkills ?? [])
	};
}
/** The registry instance to read for one scope (agent-scoped when available). */
function skillRegistryFor(ctx, scope) {
	const presets = ctx.get("agentPresets");
	if (scope && typeof scope === "object" && "ctx" in scope && typeof presets?.serviceFor === "function") try {
		const service = presets.serviceFor(scope, "skills");
		if (service) return service;
	} catch {}
	return ctx.get("skills");
}
async function getAvailableSkills(ctx, sessionId, store) {
	const cwd = await resolveSessionCwd(ctx, sessionId);
	const { scopes, release } = await resolveScopes(ctx, sessionId);
	const policy = await resolveDisplayPolicy(ctx, store, sessionId);
	const map = /* @__PURE__ */ new Map();
	try {
		for (const scope of scopes) {
			const registry = skillRegistryFor(ctx, scope);
			if (typeof registry?.list !== "function") continue;
			try {
				const list = await registry.list({
					cwd,
					scope
				});
				for (const skill of list ?? []) {
					if (map.has(skill.name)) continue;
					const { isRuntime, source } = classifySkillSource(skill);
					const modelInvocable = (skill.invocation?.modelInvocable ?? true) && !policy.disabledModel.has(skill.name);
					const userInvocable = (skill.invocation?.userInvocable ?? true) && !policy.disabledUser.has(skill.name);
					map.set(skill.name, {
						name: skill.name,
						description: skill.description ?? "",
						whenToUse: skill.whenToUse,
						provider: skill.provider || "skills-registry",
						source,
						modelInvocable,
						userInvocable,
						isRuntime
					});
				}
			} catch {}
		}
	} finally {
		await release();
	}
	return Array.from(map.values()).sort(compareSkills);
}
async function getSkillDetail(ctx, name, sessionId, store) {
	const cwd = await resolveSessionCwd(ctx, sessionId);
	const { scopes, release } = await resolveScopes(ctx, sessionId);
	const policy = await resolveDisplayPolicy(ctx, store, sessionId);
	try {
		for (const scope of scopes) {
			const registry = skillRegistryFor(ctx, scope);
			if (typeof registry?.get !== "function") continue;
			try {
				const skill = await registry.get(name, {
					cwd,
					scope
				});
				if (!skill) continue;
				const { isRuntime, source } = classifySkillSource(skill);
				return {
					name: skill.name,
					description: skill.description ?? "",
					whenToUse: skill.whenToUse,
					provider: skill.provider || "skills-registry",
					source,
					path: skill.path ?? skill.resourceBase?.path,
					content: skill.content,
					modelInvocable: (skill.invocation?.modelInvocable ?? true) && !policy.disabledModel.has(skill.name),
					userInvocable: (skill.invocation?.userInvocable ?? true) && !policy.disabledUser.has(skill.name),
					isRuntime
				};
			} catch {}
		}
	} finally {
		await release();
	}
	return null;
}
//#endregion
//#region lib/types/server/session/routes.js
/**
* Reject a save whose declared scope cannot be satisfied by its target.
*
* The scope is authoritative: a request that names `session` without a session
* id is an error rather than being silently retargeted, which is precisely how
* a New-Session save used to overwrite the global defaults.
*
* @returns an error message, or `undefined` when the target is satisfiable.
*/
function validateScopeTarget(scope, sessionId, workspaceId) {
	switch (scope) {
		case "session": return sessionId ? void 0 : "scope \"session\" requires a sessionId";
		case "workspace": return workspaceId ? void 0 : "scope \"workspace\" requires a workspaceId";
		case "global": return;
	}
}
/** The empty cross-scope view a response carries when a scope has no entry. */
function emptyWorkspaceConfig() {
	return {
		subagentModel: { mode: "global" },
		mcp: { mode: "global" },
		skills: { mode: "global" },
		sandbox: { mode: "global" }
	};
}
function registerSessionSettingsRoutes(ctx, connection, getSessionSettingsStore, setSessionSettingsStore, mcpManager, invalidatePolicies, sandboxCapability, sandboxSkipped) {
	const unregisterGetSettings = connection.fetch.register(toFetchRoute({
		endpoint: "getSettings",
		handler: async (request) => {
			const query = new URL(request.url).searchParams;
			const querySessionId = query.get("sessionId") || void 0;
			const queryWorkspaceId = await resolveWorkspaceForSession(ctx, querySessionId) ?? query.get("workspaceId") ?? void 0;
			try {
				const sessionSettingsStore = getSessionSettingsStore();
				const sessionEntry = querySessionId ? sessionSettingsStore.sessions[querySessionId] : void 0;
				const workspaceEntry = queryWorkspaceId ? sessionSettingsStore.workspaces?.[queryWorkspaceId] : void 0;
				return jsonResponse({
					ok: true,
					sessionId: querySessionId,
					workspaceId: queryWorkspaceId,
					sessionConfig: sessionEntry ?? {
						subagentModel: { mode: "workspace" },
						mcp: { mode: "workspace" },
						skills: { mode: "workspace" },
						sandbox: { mode: "workspace" }
					},
					workspaceConfig: workspaceEntry ?? emptyWorkspaceConfig(),
					globalConfig: sessionSettingsStore.globalConfig,
					...sandboxCapability ? { sandboxCapability: sandboxCapability(querySessionId) } : {},
					...sandboxSkipped ? { sandboxSkipped: sandboxSkipped(querySessionId) } : {}
				});
			} catch (err) {
				return jsonResponse({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}, 500);
			}
		}
	}));
	const unregisterSaveSettings = connection.fetch.register(toFetchRoute({
		endpoint: "saveSettings",
		handler: async (request) => saveSettings(request)
	}));
	async function saveSettings(request) {
		const parsed = await readJsonBody(request);
		if (!parsed) return badRequest("A JSON request body is required");
		const scope = parsed.scope;
		if (!isSettingsScopeId(scope)) return badRequest("A valid \"scope\" is required (session, workspace, or global)");
		const targetSessionId = typeof parsed.sessionId === "string" && parsed.sessionId ? parsed.sessionId : void 0;
		const targetWorkspaceId = await resolveWorkspaceForSession(ctx, targetSessionId) ?? (typeof parsed.workspaceId === "string" && parsed.workspaceId ? parsed.workspaceId : void 0);
		const scopeProblem = validateScopeTarget(scope, targetSessionId, targetWorkspaceId);
		if (scopeProblem) return badRequest(scopeProblem);
		const isRestoringDefault = parsed.isRestoringDefault === true;
		let incomingConfig;
		if (!isRestoringDefault) {
			if (scope === "global") {
				if (parsed.globalConfig === void 0) return badRequest("scope \"global\" requires a globalConfig");
				incomingConfig = normalizeGlobalSettings(parsed.globalConfig);
			} else {
				if (parsed.config === void 0) return badRequest(`scope "${scope}" requires a config`);
				incomingConfig = normalizeSessionSettings(parsed.config);
			}
		}
		if (incomingConfig?.subagentModel.mode === "custom" && !incomingConfig.subagentModel.inherit && (!incomingConfig.subagentModel.model?.provider || !incomingConfig.subagentModel.model?.model)) return badRequest("Subagent model custom mode requires provider and model");
		const sessionSettingsStore = getSessionSettingsStore();
		if (!sessionSettingsStore.workspaces) sessionSettingsStore.workspaces = {};
		/**
		* Runtime skills ship with the composition and cannot be disabled as a
		* default for anything narrower than a session.
		*/
		const withoutRuntimeSkills = async (config) => {
			try {
				const allSkills = await getAvailableSkills(ctx, void 0);
				const runtimeSkillNames = new Set(allSkills.filter((s) => s.isRuntime).map((s) => s.name));
				if (config.skills?.disabledModelSkills) config.skills.disabledModelSkills = config.skills.disabledModelSkills.filter((name) => !runtimeSkillNames.has(name));
				if (config.skills?.disabledUserSkills) config.skills.disabledUserSkills = config.skills.disabledUserSkills.filter((name) => !runtimeSkillNames.has(name));
			} catch {}
			return config;
		};
		switch (scope) {
			case "global":
				if (isRestoringDefault) sessionSettingsStore.globalConfig = {
					subagentModel: {
						inherit: true,
						allowAgentSelectModel: true,
						overrideForkModel: false
					},
					mcp: { enabledServerIds: [] },
					skills: {
						disabledModelSkills: [],
						disabledUserSkills: []
					},
					sandbox: { allow: [] }
				};
				else if (incomingConfig) sessionSettingsStore.globalConfig = await withoutRuntimeSkills(incomingConfig);
				break;
			case "workspace": {
				const workspaceId = targetWorkspaceId;
				if (isRestoringDefault) delete sessionSettingsStore.workspaces[workspaceId];
				else if (incomingConfig) sessionSettingsStore.workspaces[workspaceId] = await withoutRuntimeSkills(incomingConfig);
				break;
			}
			case "session": {
				const sessionId = targetSessionId;
				if (isRestoringDefault) delete sessionSettingsStore.sessions[sessionId];
				else if (incomingConfig) {
					if (incomingConfig.subagentModel.mode === "workspace" && incomingConfig.subagentModel.allowAgentSelectModel === void 0 && incomingConfig.subagentModel.overrideForkModel === void 0 && incomingConfig.mcp.mode === "workspace" && incomingConfig.skills.mode === "workspace" && incomingConfig.sandbox.mode === "workspace") delete sessionSettingsStore.sessions[sessionId];
					else sessionSettingsStore.sessions[sessionId] = incomingConfig;
				}
				break;
			}
		}
		saveSessionSettingsStore(sessionSettingsStore);
		setSessionSettingsStore(sessionSettingsStore);
		mcpManager?.syncAll();
		invalidatePolicies?.();
		ctx.emit("skills/change");
		const sessionEntry = targetSessionId ? sessionSettingsStore.sessions[targetSessionId] : void 0;
		const workspaceEntry = targetWorkspaceId ? sessionSettingsStore.workspaces?.[targetWorkspaceId] : void 0;
		return jsonResponse({
			ok: true,
			scope,
			sessionId: targetSessionId,
			workspaceId: targetWorkspaceId,
			sessionConfig: sessionEntry ?? incomingConfig,
			workspaceConfig: workspaceEntry ?? emptyWorkspaceConfig(),
			globalConfig: sessionSettingsStore.globalConfig
		});
	}
	return async () => {
		await unregisterGetSettings();
		await unregisterSaveSettings();
	};
}
//#endregion
//#region lib/types/server/skills/routes.js
function registerSkillsRoutes(ctx, connection, getSessionSettingsStore) {
	const unregisterSkills = connection.fetch.register(toFetchRoute({
		endpoint: "skills",
		handler: async (request) => {
			const reqSessionId = (new URL(request.url).searchParams.get("sessionId") || "").trim() || void 0;
			try {
				return jsonResponse({
					ok: true,
					skills: await getAvailableSkills(ctx, reqSessionId, getSessionSettingsStore?.())
				});
			} catch (err) {
				return jsonResponse({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}, 500);
			}
		}
	}));
	const unregisterSkillContent = connection.fetch.register(toFetchRoute({
		endpoint: "skillsContent",
		handler: async (request) => {
			const query = new URL(request.url).searchParams;
			const skillName = (query.get("name") || "").trim();
			const reqSessionId = (query.get("sessionId") || "").trim() || void 0;
			if (!skillName) return badRequest("Skill name is required");
			try {
				const skill = await getSkillDetail(ctx, skillName, reqSessionId, getSessionSettingsStore?.());
				if (!skill) return jsonResponse({
					ok: false,
					error: `Skill "${skillName}" not found`
				}, 404);
				return jsonResponse({
					ok: true,
					skill
				});
			} catch (err) {
				return jsonResponse({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				}, 500);
			}
		}
	}));
	return async () => {
		await unregisterSkills();
		await unregisterSkillContent();
	};
}
//#endregion
//#region lib/types/server/subagent-model/interceptor.js
/**
* The route this child's direct parent is running, i.e. the route the child
* would have inherited had the delegation named nothing.
*
* This mirrors the host's own baseline, `parentAgentOptionsForDelegation`:
* prefer the parent Session's last request header and fall back to the live
* Agent's options. The DIRECT parent is the right reference — a delegation
* inherits from the agent that called it, not from the root Session whose
* settings `resolveAgentSessionId` resolves.
*/
function parentRoute(ctx, agent) {
	const parentId = agent?.session?.header?.parentSession;
	if (!parentId) return void 0;
	const parent = ctx.get("agents")?.get(parentId);
	if (!parent) return void 0;
	const logged = parent.session?.requestHeader?.()?.config;
	if (logged?.provider && logged?.model) return {
		provider: logged.provider,
		model: logged.model,
		...logged.reasoningEffort ? { reasoningEffort: logged.reasoningEffort } : {}
	};
	const options = parent.options;
	if (!options?.provider || !options?.model) return void 0;
	return {
		provider: options.provider,
		model: options.model,
		...options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {}
	};
}
/**
* Whether this child Agent actually chose its own LLM route.
*
* Having a route proves nothing: the host's `resolveChildAgentOptions` merges
* the parent's provider/model into EVERY child's `options`, so a plainly
* inherited child looks identical to one that named a route. An explicit
* choice is therefore exactly a route the child would NOT have inherited.
*
* When the parent cannot be resolved the route is treated as the child's own,
* which leaves it alone — the conservative direction, since overriding a
* deliberate choice is worse than missing one.
*
* This is also why the interceptor must never write `agent.options`: doing so
* would destroy the signal it depends on.
*/
function hasExplicitChildModel(ctx, agent) {
	const options = agent?.options;
	if (!options?.provider || !options?.model) return false;
	const inherited = parentRoute(ctx, agent);
	if (!inherited) return true;
	return options.provider !== inherited.provider || options.model !== inherited.model;
}
/**
* Whether this Session was produced by the fork provider. A forked child
* inherits a copy of its parent's event log, which the immutable Session header
* records as `isSeeded`.
*/
function isForkSubagent(agent) {
	const header = agent?.session?.header;
	return header?.origin === "subagent" && header.isSeeded === true;
}
/** Remove the child-model-selection surface from one assembly. */
function withoutModelSelection(assembly, config) {
	if (config.allowAgentSelectModel !== false || !Array.isArray(assembly.tools)) return assembly;
	const stripped = /* @__PURE__ */ new Set([
		"model",
		"provider",
		"reasoning_effort"
	]);
	const tools = assembly.tools.filter((tool) => tool.name !== "list_subagent_models").map((tool) => {
		if (!(tool.name === "subagent" || tool.name.startsWith("subagent_")) || !tool.parameters || typeof tool.parameters !== "object") return tool;
		const parameters = tool.parameters;
		const properties = parameters.properties;
		if (!properties || typeof properties !== "object") return tool;
		const required = Array.isArray(parameters.required) ? parameters.required.filter((name) => typeof name === "string" && !stripped.has(name)) : parameters.required;
		return {
			...tool,
			parameters: {
				...parameters,
				properties: Object.fromEntries(Object.entries(properties).filter(([name]) => !stripped.has(name))),
				...required === void 0 ? {} : { required }
			},
			description: typeof tool.description === "string" ? tool.description.replace(/Child LLM selection is optional\..*?default effort\./g, "").trim() : tool.description
		};
	});
	return {
		...assembly,
		tools
	};
}
function registerSubagentModelInterceptor(ctx, getSessionSettingsStore) {
	/** Effective subagent-model settings for the session an Agent belongs to. */
	const configFor = async (agent) => resolveEffectiveSubagentModel(getSessionSettingsStore(), resolveAgentSessionId(agent, ctx), await resolveWorkspaceForSession(ctx, resolveAgentSessionId(agent, ctx)));
	/**
	* The route this interceptor must force onto a child, or `undefined` to leave
	* the child's own configuration alone.
	*
	* A forked child preserves its inherited prefix (and the parent's KV cache)
	* unless the user opted in through `overrideForkModel`. In forced mode the
	* child's own choice is overridden; otherwise an explicit child route wins.
	*/
	const forcedRouteFor = async (agent) => {
		if (agent?.session?.header?.origin !== "subagent") return void 0;
		const config = await configFor(agent);
		if (isForkSubagent(agent) && config.overrideForkModel !== true) return;
		const target = config.inherit ? void 0 : config.model;
		if (!target) return void 0;
		if (config.allowAgentSelectModel !== false && hasExplicitChildModel(ctx, agent)) return;
		return target;
	};
	ctx.inject(["tools"], (toolsCtx) => {
		const guard = toolsCtx.tools?.guard;
		if (typeof guard !== "function") return;
		guard((exec) => {
			if (exec?.name !== "list_subagent_models") return void 0;
			return resolveEffectiveSubagentModel(getSessionSettingsStore(), resolveAgentSessionId(exec.agent, ctx)).allowAgentSelectModel === false ? "list_subagent_models is disabled by user settings for this session" : void 0;
		});
	});
	ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
		const agent = context?.agent;
		const assembled = await next();
		if (!agent) return assembled;
		const themed = withoutModelSelection(assembled, await configFor(agent));
		const target = await forcedRouteFor(agent);
		if (!target) return themed;
		return {
			...themed,
			variables: {
				...themed.variables,
				provider: target.provider,
				model: target.model
			}
		};
	});
	ctx.on("agent/request", async (payload, next) => {
		const proposal = await next();
		const target = await forcedRouteFor(payload?.agent);
		if (!target) return proposal;
		return {
			...proposal,
			provider: target.provider,
			model: target.model,
			...target.reasoningEffort ? { reasoningEffort: target.reasoningEffort } : {}
		};
	});
}
//#endregion
//#region lib/types/server/mcp/policy-projection.js
/**
* The three shared resource tools registered by `@deepseek-ai/dsh-mcp-resources`.
* They carry no `mcp__` prefix and are absent from the manager's tool metadata,
* so they must be recognised by name.
*/
const RESOURCE_TOOLS = /* @__PURE__ */ new Set([
	"list_mcp_resources",
	"list_mcp_resource_templates",
	"read_mcp_resource"
]);
/** Prompt section owned by `@deepseek-ai/dsh-mcp-resources` listing addressable servers. */
const RESOURCE_SERVERS_SECTION = "mcp-resource-servers";
/**
* How many times a session's workspace may be re-resolved before we accept that
* it has none. A session created before the workspace registry indexed it would
* otherwise stay pinned to the global layer for its whole life.
*/
const MAX_WORKSPACE_RESOLVE_RETRIES = 5;
/** Prompt section carrying one server's attributed instructions, owned by the official client. */
function instructionsSectionName(serverId) {
	return `mcp:${serverId}`;
}
/**
* Enforce the per-session MCP policy through scope-layer declarations instead of
* event interception.
*
* The official client is mounted once on the shared (root) layer, so its tools,
* resource providers, and prompt sections are inherited by every agent. Each
* agent then narrows that inherited surface on its own scope:
*
*  - `tools.restrict({deny})` removes disallowed tools from the agent's view.
*    `view()` feeds both presentation (`schemas()`) and dispatch
*    (`resolveExecution()`), so this single declaration covers both faces.
*    It only filters the INHERITED surface, which is why the mount must stay on
*    the shared layer.
*  - `systemPrompt.section()` shadows the official instruction and resource-list
*    sections by name; an empty text contributes nothing.
*  - A root `tools.guard()` resolves the policy from the caller and is the
*    monotonic backstop. It covers the window before `restrict()` lands and the
*    resource tools' `server` argument, which a name-based filter cannot express.
*/
var McpPolicyProjection = class {
	ctx;
	getMcpStore;
	getSessionSettingsStore;
	manager;
	/** sessionId -> resolved policy. Keyed by the ROOT session so children share it. */
	policies = /* @__PURE__ */ new Map();
	/**
	* sessionId -> the workspace its policy was resolved against.
	*
	* Kept OUTSIDE `policies` so dropping the cache recomputes with the SAME
	* workspace. `resolveWorkspaceForSession` is async while the execution guard
	* must read a policy synchronously, so the answer is remembered rather than
	* re-derived — re-deriving silently passed `undefined`, i.e. the global layer.
	*/
	policyWorkspace = /* @__PURE__ */ new Map();
	/** sessionId -> bounded re-resolution attempts for a not-yet-indexed workspace. */
	workspaceRetries = /* @__PURE__ */ new Map();
	projections = /* @__PURE__ */ new Map();
	/** Guards against re-entrancy while a repaint may itself emit `tools/change`. */
	repainting = false;
	constructor(ctx, getMcpStore, getSessionSettingsStore, manager) {
		this.ctx = ctx;
		this.getMcpStore = getMcpStore;
		this.getSessionSettingsStore = getSessionSettingsStore;
		this.manager = manager;
	}
	/** Install the monotonic execution guard and start observing tool-set changes. */
	start() {
		this.toolsService()?.guard(((exec) => {
			try {
				return this.executionDenial(exec);
			} catch (err) {
				console.warn("[session-settings] [MCP-POLICY] Policy evaluation failed; denying the call:", err instanceof Error ? err.message : String(err));
				return `unknown tool "${typeof exec?.name === "string" ? exec.name : "unknown"}"`;
			}
		}));
		this.ctx.on("tools/change", () => {
			this.repaint();
		});
	}
	/**
	* Apply the policy for one newly created agent.
	*
	* Awaited by the `agent/created` listener so the restriction and section
	* shadows exist before the agent's first prompt assembly. Mounting is
	* deliberately NOT awaited: a slow or unreachable stdio server must not delay
	* agent creation, and the `tools/change` repaint installs the restriction over
	* its tools as soon as they register.
	*/
	async applyToAgent(agent) {
		const sessionId = this.sessionIdOf(agent);
		const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId);
		if (sessionId) {
			this.policyWorkspace.set(sessionId, workspaceId);
			this.workspaceRetries.delete(sessionId);
			this.policies.set(sessionId, this.computePolicy(sessionId, workspaceId));
		}
		const policy = this.policyFor(sessionId);
		const tools = agent.ctx.get("tools");
		if (!tools) return;
		this.installRestriction(agent, tools, policy, this.registeredToolNames());
		this.syncSections(agent, policy);
		this.mountInBackground(policy);
	}
	/** Drop bookkeeping for a disposed agent; its scope declarations unwind with its context. */
	forget(agent) {
		this.projections.delete(agent);
		const sessionId = this.sessionIdOf(agent);
		if (!sessionId) return;
		for (const other of this.projections.keys()) if (this.sessionIdOf(other) === sessionId) return;
		this.policies.delete(sessionId);
		this.policyWorkspace.delete(sessionId);
		this.workspaceRetries.delete(sessionId);
	}
	/**
	* Make sure the servers this agent's session enables are mounted.
	*
	* Called from the prompt-assembly path so the first turn of a cold server
	* already sees its tools. This is a MOUNT TRIGGER only — the tool set is
	* narrowed by the scope declarations, never by this call, and it returns the
	* assembly untouched.
	*/
	async ensureMountedFor(agent) {
		const sessionId = this.sessionIdOf(agent);
		await this.retryWorkspaceResolution(sessionId);
		const policy = this.policyFor(sessionId);
		const ids = Array.from(policy.enabledServerIds);
		if (ids.length === 0) return;
		try {
			await this.manager.ensureServersMounted(ids);
		} catch {}
	}
	/**
	* Re-resolve a workspace that was not indexed when the agent was created.
	*
	* `agent/created` can run before `workspaceRegistry` knows the session, and a
	* policy computed then is pinned to the global layer forever. Bounded so a
	* session that genuinely has no workspace stops costing an async lookup.
	*/
	async retryWorkspaceResolution(sessionId) {
		if (!sessionId) return;
		if (this.policyWorkspace.get(sessionId) !== void 0) return;
		const attempts = this.workspaceRetries.get(sessionId) ?? 0;
		if (attempts >= MAX_WORKSPACE_RESOLVE_RETRIES) return;
		this.workspaceRetries.set(sessionId, attempts + 1);
		const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId);
		if (!workspaceId) return;
		this.policyWorkspace.set(sessionId, workspaceId);
		this.notifyPolicyChanged();
	}
	/**
	* Invalidate cached policies and re-apply every live agent.
	*
	* Called after settings or server edits so a change takes effect on the next
	* turn without a restart.
	*/
	notifyPolicyChanged() {
		this.policies.clear();
		this.repaint(true);
	}
	/** Re-resolve the policy for live agents and re-install their declarations. */
	repaint(force = false) {
		if (this.repainting) return;
		this.repainting = true;
		try {
			const registeredNames = this.registeredToolNames();
			for (const agent of Array.from(this.projections.keys())) {
				const sessionId = this.sessionIdOf(agent);
				const tools = agent.ctx.get("tools");
				if (!tools) continue;
				if (force && sessionId) this.policies.delete(sessionId);
				const policy = this.policyFor(sessionId);
				this.installRestriction(agent, tools, policy, registeredNames);
				this.syncSections(agent, policy);
				this.mountInBackground(policy);
			}
		} finally {
			this.repainting = false;
		}
	}
	/** Install or refresh the agent's tool restriction, skipping a no-op repaint. */
	installRestriction(agent, tools, policy, registeredNames) {
		const projection = this.projectionFor(agent);
		const deny = this.denySetFor(policy, registeredNames).sort();
		const denyKey = deny.length > 0 ? deny.join("\0") : void 0;
		if (denyKey === projection.denyKey) return;
		projection.disposeRestrict?.();
		projection.disposeRestrict = void 0;
		projection.denyKey = denyKey;
		if (deny.length === 0) return;
		try {
			projection.disposeRestrict = tools.restrict({ deny });
		} catch (err) {
			projection.denyKey = void 0;
			console.warn("[session-settings] [MCP-POLICY] restrict() rejected the deny set; falling back to the execution guard only:", err instanceof Error ? err.message : String(err));
		}
	}
	/**
	* Shadow the official MCP prompt sections for this agent.
	*
	* Both official sections are registered on the shared layer, where every agent
	* inherits them. Re-registering the same name on the agent's own scope wins the
	* name for that scope alone, and an empty text contributes nothing.
	*/
	syncSections(agent, policy) {
		const systemPrompt = agent.ctx.get("systemPrompt");
		if (!systemPrompt) return;
		const projection = this.projectionFor(agent);
		const desired = /* @__PURE__ */ new Map();
		for (const serverId of Object.keys(this.getMcpStore().servers)) if (!policy.enabledServerIds.has(serverId)) desired.set(instructionsSectionName(serverId), "");
		desired.set(RESOURCE_SERVERS_SECTION, this.resourceServersText(policy));
		for (const [name, text] of desired) {
			const installed = projection.sections.get(name);
			if (installed?.text === text) continue;
			installed?.dispose();
			projection.sections.delete(name);
			try {
				const order = systemPrompt.getSectionOrder("MCP_SERVERS");
				const dispose = systemPrompt.section({
					name,
					order,
					text
				});
				projection.sections.set(name, {
					text,
					dispose
				});
			} catch (err) {
				console.warn(`[session-settings] [MCP-POLICY] Failed to shadow prompt section "${name}":`, err instanceof Error ? err.message : String(err));
			}
		}
		for (const [name, installed] of Array.from(projection.sections)) {
			if (desired.has(name)) continue;
			installed.dispose();
			projection.sections.delete(name);
		}
	}
	/** Mirror the official resource-server section, restricted to this session's servers. */
	resourceServersText(policy) {
		const names = Object.keys(this.getMcpStore().servers).filter((serverId) => policy.enabledServerIds.has(serverId)).sort();
		if (names.length === 0) return "";
		return `## MCP resource servers\n\nUse list_mcp_resources, list_mcp_resource_templates, or read_mcp_resource with one of these names as the server argument: ${JSON.stringify(names)}.`;
	}
	/** Every registered name the agent would otherwise inherit, from the global view. */
	registeredToolNames() {
		const tools = this.toolsService();
		if (!tools) return [];
		try {
			const schemas = tools.schemas();
			if (!Array.isArray(schemas)) return [];
			return schemas.map((schema) => schema?.name).filter((name) => typeof name === "string");
		} catch {
			return [];
		}
	}
	/**
	* Enabled ids that actually name a configured server.
	*
	* A dangling id (its server was deleted while the config kept referencing it)
	* must not count as "something is enabled": the resource tools address a
	* server by name and there is nothing behind that name to reach.
	*/
	resolvableEnabled(policy) {
		const servers = this.getMcpStore().servers;
		const resolvable = /* @__PURE__ */ new Set();
		for (const serverId of policy.enabledServerIds) if (serverId in servers) resolvable.add(serverId);
		return resolvable;
	}
	/**
	* Names to deny.
	*
	* Intersected with the registry's own view so `restrict()` never sees an
	* unknown name: a server that failed to mount contributes no tools, and
	* denying a name that was never registered would throw.
	*/
	denySetFor(policy, registeredNames) {
		const deny = [];
		for (const name of registeredNames) {
			if (RESOURCE_TOOLS.has(name)) {
				if (this.resolvableEnabled(policy).size === 0) deny.push(name);
				continue;
			}
			if (!this.manager.isMcpTool(name)) continue;
			if (this.denyMcpToolName(name, policy) !== void 0) deny.push(name);
		}
		return deny;
	}
	/** Resolve the denial for one execution, reading the caller's policy. */
	executionDenial(exec) {
		const name = exec?.name;
		if (typeof name !== "string") return void 0;
		const isResourceTool = RESOURCE_TOOLS.has(name);
		if (!isResourceTool && !this.manager.isMcpTool(name)) return void 0;
		const policy = this.policyFor(this.sessionIdOf(exec.agent));
		if (isResourceTool) {
			const server = readServerArgument(exec.arguments);
			if (server === void 0) return `unknown tool "${name}"`;
			return this.resolvableEnabled(policy).has(server) ? void 0 : `unknown tool "${name}"`;
		}
		return this.denyMcpToolName(name, policy);
	}
	/** Denial reason for one already-registered MCP tool name, or undefined when allowed. */
	denyMcpToolName(name, policy) {
		const meta = this.manager.getToolMeta(name);
		const serverId = meta?.serverId ?? this.serverIdFromPrefix(name);
		if (serverId === void 0) return void 0;
		if (!policy.enabledServerIds.has(serverId)) return `unknown tool "${name}"`;
		const disabled = policy.disabledRawTools.get(serverId);
		if (!disabled || disabled.size === 0) return void 0;
		const rawName = meta?.rawName ?? name.slice(`mcp__${serverId}__`.length);
		return disabled.has(rawName) ? `unknown tool "${name}"` : void 0;
	}
	/** Match a `mcp__<serverId>__*` name against the configured servers. */
	serverIdFromPrefix(name) {
		if (!name.startsWith("mcp__")) return void 0;
		for (const serverId of Object.keys(this.getMcpStore().servers)) if (name.startsWith(`mcp__${serverId}__`)) return serverId;
	}
	/** Resolve a policy, falling back to the global scope when the session is unknown yet. */
	policyFor(sessionId) {
		if (!sessionId) return this.computePolicy(void 0, void 0);
		const cached = this.policies.get(sessionId);
		if (cached) return cached;
		return this.computePolicy(sessionId, this.policyWorkspace.get(sessionId));
	}
	computePolicy(sessionId, workspaceId) {
		const effective = resolveEffectiveMcp(this.getSessionSettingsStore(), this.getMcpStore(), sessionId, workspaceId);
		const disabledRawTools = /* @__PURE__ */ new Map();
		for (const [serverId, rawNames] of Object.entries(effective.effectiveDisabledTools)) if (rawNames.length > 0) disabledRawTools.set(serverId, new Set(rawNames));
		return {
			enabledServerIds: new Set(effective.enabledServerIds),
			disabledRawTools
		};
	}
	/**
	* Mount the session's servers without blocking agent creation.
	*
	* `agent/created` is awaited by the registry, so awaiting a network mount here
	* would delay the agent's first turn.
	*/
	mountInBackground(policy) {
		const ids = Array.from(policy.enabledServerIds);
		if (ids.length === 0) return;
		this.manager.ensureServersMounted(ids).catch(() => {});
	}
	projectionFor(agent) {
		let projection = this.projections.get(agent);
		if (!projection) {
			projection = {
				denyKey: void 0,
				disposeRestrict: void 0,
				sections: /* @__PURE__ */ new Map()
			};
			this.projections.set(agent, projection);
		}
		return projection;
	}
	sessionIdOf(agent) {
		if (!agent) return void 0;
		return resolveAgentSessionId(agent, this.ctx) ?? agent.session?.id ?? agent.id;
	}
	toolsService() {
		return this.ctx.get("tools");
	}
};
/** Read the `server` argument of a resource tool call. */
function readServerArgument(args) {
	if (!args || typeof args !== "object") return void 0;
	const server = args.server;
	return typeof server === "string" && server.length > 0 ? server : void 0;
}
//#endregion
//#region lib/types/server/mcp/interceptor.js
/**
* Wire the per-session MCP policy onto each agent's scope.
*
* This replaces the former event-interception approach. Enforcement now lives in
* the tool registry's own scope layers (`tools.restrict()` / `tools.guard()`)
* and in scoped prompt-section shadowing, so a new surface added by the Host is
* governed by the registry rather than by a listener that must know its name.
*
* `agent/created` is serial and holds queued input until every listener settles,
* so declarations installed here exist before the agent's first prompt assembly.
* A listener that throws FAILS agent creation, hence the blanket try/catch.
*/
function registerMcpPolicyProjection(ctx, getSessionSettingsStore, getMcpStore, mcpManager) {
	const projection = new McpPolicyProjection(ctx, getMcpStore, getSessionSettingsStore, mcpManager);
	projection.start();
	ctx.on("agent/created", async ({ agent }) => {
		try {
			await projection.applyToAgent(agent);
		} catch (err) {
			console.warn("[session-settings] [MCP-POLICY] Failed to install MCP policy for agent; continuing without it:", err instanceof Error ? err.message : String(err));
		}
	});
	ctx.on("agent/disposed", ({ agent }) => {
		try {
			projection.forget(agent);
		} catch {}
	});
	ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
		try {
			await projection.ensureMountedFor(context?.agent);
		} catch {}
		return next();
	});
	return projection;
}
//#endregion
//#region lib/types/server/skills/policy-projection.js
/**
* Enforce per-session skill invocation policy through the skill registry's own
* scope layers.
*
* `ctx.skills.register()` files a runtime skill into the CALLING context's
* layer, and a nearer layer wins a duplicate name outright. Registering a
* same-name entry through `agent.ctx` therefore re-declares that one skill for
* exactly that agent with the invocation flags the session wants — the registry
* needs no rewriting, and `@deepseek-ai/dsh-tool-skill` enforces the result
* natively, because it filters the catalog and loads bodies through
* `invocation.modelInvocable` / `userInvocable`.
*
* Only names the session actually restricts are shadowed, so no body is loaded
* or duplicated for untouched skills.
*/
var SkillPolicyProjection = class {
	ctx;
	getSessionSettingsStore;
	/** agent -> (skill name -> disposer of that agent's shadowing registration). */
	installed = /* @__PURE__ */ new Map();
	/** agent -> serialized disabled sets currently installed, for idempotence. */
	installedKeys = /* @__PURE__ */ new Map();
	constructor(ctx, getSessionSettingsStore) {
		this.ctx = ctx;
		this.getSessionSettingsStore = getSessionSettingsStore;
	}
	/** Apply this agent's skill policy; awaited by the `agent/created` listener. */
	async applyToAgent(agent) {
		await this.refresh(agent);
	}
	/** Drop bookkeeping for a disposed agent; its scoped registrations unwind with its context. */
	forget(agent) {
		this.installed.delete(agent);
		this.installedKeys.delete(agent);
	}
	/** Re-apply every live agent after a settings change. */
	async notifyPolicyChanged() {
		await Promise.all(Array.from(this.installed.keys()).map(async (agent) => {
			try {
				await this.refresh(agent, true);
			} catch {}
		}));
	}
	/** Recompute and re-install one agent's shadows. */
	async refresh(agent, force = false) {
		const skills = agent.ctx.get("skills");
		if (!skills || typeof skills.register !== "function") return;
		const sessionId = resolveAgentSessionId(agent, this.ctx);
		const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId);
		const effective = resolveEffectiveSkills(this.getSessionSettingsStore(), sessionId, workspaceId);
		const disabledModel = new Set(effective.effectiveDisabledModelSkills ?? []);
		const disabledUser = new Set(effective.effectiveDisabledUserSkills ?? []);
		const key = `${[...disabledModel].sort().join("\0")}\u0001${[...disabledUser].sort().join("\0")}`;
		if (!force && this.installedKeys.get(agent) === key) return;
		this.clear(agent);
		this.installedKeys.set(agent, key);
		const wanted = /* @__PURE__ */ new Set([...disabledModel, ...disabledUser]);
		if (wanted.size === 0) return;
		for (const name of wanted) {
			const definition = await this.loadAsAgentSeesIt(agent, name);
			if (!definition) continue;
			const modelInvocable = !disabledModel.has(name);
			const userInvocable = !disabledUser.has(name);
			const current = definition.invocation;
			if (modelInvocable === (current?.modelInvocable ?? true) && userInvocable === (current?.userInvocable ?? true)) continue;
			try {
				const dispose = skills.register({
					name: definition.name,
					description: definition.description,
					content: definition.content,
					...definition.whenToUse !== void 0 ? { whenToUse: definition.whenToUse } : {},
					source: definition.source,
					...definition.path !== void 0 ? { path: definition.path } : {},
					...definition.provider !== void 0 ? { provider: definition.provider } : {},
					...definition.resourceBase !== void 0 ? { resourceBase: definition.resourceBase } : {},
					invocation: {
						modelInvocable,
						userInvocable
					}
				});
				this.mapFor(agent).set(name, dispose);
			} catch (err) {
				console.warn(`[session-settings] [SKILL-POLICY] Failed to shadow skill "${name}":`, err instanceof Error ? err.message : String(err));
			}
		}
	}
	/**
	* Load one skill exactly as the agent would resolve it.
	*
	* An Agent's scope key is the Agent itself (`@deepseek-ai/dsh-scope`'s
	* `createScope(loopCtx, agent)`), and the registry resolves the scope chain
	* from that key, so passing the agent yields the nearest-wins view the model
	* would see. The agent's own layer was cleared immediately before this call.
	*/
	async loadAsAgentSeesIt(agent, name) {
		const registry = this.ctx.get("skills");
		if (typeof registry?.get !== "function") return void 0;
		const cwd = agent.session?.header?.cwd;
		try {
			return await registry.get(name, {
				cwd,
				scope: agent
			});
		} catch {
			return;
		}
	}
	mapFor(agent) {
		let map = this.installed.get(agent);
		if (!map) {
			map = /* @__PURE__ */ new Map();
			this.installed.set(agent, map);
		}
		return map;
	}
	clear(agent) {
		const map = this.installed.get(agent);
		if (!map) return;
		for (const dispose of map.values()) try {
			dispose();
		} catch {}
		map.clear();
	}
};
//#endregion
//#region lib/types/server/skills/interceptor.js
/**
* Wire per-session skill invocation policy onto each agent's scope.
*
* This replaces the former approach of overwriting `snapshot()`/`get()` on the
* shared service instance. Enforcement now rides the skill registry's own
* layered registrations: a same-name runtime skill registered through
* `agent.ctx` shadows the inherited declaration for that agent alone, and
* `@deepseek-ai/dsh-tool-skill` already refuses a skill whose
* `invocation.modelInvocable` is false. The execution-time guard is therefore
* no longer needed — the registry reports the skill as unavailable.
*
* `agent/created` is serial and holds queued input until every listener settles,
* so a shadow exists before the agent's first catalog read. A listener that
* throws FAILS agent creation, hence the blanket try/catch.
*/
function registerSkillsInterceptors(ctx, getSessionSettingsStore) {
	const projection = new SkillPolicyProjection(ctx, getSessionSettingsStore);
	ctx.on("agent/created", async ({ agent }) => {
		try {
			await projection.applyToAgent(agent);
		} catch (err) {
			console.warn("[session-settings] [SKILL-POLICY] Failed to install skill policy for agent; continuing without it:", err instanceof Error ? err.message : String(err));
		}
	});
	ctx.on("agent/disposed", ({ agent }) => {
		try {
			projection.forget(agent);
		} catch {}
	});
	return projection;
}
//#endregion
//#region lib/types/server/sandbox/paths.js
/**
* Turning user-spelled allowed directories into the absolute paths an
* enforcement layer can compare.
*
* Two rules shape everything here:
*
* 1. **Spelling is the user's, comparison is absolute.** `.` means the session
*    workspace and `~` means the host home directory, because those are the
*    spellings someone reaches for; the provider only ever receives resolved
*    absolute paths.
* 2. **A root that does not exist is dropped, never passed through.** This is
*    the load-bearing one. Passing a missing root is harmless under Landlock
*    (it simply matches nothing) but FATAL under `bwrap`, whose `--bind` refuses
*    to build the profile at all — one stale cache path would fail every command
*    in the session with an error that reads nothing like a sandbox problem.
*    Dropping it keeps the failure local to the rule that caused it.
*
* @module session-settings/sandbox/paths
*/
/** Longest normalized path accepted; longer values cannot be real on any supported host. */
const MAX_PATH_CHARS = 4096;
/**
* Expand a leading `~` to the host home directory.
*
* Only a bare `~` or a `~/` prefix expands. `~user` is deliberately left alone:
* resolving another account's home would grant a path the configuring user did
* not necessarily mean, and returning it unresolved is the safe direction.
*
* @param raw - the configured path.
* @param home - the home directory to expand to.
* @returns the path with a leading `~` expanded.
*/
function expandHome(raw, home) {
	if (raw === "~") return home;
	if (raw.startsWith("~/")) return path.join(home, raw.slice(2));
	return raw;
}
/**
* Resolve one configured path to an absolute directory, or say why not.
*
* Relative paths resolve against the session workspace, which is what makes `.`
* mean "the workspace root" and `./vendor` mean one directory inside it.
*
* @param raw - the configured path.
* @param workspaceRoot - absolute session workspace, the base for relative paths.
* @param home - absolute home directory for `~` expansion.
* @returns the absolute path, or a rejection reason.
*/
function resolveAllowPath(raw, workspaceRoot, home) {
	const trimmed = raw.trim();
	if (!trimmed) return {
		ok: false,
		reason: "empty path"
	};
	if (trimmed.length > MAX_PATH_CHARS) return {
		ok: false,
		reason: "path is too long"
	};
	const expanded = expandHome(trimmed, home);
	return {
		ok: true,
		path: path.resolve(workspaceRoot, expanded)
	};
}
/**
* Resolve every configured entry for one session.
*
* Entries are deduplicated by resolved path: two spellings of one directory are
* one grant, and the first description wins so the text a user wrote against
* the entry they consider canonical is the one the model reads.
*
* @param entries - the configured allow list for the effective scope.
* @param workspaceRoot - absolute session workspace.
* @param home - absolute home directory; defaults to the process home.
* @returns the grantable roots and the rejected entries, both in configured order.
*/
function resolveAllowSet(entries, workspaceRoot, home = os.homedir()) {
	const roots = [];
	const rejected = [];
	const seen = /* @__PURE__ */ new Set();
	for (const entry of entries) {
		const resolved = resolveAllowPath(entry.path, workspaceRoot, home);
		if (!resolved.ok) {
			rejected.push({
				path: entry.path,
				reason: resolved.reason
			});
			continue;
		}
		if (seen.has(resolved.path)) continue;
		let stats;
		try {
			stats = fs.statSync(resolved.path);
		} catch {
			rejected.push({
				path: entry.path,
				reason: "directory does not exist"
			});
			continue;
		}
		if (!stats.isDirectory()) {
			rejected.push({
				path: entry.path,
				reason: "not a directory"
			});
			continue;
		}
		seen.add(resolved.path);
		roots.push({
			path: resolved.path,
			...entry.description ? { description: entry.description } : {}
		});
	}
	return {
		roots,
		rejected
	};
}
//#endregion
//#region lib/types/server/sandbox/fs-proxy.js
/**
* Find the mutation implementations that skip the sandbox fence.
*
* The fenced provider declares both methods on its own prototype; the next
* prototype up is the plain local implementation. Only a method that actually
* differs from the fenced one is accepted, so a provider that does NOT layer
* (and therefore has no unfenced variant) reports nothing instead of handing
* back the same fenced function under a different name.
*
* @param fs - the mounted filesystem provider.
* @returns whichever unfenced mutations exist.
*/
function findUnfencedMutations(fs) {
	const own = Object.getPrototypeOf(fs);
	const parent = own ? Object.getPrototypeOf(own) : null;
	if (!own || !parent) return {};
	const found = {};
	for (const name of ["writeText", "editText"]) {
		const fenced = own[name];
		const unfenced = parent[name];
		if (typeof unfenced === "function" && unfenced !== fenced) found[name] = unfenced;
	}
	return found;
}
/** One mutation's wrapper, bound to the interceptor's resolved roots. */
var SandboxFsProxy = class {
	ctx;
	interceptor;
	/** The provider whose methods were replaced; the restore target. */
	patchedFs;
	/** Installed wrappers, retained by identity for the restore check. */
	wrappers = /* @__PURE__ */ new Map();
	/** Whether the unfenced implementations were found (reported once). */
	unfencedAvailable = false;
	constructor(ctx, interceptor) {
		this.ctx = ctx;
		this.interceptor = interceptor;
	}
	/**
	* Install the two mutation wrappers.
	*
	* Deferred through `ctx.inject(['fs'], …)` for the same reason the `confine`
	* wrapper is: this plugin's `apply` runs before the composition's rows have
	* necessarily activated, so a synchronous `ctx.get('fs')` here would find
	* nothing. See {@link SandboxInterceptor.start}.
	*/
	start() {
		this.ctx.inject(["fs"], (scope) => {
			const fs = scope.get("fs");
			if (!fs || typeof fs.writeText !== "function") return;
			const unfenced = findUnfencedMutations(fs);
			this.unfencedAvailable = typeof unfenced.writeText === "function" || typeof unfenced.editText === "function";
			this.patchedFs = fs;
			for (const name of ["writeText", "editText"]) {
				const original = fs[name].bind(fs);
				const wrapper = ((...args) => this.mutate(name, original, unfenced, args));
				this.wrappers.set(name, wrapper);
				fs[name] = wrapper;
			}
			scope.effect(() => () => this.restore(), "session-settings: sandbox fs proxy");
		});
	}
	/** Whether the unfenced delegation target was found (for diagnostics). */
	get canBypassFence() {
		return this.unfencedAvailable;
	}
	/**
	* Re-fence one mutation.
	*
	* The decision logic is separated from the acting logic on purpose: only
	* DECIDING whether to lift the fence is guarded, and a failure there falls
	* back to the host (the behavior this proxy replaced, so the host's own
	* refusal is the worst case). The delegated write itself is NOT inside that
	* guard — an error it raises is the host's legitimate verdict
	* (`FS_STALE_VERSION`, `FS_NOT_REGULAR_FILE`, an abort) and must reach the
	* caller intact rather than being rewritten into a policy denial.
	*/
	async mutate(name, original, unfenced, args) {
		const target = args[0];
		const policy = args[4];
		if (!target || !policy || policy.mode !== "workspace-write") return original(...args);
		let delegate;
		try {
			const roots = await this.interceptor.rootsFor(policy);
			if (roots.length > 0 && await this.matchRoot(roots, target)) {
				const candidate = unfenced[name];
				if (typeof candidate === "function") delegate = candidate;
			}
		} catch (error) {
			console.warn("[session-settings] [SANDBOX-ALLOW] Filesystem allow-list check failed; deferring to the host fence:", error instanceof Error ? error.message : String(error));
		}
		if (!delegate) return original(...args);
		return delegate.apply(this.patchedFs, args);
	}
	/**
	* Whether the target sits under any granted root.
	*
	* Containment is asked of the provider (`contains`) instead of comparing
	* strings, so the answer stays correct on a case-insensitive or alias-bearing
	* host filesystem, and for backends whose `displayPath` is not a host path.
	* A root that cannot be resolved (a directory removed since the settings were
	* read) simply does not match.
	*
	* @param roots - the session's resolved extra directories.
	* @param target - the resolved mutation target.
	* @returns the matching root, or undefined.
	*/
	async matchRoot(roots, target) {
		const fs = this.patchedFs;
		if (!fs) return void 0;
		for (const root of roots) {
			let parent;
			try {
				parent = await fs.resolve(root.path);
			} catch {
				continue;
			}
			try {
				if (fs.contains(parent, target)) return root;
			} catch {
				continue;
			}
		}
	}
	/**
	* Remove this proxy's wrappers.
	*
	* Unconditional once a patch was installed, for the same reason the
	* `confine` restore is: `ctx.get('fs')` yields a traced Proxy whose function
	* reads produce a fresh shadow wrapper each time, so "is the live method
	* still ours?" cannot be decided by comparison. The recorded wrappers serve
	* only as the signal that a patch exists to remove.
	*/
	restore() {
		const fs = this.patchedFs;
		if (fs && this.wrappers.size > 0) for (const name of ["writeText", "editText"]) delete fs[name];
		this.wrappers.clear();
		this.patchedFs = void 0;
	}
};
//#endregion
//#region lib/types/server/sandbox/interceptor.js
/**
* Widening the provider's write grants with the session's configured extra
* directories, and telling the model what it was given.
*
* ## Why `confine` and not the policy resolver
*
* The extra roots ultimately have to appear as ARGUMENTS in the argv the
* provider returns, and `ctx.sandbox.confine()` is the one seam that produces
* exactly that. Two properties make it the right cut:
*
* - **It is per call.** The provider's `runnerCommand` config is a
*   deployment-time field: changing it needs a plugin reload and disqualifies
*   the functional probes, so it cannot carry a per-session list. `confine` is
*   invoked per execution and can.
* - **It carries the caller's identity.** The `policy` argument already holds
*   the branded `sessionId` that `sandboxPolicy.resolve()` stamped on it, so
*   this module never has to reconstruct which session is asking. That is why
*   the extra roots need no session event: only the prompt text does.
*
* The cost is that `confine` is a live service method, not a documented
* extension point — `confine` is patched on the instance and the original is
* restored on unload. {@link SandboxInterceptor.detectCapability} exists so a
* DSH release that reshapes it degrades to "no extra roots, and the UI says so"
* rather than to a silent no-op.
*
* ## Append grammar differs per backend
*
* Each backend expresses a grant its own way, and the selected one is only
* knowable from the argv that came back:
*
* | backend  | argv[0]                    | appended form                |
* |----------|----------------------------|------------------------------|
* | landlock | `…/landlock-run`           | `--rw <path>`                |
* | bwrap    | `bwrap`                    | `--bind <path> <path>`       |
* | seatbelt | `sandbox-exec`             | not expressible (see below)  |
*
* Seatbelt's profile is a single SBPL string passed to `-p`; extending it means
* rewriting that string, which is a different (and much larger) change. The
* capability report says so instead of pretending.
*
* Every addition goes BEFORE the `--` separator, since anything after it is
* argv for the wrapped command.
*
* @module session-settings/sandbox/interceptor
*/
/** Separator between the runner's own arguments and the wrapped command. */
const ARGV_SEPARATOR = "--";
/** Identify the backend from the program the provider chose, or `undefined`. */
function backendOf(argv) {
	const program = argv[0];
	if (!program) return void 0;
	const base = path.basename(program).toLowerCase();
	if (base === "bwrap" || base.startsWith("bwrap")) return "bwrap";
	if (base === "sandbox-exec" || base.startsWith("sandbox-exec")) return "seatbelt";
	if (base === "landlock-run" || base.includes("landlock")) return "landlock";
	if (base.includes("windows-acl") || base.includes("acl-run")) return "windows-acl";
}
/**
* Insert grant arguments for `roots` into a confined argv.
*
* Returns the argv unchanged when the backend cannot express them, so the
* caller's confinement stays exactly as the provider produced it.
*
* @param argv - the argv the provider returned.
* @param roots - absolute directories to add to the write grant.
* @returns the widened argv, or the original when nothing can be added.
*/
function withExtraRoots(argv, roots) {
	const backend = backendOf(argv);
	if (backend !== "landlock" && backend !== "bwrap") return {
		argv,
		applied: "landlock",
		...backend ? { skippedBackend: backend } : {}
	};
	const separator = argv.lastIndexOf(ARGV_SEPARATOR);
	if (separator < 0) return {
		argv,
		applied: "landlock"
	};
	const extra = backend === "bwrap" ? roots.flatMap((root) => [
		"--bind",
		root.path,
		root.path
	]) : roots.flatMap((root) => ["--rw", root.path]);
	return {
		argv: [
			...argv.slice(0, separator),
			...extra,
			...argv.slice(separator)
		],
		applied: backend
	};
}
/**
* Owns the `confine` widening, the per-session resolution cache, and the
* capability report the settings UI reads.
*/
var SandboxInterceptor = class {
	ctx;
	getSessionSettingsStore;
	/** The provider whose `confine` was replaced; the restore target. */
	patchedProvider;
	/**
	* The wrapper installed on the provider, or `undefined` before installation.
	*
	* Kept for the restore path (the patch may only be removed while this exact
	* value is still live). It is deliberately NOT used to decide capability:
	* cordis hands back a fresh shadow wrapper for every function read through a
	* service Proxy, so an identity check against it can never succeed.
	*/
	wrapper;
	/**
	* Whether this interceptor's `confine` wrapper is installed and live.
	*
	* The honest capability signal. It is cleared by {@link restore} — including
	* the restore that a scope disposal triggers — so a reload or unload that
	* removes the patch also removes the claim, rather than reporting a
	* capability nothing implements.
	*/
	installed = false;
	/**
	* Why the `confine` wrapper is not installed, when it is not.
	*
	* Distinguishes "the provider has not activated yet" from "the provider
	* cannot be extended", so {@link detectCapability} can report which one the
	* user is actually looking at instead of collapsing both into "unsupported".
	*/
	patchFailure;
	/** The backend the argv identified at the last wrap, for diagnostics. */
	observedBackend;
	/**
	* sessionId -> resolved roots. Keyed by the ROOT session, so a child inherits
	* its parent's grants without a second lookup.
	*/
	cache = /* @__PURE__ */ new Map();
	/** sessionId -> the workspace its roots were resolved against. */
	cacheWorkspace = /* @__PURE__ */ new Map();
	/** Configured entries dropped at the last resolution, by session. */
	skipped = /* @__PURE__ */ new Map();
	/** Guards the one-time degradation warning so a per-call path cannot spam it. */
	backendWarningEmitted = false;
	constructor(ctx, getSessionSettingsStore) {
		this.ctx = ctx;
		this.getSessionSettingsStore = getSessionSettingsStore;
	}
	/**
	* Install the `confine` widening and the prompt contribution.
	*
	* Two facts about cordis shape this method, and each one silently produced
	* "the UI says unsupported" when ignored:
	*
	* 1. **The widening must be installed through `ctx.inject(['sandbox'], …)`.**
	*    `apply` runs once when this plugin loads, and the base bundle states that
	*    COMPOSITION ROW ORDER CARRIES NO LOAD SEMANTICS — a row activates when
	*    its own services become available. A synchronous `ctx.get('sandbox')` in
	*    `apply` therefore returns `undefined` whenever the sandbox row activates
	*    later, leaving every configured directory unenforced.
	*
	* 2. **The patch is installed once, on the service object.** `ctx.get(name)`
	*    returns a traced Proxy, and reading a FUNCTION property through it hands
	*    back a fresh shadow wrapper on every access. The write still forwards to
	*    the one shared target (verified: a consumer's later `ctx.get` observes
	*    it), but an identity comparison against a previously-read function can
	*    never hold — hence {@link installed} rather than a live-function check.
	*
	* A composition with no sandbox provider never fires the callback; the
	* capability report then says so, which is correct rather than degraded.
	*/
	start() {
		this.ctx.inject(["sandbox"], (scope) => {
			const provider = scope.get("sandbox");
			if (!provider || typeof provider.confine !== "function") {
				this.patchFailure = "The mounted sandbox service exposes no confine() method.";
				return;
			}
			const bound = provider.confine.bind(provider);
			this.patchedProvider = provider;
			this.patchFailure = void 0;
			const wrapper = (argv, policy, signal) => this.confined(bound, argv, policy, signal);
			this.wrapper = wrapper;
			this.installed = true;
			provider.confine = wrapper;
			scope.effect(() => () => this.restore(), "session-settings: sandbox confine wrapper");
		});
		this.registerPromptSection();
	}
	/**
	* What the mounted backend can do, for the settings UI.
	*
	* The test is whether THIS interceptor's wrapper is still the function the
	* provider will call — not whether a patch was applied at some point. A
	* plugin reload or an HMR swap can replace the provider behind the plugin's
	* back, and a stored "patched" flag would keep claiming a capability nothing
	* implements. Comparing the live function is the only check that stays true.
	*
	* Reports WHICH failure it is: a provider that has not activated yet is a
	* different fact from one that cannot be extended, and collapsing them into
	* one "unsupported" message is what made the first diagnosis hard.
	*
	* Deliberately never forces a runner probe, so a client reading it cannot
	* itself make the deployment select a backend.
	*/
	detectCapability(sessionId) {
		const mode = this.effectiveModeFor(sessionId);
		const withMode = mode ? { effectiveMode: mode } : {};
		const provider = this.ctx.get("sandbox");
		if (!provider || typeof provider.confine !== "function") return {
			canAllowExtraRoots: false,
			reason: this.patchFailure ?? "No sandbox provider is mounted in this composition, so extra directories cannot take effect.",
			...withMode
		};
		if (!this.installed) return {
			canAllowExtraRoots: false,
			reason: this.patchFailure ?? "The sandbox provider has not been extended by this plugin, so extra directories would not take effect.",
			...withMode
		};
		return {
			canAllowExtraRoots: true,
			...this.observedBackend ? { backend: this.observedBackend } : {},
			...withMode
		};
	}
	/**
	* The session's effective file-effect mode, or `undefined` when unknown.
	*
	* Read from the host's policy owner — the session's `sandbox/mode` projection
	* is host state the browser cannot see. A missing session (a New-Session page)
	* falls back to the deployment default, which is what such a session would
	* actually start from.
	*
	* @param sessionId - the session whose mode is asked for.
	* @returns the mode, or undefined when no policy service is mounted.
	*/
	effectiveModeFor(sessionId) {
		const policy = this.ctx.get("sandboxPolicy");
		if (!policy) return void 0;
		const session = sessionId ? this.ctx.get("sessions")?.get?.(sessionId) : void 0;
		if (!session) return policy.defaultMode;
		try {
			return policy.overrideOf(session) ?? policy.defaultMode;
		} catch {
			return policy.defaultMode;
		}
	}
	/** Configured entries skipped at the last resolution for one session. */
	skippedFor(sessionId) {
		if (!sessionId) return [];
		return this.skipped.get(sessionId) ?? [];
	}
	/** Drop every cached resolution; the next call re-reads the settings store. */
	notifyPolicyChanged() {
		this.cache.clear();
		this.cacheWorkspace.clear();
		this.skipped.clear();
	}
	/**
	* Restore the provider's own `confine`.
	*
	* `confine` is a prototype method, so the patch is an own property shadowing
	* it and removal is a `delete` — assigning the bound original back would leave
	* an own property that outlives the plugin.
	*
	* The removal is deliberately unconditional once the interceptor owns a
	* patch. A cordis service Proxy hands back a fresh shadow wrapper for every
	* function read, so "is the live `confine` still ours?" cannot be answered by
	* comparison, and a guarded delete would silently skip the cleanup. The
	* retained {@link wrapper} is instead used only as the signal that a patch
	* was ever installed.
	*/
	restore() {
		const provider = this.patchedProvider;
		if (provider && this.wrapper) delete provider.confine;
		this.wrapper = void 0;
		this.installed = false;
		this.patchedProvider = void 0;
	}
	/** Wrap one `confine` call with the caller's extra roots. */
	async confined(original, argv, policy, signal) {
		const result = await original(argv, policy, signal);
		try {
			const roots = await this.rootsFor(policy);
			if (roots.length === 0) return result;
			const widened = withExtraRoots(result.argv, roots);
			if (widened.skippedBackend) {
				this.warnUnsupportedBackend(widened.skippedBackend);
				return result;
			}
			this.observedBackend = widened.applied;
			return {
				...result,
				argv: widened.argv
			};
		} catch (error) {
			console.warn("[session-settings] [SANDBOX-ALLOW] Failed to widen the sandbox grants; running under the provider's own policy:", error instanceof Error ? error.message : String(error));
			return result;
		}
	}
	/**
	* The resolved extra roots for the session a call belongs to.
	*
	* Shared with the filesystem proxy so both enforcement sides resolve from one
	* cache: a second resolution path could answer differently and produce the
	* very "bash writes it but the write tool cannot" split this module exists to
	* remove.
	*
	* @param policy - the per-call policy whose session names the settings scope.
	* @returns the resolved, existing directories granted to that session.
	*/
	async rootsFor(policy) {
		const sessionId = policy.sessionId;
		if (sessionId === void 0) return [];
		const cached = this.cache.get(sessionId);
		if (cached) return cached;
		const workspaceId = await resolveWorkspaceForSession(this.ctx, sessionId);
		const workspaceRoot = policy.workspaceRoot;
		const { allow } = resolveEffectiveSandbox(this.getSessionSettingsStore(), sessionId, workspaceId);
		const { roots, rejected } = resolveAllowSet(allow, workspaceRoot, os.homedir());
		this.cacheWorkspace.set(sessionId, workspaceId);
		this.cache.set(sessionId, roots);
		this.skipped.set(sessionId, rejected.map((entry) => ({
			path: entry.path,
			reason: entry.reason
		})));
		return roots;
	}
	/**
	* Report the appended-root refusal once per backend.
	*
	* A per-call warning would drown the log; silence would let a macOS user
	* believe a saved grant is in force. Once per backend is the honest middle.
	*/
	warnUnsupportedBackend(backend) {
		if (this.backendWarningEmitted) return;
		this.backendWarningEmitted = true;
		console.warn(`[session-settings] [SANDBOX-ALLOW] The selected sandbox backend ("${backend}") cannot accept extra writable directories; configured allow entries are not applied on this host.`);
	}
	/**
	* Contribute the granted directories to the model's runtime context.
	*
	* Registered as its OWN context entry immediately after the host's
	* `sandbox:policy` rather than by editing that text: the host's section is
	* written by `@deepseek-ai/dsh-sandbox-policy` and is not ours to reword, and
	* an appended entry keeps the mode statement and the grants stated
	* separately, which is how they are actually decided.
	*/
	registerPromptSection() {
		this.ctx.inject(["systemPrompt"], (scope) => {
			const systemPrompt = scope.get("systemPrompt");
			if (!systemPrompt || typeof systemPrompt.context !== "function") return;
			const order = typeof systemPrompt.getContextOrder === "function" ? systemPrompt.getContextOrder("SANDBOX_POLICY") + 1 : void 0;
			scope.effect(() => {
				const dispose = systemPrompt.context({
					name: "session-settings:sandbox-allow",
					...order === void 0 ? {} : { order },
					text: (context) => {
						const agent = context?.agent;
						const sessionId = resolveAgentSessionId(agent, this.ctx);
						if (!sessionId) return "";
						const roots = this.cache.get(sessionId);
						if (!roots || roots.length === 0) return "";
						return renderAllowContext(roots);
					}
				});
				return () => dispose();
			}, "session-settings: sandbox allow context");
		});
	}
};
/**
* Render the granted-directory paragraph.
*
* Mirrors the host's own `sandbox:policy` wording so the two read as one
* policy statement: the paths are JSON-quoted for the same reason, and the
* sentence that keeps the boundary honest — everything else outside the
* workspace stays unwritable — is stated rather than implied, because a list of
* grants with no boundary invites the model to treat them as the whole rule.
*
* @param roots - resolved, existing directories.
* @returns the context text, or an empty string when there is nothing to say.
*/
function renderAllowContext(roots) {
	if (roots.length === 0) return "";
	return [
		"This session is additionally allowed to write these directories outside the session workspace:",
		...roots.map((root) => root.description ? `- ${JSON.stringify(root.path)} — ${root.description}` : `- ${JSON.stringify(root.path)}`),
		"Every other location outside the session workspace remains read-only; a denied write reports the sandbox denial marker."
	].join("\n");
}
/**
* Wire the sandbox allow-list onto the runtime.
*
* @param ctx - the plugin context.
* @param getSessionSettingsStore - lazily loaded settings store accessor.
* @returns the interceptor, so callers can invalidate its cache after a save.
*/
function registerSandboxInterceptor(ctx, getSessionSettingsStore) {
	const interceptor = new SandboxInterceptor(ctx, getSessionSettingsStore);
	interceptor.start();
	const fsProxy = new SandboxFsProxy(ctx, interceptor);
	fsProxy.start();
	ctx.effect(() => () => {
		interceptor.notifyPolicyChanged();
		fsProxy.restore();
		interceptor.restore();
	}, "session-settings: sandbox allow interceptor");
	return interceptor;
}
//#endregion
//#region lib/types/server/index.js
const name = "session-settings";
const inject = ["connection", "loader"];
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
	const mcpPolicyProjection = registerMcpPolicyProjection(ctx, getSessionSettingsStore, getMcpStore, mcpManager);
	const sandboxInterceptor = registerSandboxInterceptor(ctx, getSessionSettingsStore);
	const invalidatePolicies = () => {
		mcpPolicyProjection.notifyPolicyChanged();
		sandboxInterceptor.notifyPolicyChanged();
	};
	const connection = ctx.get("connection");
	if (connection) {
		const unregisterMcp = registerMcpRoutes(connection, getMcpStore, setMcpStore, mcpManager, getSessionSettingsStore, setSessionSettingsStore, invalidatePolicies);
		const unregisterSessionSettings = registerSessionSettingsRoutes(ctx, connection, getSessionSettingsStore, setSessionSettingsStore, mcpManager, invalidatePolicies, (sessionId) => sandboxInterceptor.detectCapability(sessionId), (sessionId) => sandboxInterceptor.skippedFor(sessionId));
		const unregisterSkills = registerSkillsRoutes(ctx, connection, getSessionSettingsStore);
		ctx.effect(() => {
			return async () => {
				await unregisterMcp();
				await unregisterSessionSettings();
				await unregisterSkills();
			};
		}, "session-settings: authenticated api routes");
	}
	ctx.effect(() => {
		return () => mcpManager.dispose();
	}, "session-settings: mcpManager");
	registerSubagentModelInterceptor(ctx, getSessionSettingsStore);
	registerSkillsInterceptors(ctx, getSessionSettingsStore);
}
//#endregion
export { API_ENDPOINTS, API_METHODS, McpManager, SETTINGS_SCOPE_IDS, SandboxFsProxy, SandboxInterceptor, apply, badRequest, collectDiscovery, connectMcpServer, getAvailableSkills, getMcpStoragePath, getPrompt, getSessionSettingsStoragePath, getSkillDetail, inject, isSettingsScopeId, jsonResponse, loadMcpStore, loadSessionSettingsStore, name, normalizeGlobalSettings, normalizeSessionSettings, publicToolName, readJsonBody, readResource, registerMcpPolicyProjection, registerMcpRoutes, registerSandboxInterceptor, registerSessionSettingsRoutes, registerSkillsInterceptors, registerSkillsRoutes, registerSubagentModelInterceptor, renameServerIdInSessionStore, renderAllowContext, requestQuery, resolveAllowPath, resolveAllowSet, resolveEffectiveMcp, resolveEffectiveSandbox, resolveEffectiveSkills, resolveEffectiveSubagentModel, saveMcpStore, saveSessionSettingsStore, testHttpConnection, testMcpConnection, testStdioConnection, toFetchRoute };
