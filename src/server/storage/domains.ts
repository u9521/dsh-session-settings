import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import type {
  GlobalMcpServerConfig,
  McpServerStore,
  SandboxTemplate,
  SandboxTemplateStore,
  SessionSettingsConfig,
  SessionSettingsStore,
  StorageDomainSpec,
} from '../../types.ts'
import {
  normalizeGlobalSettings,
  normalizeSessionSettings,
} from '../session/storage.ts'

/**
 * The configuration stores, declared as storage domains.
 *
 * The settings and MCP stores used to be hand-written files: build a path,
 * `mkdir` lazily, parse the whole document, rewrite it through tmp+rename. The
 * host already mounts a
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

/**
 * The host's own name grammar for a storage unit or table.
 *
 * Copied, not imported: this half is bundled on its own and resolves no host
 * package at runtime, so `@deepseek-ai/dsh-storage-domain` is only available as
 * types. {@link defineDomain} below restates the host's checks against this
 * pattern, which is the part that can fail.
 */
const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/

/**
 * Validate one domain declaration at module load.
 *
 * Mirrors `defineDomain()` from `@deepseek-ai/dsh-storage-domain`, which is what
 * a host-owned consumer calls. That helper's value is TIMING: a name typo, a
 * bad version, or a global schema that accepts `null` (the medium's "never
 * written" sentinel) throws while this module is being loaded, instead of
 * surfacing from `open()` later as a storage failure that reads like data
 * corruption.
 *
 * @param spec - the declaration to check.
 * @returns the same declaration.
 */
function defineDomain(spec: StorageDomainSpec): StorageDomainSpec {
  if (!UNIT_NAME_RE.test(spec.name)) {
    throw new Error(`domain name '${spec.name}' must match ${UNIT_NAME_RE}`)
  }
  if (!Number.isInteger(spec.version) || spec.version < 0) {
    throw new Error(
      `domain '${spec.name}' version must be a non-negative integer, got ${spec.version}`,
    )
  }
  for (const compat of spec.compatibleVersions ?? []) {
    if (!Number.isInteger(compat) || compat < 0 || compat >= spec.version) {
      throw new Error(
        `domain '${spec.name}' compatibleVersions entries must be non-negative integers below version ${spec.version}, got ${compat}`,
      )
    }
  }
  if (
    spec.layout !== undefined &&
    spec.layout !== 'single' &&
    spec.layout !== 'per-record'
  ) {
    throw new Error(
      `domain '${spec.name}' layout must be 'single' or 'per-record', got ${String(spec.layout)}`,
    )
  }
  for (const table of Object.keys(spec.tables)) {
    if (!UNIT_NAME_RE.test(table)) {
      throw new Error(
        `domain '${spec.name}' table name '${table}' must match ${UNIT_NAME_RE}`,
      )
    }
  }
  const globalSchema = spec.global?.schema as
    { safeParse?: (value: unknown) => { success: boolean } } | undefined
  if (globalSchema && globalSchema.safeParse?.(null).success) {
    throw new Error(
      `domain '${spec.name}' global schema must not accept null: null is the medium's "never written" sentinel, so a stored null could not round-trip`,
    )
  }
  return spec
}

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
const sessionSettingsSpec: StorageDomainSpec = defineDomain({
  name: 'session_settings',
  version: 1,
  layout: 'single',
  global: { schema: settingsRecord, initial: {} },
  tables: {
    sessions: { valueSchema: settingsRecord },
    workspaces: { valueSchema: settingsRecord },
  },
})

/** The MCP server store. */
const mcpServersSpec: StorageDomainSpec = defineDomain({
  name: 'mcp_servers',
  version: 1,
  layout: 'single',
  tables: {
    servers: { valueSchema: mcpServerRecord },
  },
})

/**
 * One user-authored sandbox preset.
 *
 * Loose like the other records: the schema checks the fields this plugin reads
 * and keeps anything else, so an older or newer record never loses data on a
 * read/write cycle.
 */
const sandboxTemplateRecord = z.looseObject({
  id: z.string(),
  name: z.string(),
  entries: z.array(z.record(z.string(), z.unknown())),
  createdAt: z.number().optional(),
})

/**
 * The sandbox panel's user-authored presets.
 *
 * A third domain rather than a corner of the settings document: these are
 * shared by every session and edited outside the scope ladder, so storing them
 * in any one scope's config would make their owner ambiguous the moment a save
 * ran under that scope.
 */
const sandboxTemplatesSpec: StorageDomainSpec = defineDomain({
  name: 'sandbox_templates',
  version: 1,
  layout: 'single',
  tables: {
    templates: { valueSchema: sandboxTemplateRecord },
  },
})

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
  sandboxTemplates: SandboxTemplateStore
  /** Persist whatever changed since the last flush. */
  persistSessionSettings: () => Promise<void>
  persistMcpServers: () => Promise<void>
  persistSandboxTemplates: () => Promise<void>
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

  const settingsDomain = await facility.open(sessionSettingsSpec)
  const mcpDomain = await facility.open(mcpServersSpec)
  const templateDomain = await facility.open(sandboxTemplatesSpec)
  ctx.effect(
    () => () => {
      void settingsDomain.close()
      void mcpDomain.close()
      void templateDomain.close()
    },
    'session-settings: config domains',
  )

  const sessionTable = settingsDomain.table<SessionSettingsConfig>('sessions')
  const workspaceTable =
    settingsDomain.table<SessionSettingsConfig>('workspaces')
  const serverTable = mcpDomain.table<GlobalMcpServerConfig>('servers')
  const templateTable = templateDomain.table<SandboxTemplate>('templates')

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

  const readSandboxTemplates = (): SandboxTemplateStore => {
    const store: SandboxTemplateStore = { templates: {} }
    for (const [id, template] of templateTable.entries()) {
      store.templates[id] = template
    }
    return store
  }

  const sessionSettings = readSessionSettings()
  const mcpServers = readMcpServers()
  const sandboxTemplates = readSandboxTemplates()

  // Snapshots of what the medium currently holds, so a flush writes only deltas.
  let persistedSessions = structuredClone(sessionSettings.sessions)
  let persistedWorkspaces = structuredClone(sessionSettings.workspaces ?? {})
  let persistedGlobal = structuredClone(sessionSettings.globalConfig)
  let persistedServers = structuredClone(mcpServers)
  let persistedTemplates = structuredClone(sandboxTemplates)

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

  const persistSandboxTemplates = async (): Promise<void> => {
    const templates = changedKeys(
      persistedTemplates.templates,
      sandboxTemplates.templates,
    )
    for (const [key, value] of templates.put) {
      await templateTable.put(key, value)
    }
    for (const key of templates.drop) await templateTable.delete(key)
    persistedTemplates = structuredClone(sandboxTemplates)
  }

  return {
    sessionSettings,
    mcpServers,
    sandboxTemplates,
    persistSessionSettings,
    persistMcpServers,
    persistSandboxTemplates,
  }
}
