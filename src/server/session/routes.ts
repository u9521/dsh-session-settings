import type { Context } from '@deepseek-ai/cordis'
import type {
  McpServerStore,
  SessionSettingsConfig,
  SessionSettingsStore,
} from '../../types.ts'
import {
  normalizeSessionSettings,
  resolveEffectiveSessionSettings,
  saveSessionSettingsStore,
} from './storage.ts'
import { getAvailableSkills } from '../skills/discovery.ts'
import type { McpManager } from '../mcp/manager.ts'
import { readRequestBody } from '../common/http.ts'

export function resolveWorkspaceForSession(
  ctx: Context,
  sessionId?: string,
): string | undefined {
  if (!sessionId) return undefined
  try {
    const workspaceRegistry = ctx.get('workspaceRegistry' as any) as any
    if (workspaceRegistry && typeof workspaceRegistry.list === 'function') {
      const list = workspaceRegistry.list()
      if (Array.isArray(list)) {
        for (const w of list) {
          if (
            w.sessionIds &&
            Array.isArray(w.sessionIds) &&
            w.sessionIds.includes(sessionId)
          ) {
            return w.id
          }
        }
      }
    }
    const sessionsService = ctx.get('sessions' as any) as any
    const s = sessionsService?.get?.(sessionId)
    if (s?.header?.workspaceId) {
      return s.header.workspaceId
    }
  } catch {}
  return undefined
}

export function registerSessionSettingsRoutes(
  ctx: Context,
  webServer: any,
  getSessionSettingsStore: () => SessionSettingsStore,
  setSessionSettingsStore: (s: SessionSettingsStore) => void,
  getMcpStore: () => McpServerStore,
  mcpManager?: McpManager,
): () => void {
  const unregisterSessionSettingsRoute = webServer.register({
    kind: 'exact',
    path: '/api/session-settings',
    handler: async (req: any, res: any) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      const url = new URL(req.url ?? '/', 'http://localhost')
      const querySessionId = url.searchParams.get('sessionId') || undefined
      const queryWorkspaceId =
        url.searchParams.get('workspaceId') ||
        resolveWorkspaceForSession(ctx, querySessionId)

      if (req.method === 'GET') {
        try {
          const sessionSettingsStore = getSessionSettingsStore()
          const mcpStore = getMcpStore()
          const availableSkills = await getAvailableSkills(ctx, querySessionId)

          const sessionEntry =
            querySessionId && sessionSettingsStore.sessions[querySessionId]
              ? sessionSettingsStore.sessions[querySessionId]
              : undefined

          const workspaceEntry =
            queryWorkspaceId &&
            sessionSettingsStore.workspaces?.[queryWorkspaceId]
              ? sessionSettingsStore.workspaces[queryWorkspaceId]
              : undefined

          const rawConfig = sessionEntry || {
            subagentModel: { mode: queryWorkspaceId ? 'workspace' : 'default' },
            mcp: {
              mode: queryWorkspaceId ? 'workspace' : 'default',
              enabledServerIds: [],
            },
            skills: {
              mode: queryWorkspaceId ? 'workspace' : 'default',
              disabledSkills: [],
            },
          }

          const effective = resolveEffectiveSessionSettings(
            sessionSettingsStore,
            mcpStore,
            querySessionId,
            queryWorkspaceId,
          )

          const hasSessionOverride = Boolean(
            sessionEntry &&
            ((sessionEntry.subagentModel?.mode !== 'workspace' &&
              sessionEntry.subagentModel?.mode !== 'default') ||
              (sessionEntry.mcp?.mode !== 'workspace' &&
                sessionEntry.mcp?.mode !== 'default') ||
              (sessionEntry.skills?.mode !== 'workspace' &&
                sessionEntry.skills?.mode !== 'default')),
          )

          const hasWorkspaceOverride = Boolean(
            workspaceEntry &&
            (workspaceEntry.subagentModel?.mode !== 'default' ||
              workspaceEntry.mcp?.mode !== 'default' ||
              workspaceEntry.skills?.mode !== 'default'),
          )

          res.writeHead(200)
          res.end(
            JSON.stringify({
              ok: true,
              sessionId: querySessionId,
              workspaceId: queryWorkspaceId,
              config: rawConfig,
              workspaceConfig: workspaceEntry || {
                subagentModel: { mode: 'default' },
                mcp: { mode: 'default', enabledServerIds: [] },
                skills: { mode: 'default', disabledSkills: [] },
              },
              effectiveConfig: effective,
              defaultConfig: sessionSettingsStore.default,
              availableSkills,
              hasSessionOverride,
              hasWorkspaceOverride,
            }),
          )
        } catch (err: any) {
          res.writeHead(500)
          res.end(
            JSON.stringify({
              ok: false,
              error: err?.message || String(err),
            }),
          )
        }
        return
      }

      if (req.method === 'POST') {
        try {
          const bodyStr = await readRequestBody(req)
          const parsed = JSON.parse(bodyStr || '{}')
          const targetSessionId = parsed.sessionId || querySessionId
          const targetWorkspaceId =
            parsed.workspaceId ||
            queryWorkspaceId ||
            resolveWorkspaceForSession(ctx, targetSessionId)

          const isSaveWorkspaceDefault = Boolean(
            parsed.isWorkspaceDefault && targetWorkspaceId,
          )
          const isSaveDefault = Boolean(
            (parsed.isDefault && !isSaveWorkspaceDefault) ||
            (!targetSessionId &&
              !targetWorkspaceId &&
              !isSaveWorkspaceDefault) ||
            parsed.saveAsDefault,
          )

          const sessionSettingsStore = getSessionSettingsStore()
          const mcpStore = getMcpStore()

          const incomingConfig: SessionSettingsConfig =
            normalizeSessionSettings(parsed.config ?? parsed)

          if (
            incomingConfig.subagentModel.mode === 'custom' &&
            (!incomingConfig.subagentModel.provider ||
              !incomingConfig.subagentModel.model)
          ) {
            res.writeHead(400)
            res.end(
              JSON.stringify({
                ok: false,
                error: 'Subagent model custom mode requires provider and model',
              }),
            )
            return
          }

          if (!sessionSettingsStore.workspaces) {
            sessionSettingsStore.workspaces = {}
          }

          if (isSaveDefault) {
            if (parsed.isRestoringDefault) {
              sessionSettingsStore.default = {
                subagentModel: { mode: 'inherit' },
                mcp: {
                  mode: 'default',
                  enabledServerIds: [],
                  toolsMode: {},
                  disabledTools: {},
                },
                skills: {
                  mode: 'default',
                  disabledSkills: [],
                  disabledModelSkills: [],
                  disabledUserSkills: [],
                },
              }
            } else {
              // Runtime skills cannot be set as global defaults
              try {
                const allSkills = await getAvailableSkills(ctx, undefined)
                const runtimeSkillNames = new Set(
                  allSkills.filter((s) => s.isRuntime).map((s) => s.name),
                )
                incomingConfig.skills.disabledSkills = (
                  incomingConfig.skills.disabledSkills || []
                ).filter((name) => !runtimeSkillNames.has(name))
                incomingConfig.skills.disabledModelSkills = (
                  incomingConfig.skills.disabledModelSkills || []
                ).filter((name) => !runtimeSkillNames.has(name))
                incomingConfig.skills.disabledUserSkills = (
                  incomingConfig.skills.disabledUserSkills || []
                ).filter((name) => !runtimeSkillNames.has(name))
              } catch {}

              sessionSettingsStore.default = incomingConfig
            }
          } else if (isSaveWorkspaceDefault && targetWorkspaceId) {
            if (parsed.isRestoringDefault) {
              delete sessionSettingsStore.workspaces[targetWorkspaceId]
            } else {
              sessionSettingsStore.workspaces[targetWorkspaceId] =
                incomingConfig
            }
          }

          if (
            targetSessionId &&
            !parsed.onlyDefault &&
            !isSaveWorkspaceDefault
          ) {
            if (isSaveDefault) {
              delete sessionSettingsStore.sessions[targetSessionId]
            } else if (
              (incomingConfig.subagentModel.mode === 'default' ||
                incomingConfig.subagentModel.mode === 'workspace') &&
              (incomingConfig.mcp.mode === 'default' ||
                incomingConfig.mcp.mode === 'workspace') &&
              (incomingConfig.skills.mode === 'default' ||
                incomingConfig.skills.mode === 'workspace')
            ) {
              // Resetting/selecting default or workspace clears custom session entry
              delete sessionSettingsStore.sessions[targetSessionId]
            } else {
              sessionSettingsStore.sessions[targetSessionId] = incomingConfig
            }
          }

          saveSessionSettingsStore(sessionSettingsStore)
          setSessionSettingsStore(sessionSettingsStore)

          mcpManager?.syncAll()

          const effective = resolveEffectiveSessionSettings(
            sessionSettingsStore,
            mcpStore,
            targetSessionId,
            targetWorkspaceId,
          )
          const availableSkills = await getAvailableSkills(ctx, targetSessionId)

          const sessionEntry =
            targetSessionId && sessionSettingsStore.sessions[targetSessionId]
          const workspaceEntry =
            targetWorkspaceId &&
            sessionSettingsStore.workspaces?.[targetWorkspaceId]

          res.writeHead(200)
          res.end(
            JSON.stringify({
              ok: true,
              sessionId: targetSessionId,
              workspaceId: targetWorkspaceId,
              config: sessionEntry || incomingConfig,
              workspaceConfig: workspaceEntry || {
                subagentModel: { mode: 'default' },
                mcp: { mode: 'default', enabledServerIds: [] },
                skills: { mode: 'default', disabledSkills: [] },
              },
              effectiveConfig: effective,
              defaultConfig: sessionSettingsStore.default,
              availableSkills,
              hasSessionOverride: Boolean(
                sessionEntry &&
                ((sessionEntry.subagentModel?.mode !== 'workspace' &&
                  sessionEntry.subagentModel?.mode !== 'default') ||
                  (sessionEntry.mcp?.mode !== 'workspace' &&
                    sessionEntry.mcp?.mode !== 'default') ||
                  (sessionEntry.skills?.mode !== 'workspace' &&
                    sessionEntry.skills?.mode !== 'default')),
              ),
              hasWorkspaceOverride: Boolean(
                workspaceEntry &&
                (workspaceEntry.subagentModel?.mode !== 'default' ||
                  workspaceEntry.mcp?.mode !== 'default' ||
                  workspaceEntry.skills?.mode !== 'default'),
              ),
            }),
          )
        } catch (err: any) {
          res.writeHead(400)
          res.end(
            JSON.stringify({ ok: false, error: err?.message || String(err) }),
          )
        }
        return
      }

      if (req.method === 'DELETE') {
        const sessionSettingsStore = getSessionSettingsStore()
        const mcpStore = getMcpStore()

        if (url.searchParams.has('workspaceId') && queryWorkspaceId) {
          if (sessionSettingsStore.workspaces?.[queryWorkspaceId]) {
            delete sessionSettingsStore.workspaces[queryWorkspaceId]
            saveSessionSettingsStore(sessionSettingsStore)
            setSessionSettingsStore(sessionSettingsStore)
            mcpManager?.syncAll()
          }
        } else if (
          querySessionId &&
          sessionSettingsStore.sessions[querySessionId]
        ) {
          delete sessionSettingsStore.sessions[querySessionId]
          saveSessionSettingsStore(sessionSettingsStore)
          setSessionSettingsStore(sessionSettingsStore)
          mcpManager?.syncAll()
        }

        const effective = resolveEffectiveSessionSettings(
          sessionSettingsStore,
          mcpStore,
          querySessionId,
          queryWorkspaceId,
        )
        const availableSkills = await getAvailableSkills(ctx, querySessionId)

        res.writeHead(200)
        res.end(
          JSON.stringify({
            ok: true,
            sessionId: querySessionId,
            workspaceId: queryWorkspaceId,
            config: {
              subagentModel: {
                mode: queryWorkspaceId ? 'workspace' : 'default',
              },
              mcp: {
                mode: queryWorkspaceId ? 'workspace' : 'default',
                enabledServerIds: [],
              },
              skills: {
                mode: queryWorkspaceId ? 'workspace' : 'default',
                disabledSkills: [],
              },
            },
            workspaceConfig:
              queryWorkspaceId &&
              sessionSettingsStore.workspaces?.[queryWorkspaceId]
                ? sessionSettingsStore.workspaces[queryWorkspaceId]
                : {
                    subagentModel: { mode: 'default' },
                    mcp: { mode: 'default', enabledServerIds: [] },
                    skills: { mode: 'default', disabledSkills: [] },
                  },
            effectiveConfig: effective,
            defaultConfig: sessionSettingsStore.default,
            availableSkills,
            hasSessionOverride: false,
            hasWorkspaceOverride: Boolean(
              queryWorkspaceId &&
              sessionSettingsStore.workspaces?.[queryWorkspaceId] &&
              (sessionSettingsStore.workspaces[queryWorkspaceId].subagentModel
                ?.mode !== 'default' ||
                sessionSettingsStore.workspaces[queryWorkspaceId].mcp?.mode !==
                  'default' ||
                sessionSettingsStore.workspaces[queryWorkspaceId].skills
                  ?.mode !== 'default'),
            ),
          }),
        )
        return
      }

      res.writeHead(405)
      res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
    },
  })

  return unregisterSessionSettingsRoute
}
