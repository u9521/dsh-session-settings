import * as React from 'react'
import type {
  ClientPageProps,
  NavSection,
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSandboxConfig,
  SessionSkillsConfig,
  SessionSettingsConfig,
  SandboxCapabilityInfo,
  SandboxSkippedEntry,
  GlobalMcpServerConfig,
  McpProbeResult,
  SkillItem,
  ModelProviderGroup,
  SessionInfo,
  SessionsState,
  WorkspacesState,
} from '../../types/index.ts'
import type { SettingsScope } from '../sections/HeaderBar.ts'
import { API_ENDPOINTS, API_METHODS } from '../../types/index.ts'
import { isSessionCustomized } from '../../utils/config.ts'
import { resolvePageWorkspace } from '../../utils/sessionScope.ts'

const identitySelector = <T>(state: T): T => state

export function useSessionData(props: ClientPageProps) {
  const {
    remote,
    t,
    sessionId,
    workspaceId: propWorkspaceId,
    workspaceTitle: propWorkspaceTitle,
    useSessions,
    useWorkspaces,
  } = props

  const sessionsState = useSessions
    ? (useSessions(identitySelector) as SessionsState | undefined)
    : undefined
  const workspacesState = useWorkspaces
    ? (useWorkspaces(identitySelector) as WorkspacesState | undefined)
    : undefined

  const currentSession = sessionId
    ? sessionsState?.byId?.[sessionId]
    : undefined

  // Identity resolution lives in `utils/sessionScope.ts`: DSH 0.2.0 carries
  // neither `sessions.current` nor `workspaces.recentWorkspaceId`, so the
  // main-view session and workspace recency have to be derived. There is no
  // "first workspace" fallback — an unresolvable page says so instead of
  // naming an arbitrary workspace.
  const currentWorkspace = React.useMemo(
    () =>
      resolvePageWorkspace({
        sessions: sessionsState,
        workspaces: workspacesState,
        sessionId,
        workspaceId: propWorkspaceId,
      }),
    [workspacesState, sessionsState, propWorkspaceId, sessionId],
  )

  const currentWorkspaceId =
    propWorkspaceId ?? currentWorkspace?.workspaceId ?? currentWorkspace?.id
  const currentWorkspaceTitle =
    propWorkspaceTitle ??
    currentWorkspace?.title ??
    currentWorkspace?.name ??
    currentWorkspace?.path

  // Scope availability. The session tab needs a live session to write to;
  // without one there is no session scope at all, so it disables itself and the
  // page says why. Global is always available.
  const sessionScopeAvailable = Boolean(sessionId)
  const workspaceScopeAvailable = Boolean(currentWorkspaceId)

  /**
   * The first enabled tab, in preference order.
   *
   * Both the state initializer and the reconciliation effect below call this
   * one function: duplicating the preference order is how the default and the
   * enabled-tab condition drifted apart before.
   */
  const defaultScope = React.useCallback(
    (): SettingsScope =>
      sessionScopeAvailable
        ? 'session'
        : workspaceScopeAvailable
          ? 'workspace'
          : 'global',
    [sessionScopeAvailable, workspaceScopeAvailable],
  )

  const [activeScope, setActiveScope] =
    React.useState<SettingsScope>(defaultScope)

  // Identity arrives a frame late, and can also go away entirely (the session
  // was archived). The selected tab must never be left disabled, so this
  // re-applies the default whenever the current selection is unusable — and
  // respects the user's own choice for as long as that choice stays valid.
  const scopeChosenByUser = React.useRef(false)
  React.useEffect(() => {
    const enabled =
      activeScope === 'session'
        ? sessionScopeAvailable
        : activeScope === 'workspace'
          ? workspaceScopeAvailable
          : true
    if (scopeChosenByUser.current && enabled) return
    setActiveScope(defaultScope())
  }, [
    activeScope,
    defaultScope,
    sessionScopeAvailable,
    workspaceScopeAvailable,
  ])

  /** Tab selection: records that the choice was the user's, not the default. */
  const chooseScope = React.useCallback((scope: SettingsScope) => {
    scopeChosenByUser.current = true
    setActiveScope(scope)
  }, [])

  const [activeNav, setActiveNav] = React.useState<NavSection>('model')
  const [copiedId, setCopiedId] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string>('')

  const [providers, setProviders] = React.useState<ModelProviderGroup[]>([])
  const [loadingModels, setLoadingModels] = React.useState<boolean>(false)
  const [availableMcpServers, setAvailableMcpServers] = React.useState<
    GlobalMcpServerConfig[]
  >([])
  const [availableSkills, setAvailableSkills] = React.useState<SkillItem[]>([])

  // Runtime MCP client recovery state
  const [refreshingClientId, setRefreshingClientId] = React.useState<string>('')
  const [clientRefreshResults, setClientRefreshResults] = React.useState<
    Record<string, { ok: boolean; message: string }>
  >({})

  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'

  // Session Form state
  const [modelConfig, setModelConfig] = React.useState<SubagentModelConfig>({
    mode: defaultMode,
  })
  const [mcpConfig, setMcpConfig] = React.useState<SessionMcpConfig>({
    mode: defaultMode,
  })
  const [skillsConfig, setSkillsConfig] = React.useState<SessionSkillsConfig>({
    mode: defaultMode,
  })
  const [sandboxConfig, setSandboxConfig] =
    React.useState<SessionSandboxConfig>({ mode: defaultMode })

  // Workspace Draft Form state
  const [workspaceModelConfig, setWorkspaceModelConfig] =
    React.useState<SubagentModelConfig>({ mode: 'global' })
  const [workspaceMcpConfig, setWorkspaceMcpConfig] =
    React.useState<SessionMcpConfig>({ mode: 'global' })
  const [workspaceSkillsConfig, setWorkspaceSkillsConfig] =
    React.useState<SessionSkillsConfig>({ mode: 'global' })
  const [workspaceSandboxConfig, setWorkspaceSandboxConfig] =
    React.useState<SessionSandboxConfig>({ mode: 'global' })

  // Global Draft Form state
  const [globalModelConfig, setGlobalModelConfig] =
    React.useState<SubagentModelConfig>({ inherit: true })
  const [globalMcpConfig, setGlobalMcpConfig] =
    React.useState<SessionMcpConfig>({ enabledServerIds: [] })
  const [globalSandboxConfig, setGlobalSandboxConfig] =
    React.useState<SessionSandboxConfig>({ allow: [] })
  const [globalSkillsConfig, setGlobalSkillsConfig] =
    React.useState<SessionSkillsConfig>({
      disabledModelSkills: [],
      disabledUserSkills: [],
    })

  // Skills UI state
  const [skillsSearch, setSkillsSearch] = React.useState<string>('')
  const [sessionSkillModalTarget, setSessionSkillModalTarget] =
    React.useState<SkillItem | null>(null)
  const [skillsContentMap, setSkillsContentMap] = React.useState<
    Record<string, SkillItem>
  >({})
  const [skillsLoadingMap, setSkillsLoadingMap] = React.useState<
    Record<string, boolean>
  >({})
  const [refreshingSkills, setRefreshingSkills] = React.useState<boolean>(false)

  // Session Tools Modal State
  const [sessionToolsModalServer, setSessionToolsModalServer] =
    React.useState<GlobalMcpServerConfig | null>(null)
  const [sessionToolsMode, setSessionToolsMode] = React.useState<
    'global' | 'custom'
  >('global')
  const [sessionDisabledToolsSet, setSessionDisabledToolsSet] = React.useState<
    Set<string>
  >(new Set())
  const [globalConfig, setGlobalConfig] = React.useState<SessionSettingsConfig>(
    {
      subagentModel: {},
      mcp: { enabledServerIds: [] },
      skills: {
        disabledModelSkills: [],
        disabledUserSkills: [],
      },
      sandbox: { allow: [] },
    },
  )
  const [workspaceSettings, setWorkspaceSettings] = React.useState<
    SessionSettingsConfig | undefined
  >(undefined)
  const [hasSessionOverride, setHasSessionOverride] =
    React.useState<boolean>(false)
  /**
   * What the host-sandbox backend can do, and which configured directories it
   * skipped. Both come from the settings response so the panel reports the
   * deployment's real behavior instead of a platform guess.
   */
  const [sandboxCapability, setSandboxCapability] = React.useState<
    SandboxCapabilityInfo | undefined
  >(undefined)
  const [sandboxSkipped, setSandboxSkipped] = React.useState<
    SandboxSkippedEntry[]
  >([])

  const remoteRef = React.useRef(remote)
  remoteRef.current = remote

  const sessionsMap: Record<string, SessionInfo> = React.useMemo(
    () => ({ ...(sessionsState?.byId ?? {}) }),
    [sessionsState],
  )

  const loadMcpServers = React.useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.mcpServersList)
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean
          servers?: GlobalMcpServerConfig[]
        }
        if (data && data.ok && Array.isArray(data.servers)) {
          setAvailableMcpServers(data.servers)
        }
      }
    } catch {}
  }, [])

  const handleRefreshClient = React.useCallback(
    async (server: GlobalMcpServerConfig) => {
      setRefreshingClientId(server.id)
      setError('')
      try {
        // One probe with `remount` folds the former /refresh call into the
        // single discovery entry point; the remount outcome arrives as a field.
        const res = await fetch(API_ENDPOINTS.mcpServersProbe, {
          method: API_METHODS.mcpServersProbe,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            server: { id: server.id },
            remount: true,
          }),
        })
        const data = (await res.json()) as McpProbeResult & {
          error?: string
        }
        if (!res.ok || !data.ok) {
          const msg =
            data.error ||
            data.remount?.message ||
            t('sessionSettings.mcp.notices.refreshFailed', {
              message: 'Unknown error',
            })
          setError(msg)
          setClientRefreshResults((prev) => ({
            ...prev,
            [server.id]: { ok: false, message: msg },
          }))
          return
        }

        if (data.server) {
          const updated = data.server
          setAvailableMcpServers((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s)),
          )
        }

        const result = data.remount
        if (!result) return

        setClientRefreshResults((prev) => ({
          ...prev,
          [server.id]: { ok: result.ok, message: result.message },
        }))

        if (result.remounted) {
          setSaveSuccessMsg(
            t('sessionSettings.mcp.notices.refreshSuccess', {
              name: server.name,
            }),
          )
        } else if (result.ok) {
          // The probe succeeded but no remount happened (the server is not
          // currently wanted, or the official plugin is unavailable). Claiming
          // a remount here is what made the action look unreliable.
          setSaveSuccessMsg(
            t('sessionSettings.mcp.notices.refreshProbeOnly', {
              name: server.name,
            }),
          )
        } else {
          setError(
            t('sessionSettings.mcp.notices.refreshFailed', {
              message: result.message,
            }),
          )
        }
      } catch (err: unknown) {
        setError(
          t('sessionSettings.mcp.notices.refreshFailed', {
            message: err instanceof Error ? err.message : String(err),
          }),
        )
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
        const catalogRes = await remoteSession.modelCatalog()
        if (
          mounted &&
          catalogRes?.ok &&
          Array.isArray(catalogRes.value?.groups)
        ) {
          setProviders(catalogRes.value.groups)
        }
      } catch {
      } finally {
        if (mounted) {
          setLoadingModels(false)
        }
      }
    }

    async function loadSkills() {
      try {
        const qs = sessionId
          ? `?sessionId=${encodeURIComponent(sessionId)}`
          : ''
        const res = await fetch(`${API_ENDPOINTS.skills}${qs}`)
        if (res.ok && mounted) {
          const data = (await res.json()) as {
            ok?: boolean
            skills?: SkillItem[]
          }
          if (data && data.ok && Array.isArray(data.skills)) {
            setAvailableSkills(data.skills)
          }
        }
      } catch {}
    }

    async function loadSessionSettings() {
      try {
        const params = new URLSearchParams()
        if (sessionId) {
          params.set('sessionId', sessionId)
        } else if (currentWorkspaceId) {
          params.set('workspaceId', currentWorkspaceId)
        }
        const query = params.toString()
        const url = `${API_ENDPOINTS.getSettings}${query ? `?${query}` : ''}`
        const res = await fetch(url)
        if (res.ok && mounted) {
          const data = (await res.json()) as {
            ok?: boolean
            globalConfig?: SessionSettingsConfig
            workspaceConfig?: SessionSettingsConfig
            workspaceId?: string
            sessionConfig?: SessionSettingsConfig
            sandboxCapability?: SandboxCapabilityInfo
            sandboxSkipped?: SandboxSkippedEntry[]
          }
          if (data && data.ok) {
            setSandboxCapability(data.sandboxCapability ?? undefined)
            setSandboxSkipped(
              Array.isArray(data.sandboxSkipped) ? data.sandboxSkipped : [],
            )
            if (data.globalConfig) {
              setGlobalConfig(data.globalConfig)
              setGlobalModelConfig(
                data.globalConfig.subagentModel ?? { inherit: true },
              )
              setGlobalMcpConfig(
                data.globalConfig.mcp ?? { enabledServerIds: [] },
              )
              setGlobalSkillsConfig(
                data.globalConfig.skills ?? {
                  disabledModelSkills: [],
                  disabledUserSkills: [],
                },
              )
              setGlobalSandboxConfig(data.globalConfig.sandbox ?? { allow: [] })
            }
            if (
              data.workspaceConfig &&
              (data.workspaceId || currentWorkspaceId)
            ) {
              setWorkspaceSettings(data.workspaceConfig)
              setWorkspaceModelConfig(
                data.workspaceConfig.subagentModel ?? { mode: 'global' },
              )
              setWorkspaceMcpConfig(
                data.workspaceConfig.mcp ?? { mode: 'global' },
              )
              setWorkspaceSkillsConfig(
                data.workspaceConfig.skills ?? { mode: 'global' },
              )
              setWorkspaceSandboxConfig(
                data.workspaceConfig.sandbox ?? { mode: 'global' },
              )
            } else {
              setWorkspaceSettings(undefined)
            }

            // The session form is only ever rendered when a session exists (the
            // tab disables itself otherwise), so there is nothing to seed when
            // there is no session.
            if (data.sessionConfig && sessionId) {
              setModelConfig(data.sessionConfig.subagentModel)
              setMcpConfig(data.sessionConfig.mcp)
              setSkillsConfig(data.sessionConfig.skills)
              setSandboxConfig(data.sessionConfig.sandbox ?? { mode: 'global' })
              setHasSessionOverride(isSessionCustomized(data.sessionConfig))
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
        loadSessionSettings(),
      ])
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [sessionId, currentWorkspaceId, loadMcpServers])

  return {
    currentSession,
    currentWorkspace,
    currentWorkspaceId,
    currentWorkspaceTitle,
    activeScope,
    setActiveScope: chooseScope,
    activeNav,
    setActiveNav,
    copiedId,
    setCopiedId,
    error,
    setError,
    saveSuccessMsg,
    setSaveSuccessMsg,
    providers,
    setProviders,
    loadingModels,
    availableMcpServers,
    setAvailableMcpServers,
    reloadMcpServers: loadMcpServers,
    refreshingClientId,
    clientRefreshResults,
    handleRefreshClient,
    availableSkills,
    setAvailableSkills,
    modelConfig,
    setModelConfig,
    mcpConfig,
    setMcpConfig,
    skillsConfig,
    setSkillsConfig,
    sandboxConfig,
    setSandboxConfig,
    workspaceModelConfig,
    setWorkspaceModelConfig,
    workspaceMcpConfig,
    setWorkspaceMcpConfig,
    workspaceSkillsConfig,
    setWorkspaceSkillsConfig,
    workspaceSandboxConfig,
    setWorkspaceSandboxConfig,
    globalModelConfig,
    setGlobalModelConfig,
    globalMcpConfig,
    setGlobalMcpConfig,
    globalSkillsConfig,
    setGlobalSkillsConfig,
    globalSandboxConfig,
    setGlobalSandboxConfig,
    sandboxCapability,
    sandboxSkipped,
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
    globalConfig,
    setGlobalConfig,
    workspaceSettings,
    setWorkspaceSettings,
    hasSessionOverride,
    sessionScopeAvailable,
    workspaceScopeAvailable,
    setHasSessionOverride,
    sessionsMap,
  }
}
