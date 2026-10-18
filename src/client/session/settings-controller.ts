import * as React from 'react'
import type {
  ClientPageProps,
  GlobalMcpServerConfig,
  McpProbeResult,
  ModelProviderGroup,
  SandboxCapabilityInfo,
  SandboxSkippedEntry,
  SessionMcpConfig,
  SessionSandboxConfig,
  SessionSettingsConfig,
  SessionSkillsConfig,
  SkillItem,
  SubagentModelConfig,
} from '../types/index.ts'
import { API_ENDPOINTS, API_METHODS } from '../types/index.ts'
import type { SettingsScope } from './sections/HeaderBar.ts'
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_SESSION_SETTINGS,
  isSessionCustomized,
  resolveEffectiveMcp,
  resolveEffectiveSandbox,
  resolveEffectiveSkills,
  resolveEffectiveSubagentModel,
  type SettingsLayers,
} from '../../shared/settings.ts'
import { settingsLayers } from '../utils/config.ts'
import { resolvePageWorkspace } from '../utils/sessionScope.ts'

/** The four config domains a settings page edits. */
export type SettingsDomain = 'subagentModel' | 'mcp' | 'skills' | 'sandbox'

/** A transient message; the controller clears it after {@link NOTICE_MS}. */
export interface SettingsNotice {
  kind: 'success' | 'error'
  message: string
}

/** How long a notice stays before it clears itself. */
const NOTICE_MS = 3000

/** The three scope entries one page holds drafts for. */
type Drafts = {
  session: SessionSettingsConfig
  workspace: SessionSettingsConfig
  global: SessionSettingsConfig
}

/** A session entry that inherits from the workspace. */
const sessionDraft = (): SessionSettingsConfig => ({
  ...DEFAULT_SESSION_SETTINGS,
  subagentModel: { ...DEFAULT_SESSION_SETTINGS.subagentModel },
  mcp: { ...DEFAULT_SESSION_SETTINGS.mcp },
  skills: { ...DEFAULT_SESSION_SETTINGS.skills },
  sandbox: { ...DEFAULT_SESSION_SETTINGS.sandbox },
})

const workspaceDraft = (): SessionSettingsConfig => ({
  subagentModel: { mode: 'global' },
  mcp: { mode: 'global' },
  skills: { mode: 'global' },
  sandbox: { mode: 'global' },
})

const globalDraft = (): SessionSettingsConfig =>
  structuredClone(DEFAULT_GLOBAL_SETTINGS)

/** Read the effective value of one domain from the three layers. */
export function effectiveDomain(
  layers: SettingsLayers,
  domain: SettingsDomain,
):
  | SubagentModelConfig
  | SessionMcpConfig
  | SessionSkillsConfig
  | SessionSandboxConfig {
  switch (domain) {
    case 'subagentModel':
      return resolveEffectiveSubagentModel(layers)
    case 'mcp':
      return resolveEffectiveMcp(layers)
    case 'skills':
      return resolveEffectiveSkills(layers)
    case 'sandbox':
      return resolveEffectiveSandbox(layers)
  }
}

/** The controller's public face: 8 actions/values plus read-only layers. */
export interface SessionSettingsController {
  scope: SettingsScope
  select: (scope: SettingsScope) => void
  draft: (domain: SettingsDomain) => unknown
  update: (domain: SettingsDomain, value: unknown) => void
  effective: (domain: SettingsDomain) => unknown
  save: () => Promise<void>
  reset: () => Promise<void>
  notice: SettingsNotice | null
  /** The three layers, for a panel that must display what it inherits. */
  layers: {
    session?: SessionSettingsConfig
    workspace?: SessionSettingsConfig
    global: SessionSettingsConfig
  }
  saving: boolean
  /** True for two seconds after a successful session-id copy. */
  copiedId: boolean
  copySessionId: () => Promise<void>
  hasSessionOverride: boolean
  sessionScopeAvailable: boolean
  workspaceScopeAvailable: boolean
  /** The session-scope write target, when the page has one. */
  sessionId?: string
  workspaceId?: string
  workspaceTitle?: string
}

/**
 * The session settings controller: drafts, the scope ladder, save, and reset.
 *
 * Everything a page needs to edit settings lives behind eight members. The
 * scope dispatch that used to be repeated per domain in the page and the
 * 37-prop action hook are both gone: a caller names a domain, not a scope.
 */
export function useSessionSettings(
  props: ClientPageProps,
): SessionSettingsController {
  const {
    t,
    sessionId,
    workspaceId: propWorkspaceId,
    workspaceTitle: propWorkspaceTitle,
    useSessions,
    useWorkspaces,
    onSave,
  } = props

  const identitySelector = <T>(state: T): T => state
  const sessionsState = useSessions
    ? (useSessions(identitySelector) as
        { byId?: Record<string, { updatedAt?: number }> } | undefined)
    : undefined
  const workspacesState = useWorkspaces
    ? (useWorkspaces(identitySelector) as
        { items?: Array<Record<string, unknown>> } | undefined)
    : undefined

  const currentWorkspace = React.useMemo(
    () =>
      resolvePageWorkspace({
        sessions: sessionsState as never,
        workspaces: workspacesState as never,
        sessionId,
        workspaceId: propWorkspaceId,
      }),
    [sessionsState, workspacesState, propWorkspaceId, sessionId],
  )

  const workspaceId =
    propWorkspaceId ??
    currentWorkspace?.workspaceId ??
    currentWorkspace?.id ??
    undefined
  const workspaceTitle =
    propWorkspaceTitle ??
    currentWorkspace?.title ??
    currentWorkspace?.name ??
    currentWorkspace?.path ??
    undefined

  const sessionScopeAvailable = Boolean(sessionId)
  const workspaceScopeAvailable = Boolean(workspaceId)

  /** The first usable scope, in preference order. */
  const defaultScope = React.useCallback(
    (): SettingsScope =>
      sessionScopeAvailable
        ? 'session'
        : workspaceScopeAvailable
          ? 'workspace'
          : 'global',
    [sessionScopeAvailable, workspaceScopeAvailable],
  )

  const [scope, setScope] = React.useState<SettingsScope>(defaultScope)
  const chosenByUser = React.useRef(false)

  // Identity arrives a frame late and can disappear (the session was
  // archived). Keep a usable tab selected, but respect the user's own choice
  // for as long as it stays valid.
  React.useEffect(() => {
    const enabled =
      scope === 'session'
        ? sessionScopeAvailable
        : scope === 'workspace'
          ? workspaceScopeAvailable
          : true
    if (chosenByUser.current && enabled) return
    setScope(defaultScope())
  }, [scope, defaultScope, sessionScopeAvailable, workspaceScopeAvailable])

  const select = React.useCallback((next: SettingsScope) => {
    chosenByUser.current = true
    setScope(next)
  }, [])

  const [drafts, setDrafts] = React.useState<Drafts>(() => ({
    session: sessionDraft(),
    workspace: workspaceDraft(),
    global: globalDraft(),
  }))
  const [hasSessionOverride, setHasSessionOverride] =
    React.useState<boolean>(false)
  const [saving, setSaving] = React.useState<boolean>(false)
  const [notice, setNotice] = React.useState<SettingsNotice | null>(null)
  const [copiedId, setCopiedId] = React.useState<boolean>(false)

  const copySessionId = React.useCallback(async () => {
    if (!sessionId) return
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    } catch {
      // A denied clipboard is not worth an error banner; the id stays selectable.
    }
  }, [sessionId])

  // One owner for the expiring notice; every handler just sets it.
  React.useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const layers = React.useMemo(
    () =>
      settingsLayers(
        sessionId ? drafts.session : undefined,
        workspaceId ? drafts.workspace : undefined,
        drafts.global,
      ),
    [drafts, sessionId, workspaceId],
  )

  const draftFor = React.useCallback(
    (domain: SettingsDomain): unknown => {
      const config =
        scope === 'global'
          ? drafts.global
          : scope === 'workspace'
            ? drafts.workspace
            : drafts.session
      return config[domain]
    },
    [drafts, scope],
  )

  const update = React.useCallback(
    (domain: SettingsDomain, value: unknown) => {
      setDrafts((prev) => {
        const target =
          scope === 'global'
            ? prev.global
            : scope === 'workspace'
              ? prev.workspace
              : prev.session
        const next = { ...target, [domain]: value } as SessionSettingsConfig
        return {
          ...prev,
          [scope]: next,
        }
      })
    },
    [scope],
  )

  const effective = React.useCallback(
    (domain: SettingsDomain): unknown => effectiveDomain(layers, domain),
    [layers],
  )

  /** Load the three layers from the host. */
  const load = React.useCallback(async () => {
    const params = new URLSearchParams()
    if (sessionId) params.set('sessionId', sessionId)
    else if (workspaceId) params.set('workspaceId', workspaceId)
    const query = params.toString()
    const url = `${API_ENDPOINTS.getSettings}${query ? `?${query}` : ''}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        setNotice({
          kind: 'error',
          message: t('sessionSettings.notice.error'),
        })
        return
      }
      const data = (await res.json()) as {
        ok?: boolean
        globalConfig?: SessionSettingsConfig
        workspaceConfig?: SessionSettingsConfig
        sessionConfig?: SessionSettingsConfig
        error?: string
      }
      if (!data?.ok) {
        setNotice({
          kind: 'error',
          message:
            t('sessionSettings.notice.error') +
            (data?.error || 'Unknown error'),
        })
        return
      }
      setDrafts({
        session: data.sessionConfig ?? sessionDraft(),
        workspace: data.workspaceConfig ?? workspaceDraft(),
        global: data.globalConfig ?? globalDraft(),
      })
      setHasSessionOverride(isSessionCustomized(data.sessionConfig))
    } catch (err: unknown) {
      // A failed load used to be indistinguishable from "nothing overridden":
      // both left the drafts at their defaults and said nothing.
      setNotice({
        kind: 'error',
        message:
          t('sessionSettings.notice.error') +
          (err instanceof Error ? err.message : String(err)),
      })
    }
  }, [sessionId, workspaceId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  /** The request body for one scope, or the reason it cannot be built. */
  const saveBody = React.useCallback(():
    { body: Record<string, unknown> } | { error: string } => {
    if (scope === 'global') {
      return { body: { scope: 'global', globalConfig: drafts.global } }
    }
    if (scope === 'workspace') {
      if (!workspaceId) {
        return { error: t('sessionSettings.scopeTabs.noWorkspace') }
      }
      return {
        body: {
          scope: 'workspace',
          workspaceId,
          config: drafts.workspace,
        },
      }
    }
    if (!sessionId) {
      return { error: t('sessionSettings.scopeTabs.sessionDisabledHint') }
    }
    return { body: { scope: 'session', sessionId, config: drafts.session } }
  }, [scope, drafts, workspaceId, sessionId, t])

  const post = React.useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(API_ENDPOINTS.saveSettings, {
      method: API_METHODS.saveSettings,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    return { ok: res.ok && Boolean(data?.ok), error: data?.error }
  }, [])

  const save = React.useCallback(async () => {
    setSaving(true)
    try {
      const built = saveBody()
      if ('error' in built) {
        setNotice({ kind: 'error', message: built.error })
        return
      }
      const result = await post(built.body)
      if (!result.ok) {
        setNotice({
          kind: 'error',
          message:
            t('sessionSettings.notice.error') + (result.error || 'Unknown'),
        })
        return
      }

      if (scope === 'session') {
        setHasSessionOverride(isSessionCustomized(drafts.session))
        onSave?.(drafts.session)
      }
      setNotice({
        kind: 'success',
        message:
          scope === 'global'
            ? t('sessionSettings.notice.savedDefault')
            : scope === 'workspace'
              ? t('sessionSettings.notice.savedWorkspace', {
                  name: workspaceTitle || workspaceId || '',
                })
              : t('sessionSettings.notice.saved'),
      })
    } catch (err: unknown) {
      setNotice({
        kind: 'error',
        message:
          t('sessionSettings.notice.error') +
          (err instanceof Error ? err.message : String(err)),
      })
    } finally {
      setSaving(false)
    }
  }, [scope, drafts, post, saveBody, t, onSave, workspaceId, workspaceTitle])

  const reset = React.useCallback(async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { scope, isRestoringDefault: true }
      if (scope === 'workspace') {
        if (!workspaceId) {
          setNotice({
            kind: 'error',
            message: t('sessionSettings.scopeTabs.noWorkspace'),
          })
          return
        }
        body.workspaceId = workspaceId
      } else if (scope === 'session') {
        if (!sessionId) {
          setNotice({
            kind: 'error',
            message: t('sessionSettings.scopeTabs.sessionDisabledHint'),
          })
          return
        }
        body.sessionId = sessionId
      }

      const result = await post(body)
      if (!result.ok) {
        setNotice({
          kind: 'error',
          message:
            t('sessionSettings.notice.error') + (result.error || 'Unknown'),
        })
        return
      }

      // A reset writes the inherited default back into this layer rather than
      // deleting a row the user cannot see; the local draft mirrors that.
      setDrafts((prev) => ({
        ...prev,
        [scope]:
          scope === 'global'
            ? globalDraft()
            : scope === 'workspace'
              ? workspaceDraft()
              : sessionDraft(),
      }))
      if (scope === 'session') setHasSessionOverride(false)
      setNotice({
        kind: 'success',
        message: t('sessionSettings.notice.resetSuccess'),
      })
    } catch (err: unknown) {
      setNotice({
        kind: 'error',
        message:
          t('sessionSettings.notice.error') +
          (err instanceof Error ? err.message : String(err)),
      })
    } finally {
      setSaving(false)
    }
  }, [scope, post, t, sessionId, workspaceId])

  return {
    scope,
    select,
    draft: draftFor,
    update,
    effective,
    save,
    reset,
    notice,
    layers: {
      session: sessionId ? drafts.session : undefined,
      workspace: workspaceId ? drafts.workspace : undefined,
      global: drafts.global,
    },
    saving,
    copiedId,
    copySessionId,
    hasSessionOverride,
    sessionScopeAvailable,
    workspaceScopeAvailable,
    sessionId,
    workspaceId,
    workspaceTitle,
  }
}

/** The catalog data a settings page displays but does not edit. */
export interface SessionCatalogs {
  providers: ModelProviderGroup[]
  loadingModels: boolean
  servers: GlobalMcpServerConfig[]
  reloadServers: () => Promise<void>
  refreshingClientId: string
  clientRefreshResults: Record<string, { ok: boolean; message: string }>
  refreshClient: (server: GlobalMcpServerConfig) => Promise<void>
  skills: SkillItem[]
  reloadSkills: () => Promise<void>
  refreshingSkills: boolean
  sandboxCapability?: SandboxCapabilityInfo
  sandboxSkipped: SandboxSkippedEntry[]
  notice: SettingsNotice | null
  setNotice: (notice: SettingsNotice | null) => void
}

/**
 * The catalog half: model providers, MCP servers, skills, sandbox capability.
 *
 * Separate from the settings controller because these have their own refresh
 * moments (entering the MCP tab, pressing refresh) and never participate in a
 * draft.
 */
export function useSessionCatalogs(
  props: ClientPageProps,
  sessionId: string | undefined,
): SessionCatalogs {
  const { remote, t } = props
  const remoteRef = React.useRef(remote)
  remoteRef.current = remote

  const [providers, setProviders] = React.useState<ModelProviderGroup[]>([])
  const [loadingModels, setLoadingModels] = React.useState<boolean>(false)
  const [servers, setServers] = React.useState<GlobalMcpServerConfig[]>([])
  const [skills, setSkills] = React.useState<SkillItem[]>([])
  const [refreshingSkills, setRefreshingSkills] = React.useState<boolean>(false)
  const [refreshingClientId, setRefreshingClientId] = React.useState<string>('')
  const [clientRefreshResults, setClientRefreshResults] = React.useState<
    Record<string, { ok: boolean; message: string }>
  >({})
  const [sandboxCapability, setSandboxCapability] = React.useState<
    SandboxCapabilityInfo | undefined
  >(undefined)
  const [sandboxSkipped, setSandboxSkipped] = React.useState<
    SandboxSkippedEntry[]
  >([])
  const [notice, setNotice] = React.useState<SettingsNotice | null>(null)

  const reloadServers = React.useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersList)
      if (!res.ok) return
      const data = (await res.json()) as {
        ok?: boolean
        servers?: GlobalMcpServerConfig[]
      }
      if (data?.ok && Array.isArray(data.servers)) setServers(data.servers)
    } catch {
      // The list is display data; a failure leaves the previous snapshot.
    }
  }, [])

  const reloadSkills = React.useCallback(async () => {
    setRefreshingSkills(true)
    try {
      const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
      const res = await fetch(`${API_ENDPOINTS.skills}${qs}`)
      if (!res.ok) return
      const data = (await res.json()) as { ok?: boolean; skills?: SkillItem[] }
      if (data?.ok && Array.isArray(data.skills)) setSkills(data.skills)
    } catch {
      // Same: the catalog is display data.
    } finally {
      setRefreshingSkills(false)
    }
  }, [sessionId])

  const refreshClient = React.useCallback(
    async (server: GlobalMcpServerConfig) => {
      setRefreshingClientId(server.id)
      try {
        const res = await fetch(API_ENDPOINTS.mcpServersProbe, {
          method: API_METHODS.mcpServersProbe,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ server: { id: server.id }, remount: true }),
        })
        const data = (await res.json()) as McpProbeResult & { error?: string }
        const message = data?.error || data?.remount?.message
        setClientRefreshResults((prev) => ({
          ...prev,
          [server.id]: { ok: Boolean(data?.ok), message: message ?? '' },
        }))
        if (data?.server) {
          setServers((prev) =>
            prev.map((s) => (s.id === data.server?.id ? data.server : s)),
          )
        }
        setNotice(
          data?.ok
            ? { kind: 'success', message: data.remount?.message ?? '' }
            : {
                kind: 'error',
                message:
                  message ||
                  t('sessionSettings.mcp.notices.refreshFailed', {
                    message: 'Unknown error',
                  }),
              },
        )
      } catch (err: unknown) {
        setNotice({
          kind: 'error',
          message: t('sessionSettings.mcp.notices.refreshFailed', {
            message: err instanceof Error ? err.message : String(err),
          }),
        })
      } finally {
        setRefreshingClientId('')
      }
    },
    [t],
  )

  React.useEffect(() => {
    let mounted = true

    async function loadModels() {
      const remoteSession = remoteRef.current?.session
      if (typeof remoteSession?.modelCatalog !== 'function') return
      setLoadingModels(true)
      try {
        const catalog = await remoteSession.modelCatalog()
        if (mounted && catalog?.ok && Array.isArray(catalog.value?.groups)) {
          setProviders(catalog.value.groups)
        }
      } catch {
        // The provider list is display data.
      } finally {
        if (mounted) setLoadingModels(false)
      }
    }

    async function loadSandboxFacts() {
      try {
        const params = new URLSearchParams()
        if (sessionId) params.set('sessionId', sessionId)
        const query = params.toString()
        const res = await fetch(
          `${API_ENDPOINTS.getSettings}${query ? `?${query}` : ''}`,
        )
        if (!res.ok) return
        const data = (await res.json()) as {
          ok?: boolean
          sandboxCapability?: SandboxCapabilityInfo
          sandboxSkipped?: SandboxSkippedEntry[]
        }
        if (data?.ok && mounted) {
          setSandboxCapability(data.sandboxCapability)
          setSandboxSkipped(
            Array.isArray(data.sandboxSkipped) ? data.sandboxSkipped : [],
          )
        }
      } catch {
        // Capability facts are advisory; a failure leaves the panel enabled.
      }
    }

    void loadModels()
    void loadSandboxFacts()
    void reloadServers()
    void reloadSkills()

    return () => {
      mounted = false
    }
  }, [sessionId, reloadServers, reloadSkills])

  React.useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  return {
    providers,
    loadingModels,
    servers,
    reloadServers,
    refreshingClientId,
    clientRefreshResults,
    refreshClient,
    skills,
    reloadSkills,
    refreshingSkills,
    sandboxCapability,
    sandboxSkipped,
    notice,
    setNotice,
  }
}
