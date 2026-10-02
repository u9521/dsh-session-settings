import type { Context } from '@deepseek-ai/cordis'
import {
  type ConnectionService,
  type SessionSettingsConfig,
  type SessionSettingsStore,
  type SettingsScopeId,
  type SettingsSnapshotResponse,
  type SkillItem,
  isSettingsScopeId,
} from '../../types.ts'
import {
  normalizeSessionSettings,
  normalizeGlobalSettings,
  saveSessionSettingsStore,
} from './storage.ts'
import { getAvailableSkills } from '../skills/discovery.ts'
import type { McpManager } from '../mcp/manager.ts'
import {
  badRequest,
  jsonResponse,
  readJsonBody,
  toFetchRoute,
} from '../common/http.ts'

import { resolveWorkspaceForSession } from './resolution.ts'

/**
 * Reject a save whose declared scope cannot be satisfied by its target.
 *
 * The scope is authoritative: a request that names `session` without a session
 * id is an error rather than being silently retargeted, which is precisely how
 * a New-Session save used to overwrite the global defaults.
 *
 * @returns an error message, or `undefined` when the target is satisfiable.
 */
function validateScopeTarget(
  scope: SettingsScopeId,
  sessionId?: string,
  workspaceId?: string,
): string | undefined {
  switch (scope) {
    case 'session':
      return sessionId ? undefined : 'scope "session" requires a sessionId'
    case 'workspace':
      return workspaceId
        ? undefined
        : 'scope "workspace" requires a workspaceId'
    case 'global':
      return undefined
  }
}

/** The empty cross-scope view a response carries when a scope has no entry. */
function emptyWorkspaceConfig(): SessionSettingsConfig {
  return {
    subagentModel: { mode: 'global' },
    mcp: { mode: 'global' },
    skills: { mode: 'global' },
  }
}

export function registerSessionSettingsRoutes(
  ctx: Context,
  connection: ConnectionService,
  getSessionSettingsStore: () => SessionSettingsStore,
  setSessionSettingsStore: (s: SessionSettingsStore) => void,
  mcpManager?: McpManager,
  invalidatePolicies?: () => void,
): () => Promise<void> {
  const unregisterGetSettings = connection.fetch.register(
    toFetchRoute({
      endpoint: 'getSettings',
      handler: async (request) => {
        const query = new URL(request.url).searchParams
        const querySessionId = query.get('sessionId') || undefined
        // A New-Session page has no session id yet, so the caller may name the
        // workspace directly; a real session always resolves its own workspace.
        const queryWorkspaceId =
          (await resolveWorkspaceForSession(ctx, querySessionId)) ??
          query.get('workspaceId') ??
          undefined

        try {
          const sessionSettingsStore = getSessionSettingsStore()

          const sessionEntry = querySessionId
            ? sessionSettingsStore.sessions[querySessionId]
            : undefined

          const workspaceEntry = queryWorkspaceId
            ? sessionSettingsStore.workspaces?.[queryWorkspaceId]
            : undefined

          const body: SettingsSnapshotResponse = {
            ok: true,
            sessionId: querySessionId,
            workspaceId: queryWorkspaceId,
            sessionConfig: sessionEntry ?? {
              subagentModel: { mode: 'workspace' },
              mcp: { mode: 'workspace' },
              skills: { mode: 'workspace' },
            },
            workspaceConfig: workspaceEntry ?? emptyWorkspaceConfig(),
            globalConfig: sessionSettingsStore.globalConfig,
          }
          return jsonResponse(body)
        } catch (err: unknown) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500,
          )
        }
      },
    }),
  )

  const unregisterSaveSettings = connection.fetch.register(
    toFetchRoute({
      endpoint: 'saveSettings',
      handler: async (request) => saveSettings(request),
    }),
  )

  async function saveSettings(request: Request): Promise<Response> {
    const parsed = await readJsonBody(request)
    if (!parsed) return badRequest('A JSON request body is required')

    const scope = parsed.scope
    if (!isSettingsScopeId(scope)) {
      return badRequest(
        'A valid "scope" is required (session, workspace, or global)',
      )
    }

    const targetSessionId =
      typeof parsed.sessionId === 'string' && parsed.sessionId
        ? parsed.sessionId
        : undefined
    // A session-less save names its workspace explicitly; a session-scoped one
    // resolves it from the session itself.
    const targetWorkspaceId =
      (await resolveWorkspaceForSession(ctx, targetSessionId)) ??
      (typeof parsed.workspaceId === 'string' && parsed.workspaceId
        ? parsed.workspaceId
        : undefined)

    const scopeProblem = validateScopeTarget(
      scope,
      targetSessionId,
      targetWorkspaceId,
    )
    if (scopeProblem) return badRequest(scopeProblem)

    const isRestoringDefault = parsed.isRestoringDefault === true

    // The config field is per-scope: `global` carries `globalConfig`, the other
    // three carry `config`. A reset carries neither.
    let incomingConfig: SessionSettingsConfig | undefined
    if (!isRestoringDefault) {
      if (scope === 'global') {
        if (parsed.globalConfig === undefined) {
          return badRequest('scope "global" requires a globalConfig')
        }
        incomingConfig = normalizeGlobalSettings(
          parsed.globalConfig as Partial<SessionSettingsConfig>,
        )
      } else {
        if (parsed.config === undefined) {
          return badRequest(`scope "${scope}" requires a config`)
        }
        incomingConfig = normalizeSessionSettings(
          parsed.config as Partial<SessionSettingsConfig>,
        )
      }
    }

    if (
      incomingConfig?.subagentModel.mode === 'custom' &&
      !incomingConfig.subagentModel.inherit &&
      (!incomingConfig.subagentModel.model?.provider ||
        !incomingConfig.subagentModel.model?.model)
    ) {
      return badRequest(
        'Subagent model custom mode requires provider and model',
      )
    }

    const sessionSettingsStore = getSessionSettingsStore()
    if (!sessionSettingsStore.workspaces) sessionSettingsStore.workspaces = {}

    /**
     * Runtime skills ship with the composition and cannot be disabled as a
     * default for anything narrower than a session.
     */
    const withoutRuntimeSkills = async (
      config: SessionSettingsConfig,
    ): Promise<SessionSettingsConfig> => {
      try {
        const allSkills = await getAvailableSkills(ctx, undefined)
        const runtimeSkillNames = new Set(
          allSkills
            .filter((s: SkillItem) => s.isRuntime)
            .map((s: SkillItem) => s.name),
        )
        if (config.skills?.disabledModelSkills) {
          config.skills.disabledModelSkills =
            config.skills.disabledModelSkills.filter(
              (name) => !runtimeSkillNames.has(name),
            )
        }
        if (config.skills?.disabledUserSkills) {
          config.skills.disabledUserSkills =
            config.skills.disabledUserSkills.filter(
              (name) => !runtimeSkillNames.has(name),
            )
        }
      } catch {
        // Skill discovery is best-effort; never block a save on it.
      }
      return config
    }

    switch (scope) {
      case 'global': {
        if (isRestoringDefault) {
          sessionSettingsStore.globalConfig = {
            subagentModel: {
              inherit: true,
              allowAgentSelectModel: true,
              overrideForkModel: false,
            },
            mcp: { enabledServerIds: [] },
            skills: { disabledModelSkills: [], disabledUserSkills: [] },
          }
        } else if (incomingConfig) {
          sessionSettingsStore.globalConfig =
            await withoutRuntimeSkills(incomingConfig)
        }
        break
      }

      case 'workspace': {
        const workspaceId = targetWorkspaceId as string
        if (isRestoringDefault) {
          delete sessionSettingsStore.workspaces[workspaceId]
        } else if (incomingConfig) {
          sessionSettingsStore.workspaces[workspaceId] =
            await withoutRuntimeSkills(incomingConfig)
        }
        break
      }

      case 'session': {
        const sessionId = targetSessionId as string
        if (isRestoringDefault) {
          delete sessionSettingsStore.sessions[sessionId]
        } else if (incomingConfig) {
          const isPureWorkspaceInherit =
            incomingConfig.subagentModel.mode === 'workspace' &&
            incomingConfig.subagentModel.allowAgentSelectModel === undefined &&
            incomingConfig.subagentModel.overrideForkModel === undefined &&
            incomingConfig.mcp.mode === 'workspace' &&
            incomingConfig.skills.mode === 'workspace'

          if (isPureWorkspaceInherit) {
            delete sessionSettingsStore.sessions[sessionId]
          } else {
            sessionSettingsStore.sessions[sessionId] = incomingConfig
          }
        }
        break
      }
    }

    saveSessionSettingsStore(sessionSettingsStore)
    setSessionSettingsStore(sessionSettingsStore)

    mcpManager?.syncAll()
    invalidatePolicies?.()

    ctx.emit('skills/change')

    const sessionEntry = targetSessionId
      ? sessionSettingsStore.sessions[targetSessionId]
      : undefined
    const workspaceEntry = targetWorkspaceId
      ? sessionSettingsStore.workspaces?.[targetWorkspaceId]
      : undefined

    const body: SettingsSnapshotResponse = {
      ok: true,
      scope,
      sessionId: targetSessionId,
      workspaceId: targetWorkspaceId,
      sessionConfig: sessionEntry ?? incomingConfig,
      workspaceConfig: workspaceEntry ?? emptyWorkspaceConfig(),
      globalConfig: sessionSettingsStore.globalConfig,
    }
    return jsonResponse(body)
  }

  return async () => {
    await unregisterGetSettings()
    await unregisterSaveSettings()
  }
}
