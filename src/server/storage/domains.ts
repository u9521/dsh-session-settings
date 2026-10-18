import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import type {
  GlobalMcpServerConfig,
  McpServerStore,
  SessionSettingsConfig,
  SessionSettingsStore,
  StorageDomainSpec,
} from '../../types.ts'
import {
  normalizeGlobalSettings,
  normalizeSessionSettings,
} from '../session/storage.ts'

/**
 * The two configuration stores, declared as storage domains.
 *
 * Both used to be hand-written files: build a path, `mkdir` lazily, parse the
 * whole document, rewrite it through tmp+rename. The host already mounts a
 * storage hub whose `json` backend roots at `$DSH_HOME/storages` and a domain
 * form on top of it that adds per-record zod validation, a format version, one
 * serialized write chain, and a change event. Declaring the stores here is
 * strictly less code than maintaining that machinery a second time.
 *
 * Record schemas are LOOSE objects on purpose: they check the types of the
 * fields this plugin knows and keep everything else. A strict schema would drop
 * unknown keys on every read, which is exactly the silent data loss the old
 * normalizers already risked.
 */

/** One session or workspace settings entry. */
const settingsRecord = z.looseObject({
  subagentModel: z.record(z.string(), z.unknown()).optional(),
  mcp: z.record(z.string(), z.unknown()).optional(),
  skills: z.record(z.string(), z.unknown()).optional(),
  sandbox: z.record(z.string(), z.unknown()).optional(),
})

/** One MCP server record. */
const mcpServerRecord = z.looseObject({
  id: z.string(),
  name: z.string(),
  transport: z.enum(['stdio', 'streamable-http']),
})

/**
 * Session and workspace settings.
 *
 * `sessions` and `workspaces` are two tables rather than one keyed table so a
 * session id and a workspace id can never collide. The deployment-wide entry
 * rides the domain's global slot.
 */
const sessionSettingsSpec: StorageDomainSpec = {
  name: 'session_settings',
  version: 1,
  layout: 'single',
  global: { schema: settingsRecord, initial: {} },
  tables: {
    sessions: { valueSchema: settingsRecord },
    workspaces: { valueSchema: settingsRecord },
  },
}

/** The MCP server store. */
const mcpServersSpec: StorageDomainSpec = {
  name: 'mcp_servers',
  version: 1,
  layout: 'single',
  tables: {
    servers: { valueSchema: mcpServerRecord },
  },
}

/**
 * The live stores plus the two flush functions.
 *
 * Store OBJECTS are stable for the life of the plugin: the manager, the
 * registry and every projection hold references to them, so a flush mutates the
 * object in place and only the medium is rewritten. Flushes diff against the
 * last persisted snapshot and touch only the records that actually changed —
 * a `single`-layout unit rewrites its whole document per `put`, so writing
 * every record on every save would turn one edit into a dozen file rewrites.
 */
export interface OpenStores {
  sessionSettings: SessionSettingsStore
  mcpServers: McpServerStore
  /** Persist whatever changed since the last flush. */
  persistSessionSettings: () => Promise<void>
  persistMcpServers: () => Promise<void>
}

/** Records whose JSON differs between two snapshots, by key. */
function changedKeys<T>(
  previous: Record<string, T>,
  next: Record<string, T>,
): { put: Array<[string, T]>; drop: string[] } {
  const put: Array<[string, T]> = []
  const drop: string[] = []
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(value)) {
      put.push([key, value])
    }
  }
  for (const key of Object.keys(previous)) {
    if (!(key in next)) drop.push(key)
  }
  return { put, drop }
}

/**
 * Open both domains and hand back the live stores.
 *
 * A domain that cannot open (unparsable medium, version mismatch, a record the
 * schema rejects) rejects here, which fails plugin activation: the alternative
 * is serving half a configuration while believing it is whole.
 *
 * @param ctx - context whose effect closes the domains, and that carries `storageDomain`.
 * @returns the live stores and their flush functions.
 */
export async function openStores(ctx: Context): Promise<OpenStores> {
  const facility = ctx.storageDomain
  if (!facility) {
    throw new Error(
      'session-settings: the host does not provide ctx.storageDomain; cannot mount configuration stores',
    )
  }

  const settingsDomain = await facility.open(sessionSettingsSpec)
  const mcpDomain = await facility.open(mcpServersSpec)
  ctx.effect(
    () => () => {
      void settingsDomain.close()
      void mcpDomain.close()
    },
    'session-settings: config domains',
  )

  const sessionTable = settingsDomain.table<SessionSettingsConfig>('sessions')
  const workspaceTable =
    settingsDomain.table<SessionSettingsConfig>('workspaces')
  const serverTable = mcpDomain.table<GlobalMcpServerConfig>('servers')

  const readSessionSettings = (): SessionSettingsStore => {
    const store: SessionSettingsStore = {
      globalConfig: normalizeGlobalSettings(
        settingsDomain.global.get() as Partial<SessionSettingsConfig>,
      ),
      workspaces: {},
      sessions: {},
    }
    for (const [id, config] of workspaceTable.entries()) {
      store.workspaces![id] = normalizeSessionSettings(config)
    }
    for (const [id, config] of sessionTable.entries()) {
      store.sessions[id] = normalizeSessionSettings(config)
    }
    return store
  }

  const readMcpServers = (): McpServerStore => {
    const store: McpServerStore = { servers: {} }
    for (const [id, config] of serverTable.entries()) {
      store.servers[id] = config
    }
    return store
  }

  const sessionSettings = readSessionSettings()
  const mcpServers = readMcpServers()

  // Snapshots of what the medium currently holds, so a flush writes only deltas.
  let persistedSessions = structuredClone(sessionSettings.sessions)
  let persistedWorkspaces = structuredClone(sessionSettings.workspaces ?? {})
  let persistedGlobal = structuredClone(sessionSettings.globalConfig)
  let persistedServers = structuredClone(mcpServers)

  const persistSessionSettings = async (): Promise<void> => {
    const sessions = changedKeys(persistedSessions, sessionSettings.sessions)
    const workspaces = changedKeys(
      persistedWorkspaces,
      sessionSettings.workspaces ?? {},
    )
    for (const [key, value] of sessions.put) {
      await sessionTable.put(key, value)
    }
    for (const key of sessions.drop) await sessionTable.delete(key)
    for (const [key, value] of workspaces.put) {
      await workspaceTable.put(key, value)
    }
    for (const key of workspaces.drop) await workspaceTable.delete(key)
    if (
      JSON.stringify(persistedGlobal) !==
      JSON.stringify(sessionSettings.globalConfig)
    ) {
      await settingsDomain.global.set(sessionSettings.globalConfig)
    }
    persistedSessions = structuredClone(sessionSettings.sessions)
    persistedWorkspaces = structuredClone(sessionSettings.workspaces ?? {})
    persistedGlobal = structuredClone(sessionSettings.globalConfig)
  }

  const persistMcpServers = async (): Promise<void> => {
    const servers = changedKeys(persistedServers.servers, mcpServers.servers)
    for (const [key, value] of servers.put) {
      await serverTable.put(key, value)
    }
    for (const key of servers.drop) await serverTable.delete(key)
    persistedServers = structuredClone(mcpServers)
  }

  return {
    sessionSettings,
    mcpServers,
    persistSessionSettings,
    persistMcpServers,
  }
}
