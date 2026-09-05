import * as React from 'react'
import {
  type ClientPageProps,
  type ModelProviderGroup,
  type GlobalMcpServerConfig,
  type SkillItem,
  type SubagentModelConfig,
  type SessionMcpConfig,
  type SessionSkillsConfig,
  type SessionSettingsConfig,
  type NavSection,
  type SessionsState,
  type WorkspacesState,
  type WorkspaceInfo,
  type SessionInfo,
  API_ENDPOINTS,
} from '../../types/index.ts'
import { isSessionCustomized } from '../../utils/config.ts'

export function useSessionData({
  api,
  remote,
  sessionId,
  workspaceId: propWorkspaceId,
  workspaceTitle: propWorkspaceTitle,
  useSessions,
  useWorkspaces,
}: ClientPageProps) {
  const sessionsState = React.useMemo<SessionsState | null>(() => {
    if (!useSessions) return null
    try {
      if (typeof useSessions === 'function') {
        const val = (useSessions((s) => s) ?? useSessions()) as
          SessionsState | undefined
        return val ?? null
      }
      return (useSessions as SessionsState) ?? null
    } catch {
      return null
    }
  }, [useSessions])

  const currentSession: SessionInfo | null =
    (Array.isArray(sessionsState?.items) && sessionId
      ? sessionsState.items.find((s) => s?.id === sessionId)
      : undefined) ??
    (sessionsState?.byId && sessionId ? sessionsState.byId[sessionId] : null) ??
    null

  const workspacesState = React.useMemo<WorkspacesState | null>(() => {
    if (!useWorkspaces) return null
    try {
      if (typeof useWorkspaces === 'function') {
        const val = (useWorkspaces((w) => w) ?? useWorkspaces()) as
          WorkspacesState | undefined
        return val ?? null
      }
      return (useWorkspaces as WorkspacesState) ?? null
    } catch {
      return null
    }
  }, [useWorkspaces])

  const currentWorkspace: WorkspaceInfo | null = Array.isArray(
    workspacesState?.items,
  )
    ? (workspacesState.items.find(
        (w) =>
          (sessionId &&
            Array.isArray(w?.sessionIds) &&
            w.sessionIds.includes(sessionId)) ||
          (currentSession?.cwd &&
            (w?.path === currentSession.cwd ||
              w?.cwd === currentSession.cwd)) ||
          (propWorkspaceId &&
            (w?.workspaceId === propWorkspaceId || w?.id === propWorkspaceId)),
      ) ??
      (!sessionId && workspacesState?.recentWorkspaceId
        ? (workspacesState.items.find(
            (w) =>
              w.workspaceId === workspacesState.recentWorkspaceId ||
              w.id === workspacesState.recentWorkspaceId,
          ) ?? workspacesState.items[0])
        : null) ??
      null)
    : null

  const currentWorkspaceId =
    propWorkspaceId ?? currentWorkspace?.workspaceId ?? currentWorkspace?.id
  const currentWorkspaceTitle =
    propWorkspaceTitle ??
    currentWorkspace?.title ??
    currentWorkspace?.name ??
    currentWorkspace?.path

  const [activeNav, setActiveNav] = React.useState<NavSection>('model')
  const [copiedId, setCopiedId] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string>('')

  // Clone Preset toolbar state
  const [cloneSourceId, setCloneSourceId] = React.useState<string>('')
  const [cloning, setCloning] = React.useState<boolean>(false)
  const [cloneError, setCloneError] = React.useState<string>('')

  const [providers, setProviders] = React.useState<ModelProviderGroup[]>([])
  const [loadingModels, setLoadingModels] = React.useState<boolean>(false)
  const [availableMcpServers, setAvailableMcpServers] = React.useState<
    GlobalMcpServerConfig[]
  >([])
  const [availableSkills, setAvailableSkills] = React.useState<SkillItem[]>([])

  const defaultMode = currentWorkspaceId ? 'workspace' : 'global'

  // Form state
  const [modelConfig, setModelConfig] = React.useState<SubagentModelConfig>({
    mode: defaultMode,
  })
  const [mcpConfig, setMcpConfig] = React.useState<SessionMcpConfig>({
    mode: defaultMode,
  })
  const [skillsConfig, setSkillsConfig] = React.useState<SessionSkillsConfig>({
    mode: defaultMode,
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
  const [sessionToolsFetching, setSessionToolsFetching] =
    React.useState<boolean>(false)
  const [sessionToolsError, setSessionToolsError] = React.useState<string>('')
  const [sessionToolsList, setSessionToolsList] = React.useState<
    Array<{ name?: string; id?: string; description?: string }>
  >([])

  const [globalConfig, setGlobalConfig] = React.useState<SessionSettingsConfig>(
    {
      subagentModel: {},
      mcp: { enabledServerIds: [] },
      skills: {
        disabledModelSkills: [],
        disabledUserSkills: [],
      },
    },
  )
  const [workspaceSettings, setWorkspaceSettings] = React.useState<
    SessionSettingsConfig | undefined
  >(undefined)
  const [hasSessionOverride, setHasSessionOverride] =
    React.useState<boolean>(false)

  // Set as default modal states
  const [setDefaultModalOpen, setSetDefaultModalOpen] =
    React.useState<boolean>(false)
  const [setDefaultTargetScope, setSetDefaultTargetScope] = React.useState<
    'workspace' | 'global'
  >(currentWorkspaceId ? 'workspace' : 'global')
  const [isRestoringDefault, setIsRestoringDefault] =
    React.useState<boolean>(false)

  const apiRef = React.useRef(api)
  apiRef.current = api
  const remoteRef = React.useRef(remote)
  remoteRef.current = remote

  const sessionsMap: Record<string, SessionInfo> = React.useMemo(() => {
    const map: Record<string, SessionInfo> = {}
    if (sessionsState?.byId) {
      Object.assign(map, sessionsState.byId)
    }
    if (Array.isArray(sessionsState?.items)) {
      for (const s of sessionsState.items) {
        if (s?.id) {
          map[s.id] = s
        }
      }
    }
    return map
  }, [sessionsState])

  // Fetch models, mcp servers, and server-side config on mount or sessionId/workspaceId change
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
        // ignore fetch failure
      } finally {
        if (mounted) {
          setLoadingModels(false)
        }
      }
    }

    async function loadMcpServers() {
      try {
        const res = await fetch(API_ENDPOINTS.mcpServersList)
        if (res.ok && mounted) {
          const data = (await res.json()) as {
            ok?: boolean
            servers?: GlobalMcpServerConfig[]
          }
          if (data && data.ok && Array.isArray(data.servers)) {
            setAvailableMcpServers(data.servers)
          }
        }
      } catch {}
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
        const qs = sessionId
          ? `?sessionId=${encodeURIComponent(sessionId)}`
          : ''
        const url = `${API_ENDPOINTS.getSettings}${qs}`
        const res = await fetch(url)
        if (res.ok && mounted) {
          const data = (await res.json()) as {
            ok?: boolean
            globalConfig?: SessionSettingsConfig
            workspaceConfig?: SessionSettingsConfig
            workspaceId?: string
            sessionConfig?: SessionSettingsConfig
          }
          if (data && data.ok) {
            if (data.globalConfig) {
              setGlobalConfig(data.globalConfig)
            }
            if (
              data.workspaceConfig &&
              (data.workspaceId || currentWorkspaceId)
            ) {
              setWorkspaceSettings(data.workspaceConfig)
            } else {
              setWorkspaceSettings(undefined)
            }

            if (data.sessionConfig && sessionId) {
              setModelConfig(data.sessionConfig.subagentModel)
              setMcpConfig(data.sessionConfig.mcp)
              setSkillsConfig(data.sessionConfig.skills)
              setHasSessionOverride(isSessionCustomized(data.sessionConfig))
            } else if (!sessionId && data.globalConfig) {
              setModelConfig({
                mode: 'global',
                ...(data.globalConfig.subagentModel?.inherit === false &&
                data.globalConfig.subagentModel.model
                  ? {
                      inherit: false,
                      model: data.globalConfig.subagentModel.model,
                    }
                  : { inherit: true }),
                allowAgentSelectModel:
                  data.globalConfig.subagentModel?.allowAgentSelectModel !==
                  false,
                overrideForkModel:
                  data.globalConfig.subagentModel?.overrideForkModel === true,
              })
              setMcpConfig({
                mode: 'global',
                enabledServerIds: data.globalConfig.mcp?.enabledServerIds || [],
              })
              setSkillsConfig({
                mode: 'global',
                disabledModelSkills:
                  data.globalConfig.skills?.disabledModelSkills || [],
                disabledUserSkills:
                  data.globalConfig.skills?.disabledUserSkills || [],
              })
              setHasSessionOverride(false)
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
  }, [sessionId, currentWorkspaceId])

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
    sessionsMap,
  }
}
