import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import {
  type SessionSettingsConfig,
  type SessionSettingsStore,
  type SkillItem,
  type WebServer,
  API_ENDPOINTS,
} from '../../types.ts'
import {
  normalizeSessionSettings,
  normalizeGlobalSettings,
  saveSessionSettingsStore,
} from './storage.ts'
import { getAvailableSkills } from '../skills/discovery.ts'
import type { McpManager } from '../mcp/manager.ts'
import { readRequestBody } from '../common/http.ts'

import { resolveWorkspaceForSession } from './resolution.ts'

export function registerSessionSettingsRoutes(
  ctx: Context,
  webServer: WebServer,
  getSessionSettingsStore: () => SessionSettingsStore,
  setSessionSettingsStore: (s: SessionSettingsStore) => void,
  mcpManager?: McpManager,
): () => void {
  const unregisterGetSettingsRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.getSettings,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
        return
      }

      const url = new URL(req.url ?? '/', 'http://localhost')
      const querySessionId = url.searchParams.get('sessionId') || undefined
      const queryWorkspaceId = await resolveWorkspaceForSession(
        ctx,
        querySessionId,
      )

      try {
        const sessionSettingsStore = getSessionSettingsStore()

        const sessionEntry = querySessionId
          ? sessionSettingsStore.sessions[querySessionId]
          : undefined

        const workspaceEntry = queryWorkspaceId
          ? sessionSettingsStore.workspaces?.[queryWorkspaceId]
          : undefined

        const rawConfig = sessionEntry || {
          subagentModel: { mode: 'workspace' },
          mcp: { mode: 'workspace' },
          skills: { mode: 'workspace' },
        }

        res.writeHead(200)
        res.end(
          JSON.stringify({
            ok: true,
            sessionId: querySessionId,
            workspaceId: queryWorkspaceId,
            sessionConfig: rawConfig,
            workspaceConfig: workspaceEntry || {
              subagentModel: { mode: 'global' },
              mcp: { mode: 'global' },
              skills: { mode: 'global' },
            },
            globalConfig: sessionSettingsStore.globalConfig,
          }),
        )
      } catch (err: unknown) {
        res.writeHead(500)
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    },
  })

  const unregisterSaveSettingsRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.saveSettings,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
        return
      }

      try {
        const bodyStr = await readRequestBody(req)
        const parsed = JSON.parse(bodyStr || '{}') as Record<string, unknown>
        const targetSessionId =
          typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined
        const targetWorkspaceId = await resolveWorkspaceForSession(
          ctx,
          targetSessionId,
        )

        const isSaveWorkspaceDefault = Boolean(
          parsed.isWorkspaceDefault && targetWorkspaceId,
        )
        const isSaveDefault =
          !isSaveWorkspaceDefault &&
          Boolean(parsed.isDefault || !targetSessionId || parsed.saveAsDefault)

        const sessionSettingsStore = getSessionSettingsStore()

        const incomingConfig: SessionSettingsConfig = normalizeSessionSettings(
          parsed.config ?? parsed.sessionConfig ?? parsed,
        )

        if (
          incomingConfig.subagentModel.mode === 'custom' &&
          !incomingConfig.subagentModel.inherit &&
          (!incomingConfig.subagentModel.model?.provider ||
            !incomingConfig.subagentModel.model?.model)
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
            sessionSettingsStore.globalConfig = {
              subagentModel: {},
              mcp: { enabledServerIds: [] },
              skills: { disabledModelSkills: [], disabledUserSkills: [] },
            }
          } else {
            const incomingGlobal = normalizeGlobalSettings(
              parsed.globalConfig ??
                parsed.config ??
                parsed.sessionConfig ??
                parsed,
            )
            // Runtime skills cannot be set as global defaults
            try {
              const allSkills = await getAvailableSkills(ctx, undefined)
              const runtimeSkillNames = new Set(
                allSkills
                  .filter((s: SkillItem) => s.isRuntime)
                  .map((s: SkillItem) => s.name),
              )
              if (incomingGlobal.skills?.disabledModelSkills) {
                incomingGlobal.skills.disabledModelSkills =
                  incomingGlobal.skills.disabledModelSkills.filter(
                    (name) => !runtimeSkillNames.has(name),
                  )
              }
              if (incomingGlobal.skills?.disabledUserSkills) {
                incomingGlobal.skills.disabledUserSkills =
                  incomingGlobal.skills.disabledUserSkills.filter(
                    (name) => !runtimeSkillNames.has(name),
                  )
              }
            } catch {}

            sessionSettingsStore.globalConfig = incomingGlobal
          }
        } else if (isSaveWorkspaceDefault && targetWorkspaceId) {
          if (parsed.isRestoringDefault) {
            delete sessionSettingsStore.workspaces[targetWorkspaceId]
          } else {
            // Runtime skills cannot be set as workspace defaults
            try {
              const allSkills = await getAvailableSkills(ctx, undefined)
              const runtimeSkillNames = new Set(
                allSkills
                  .filter((s: SkillItem) => s.isRuntime)
                  .map((s: SkillItem) => s.name),
              )
              if (incomingConfig.skills?.disabledModelSkills) {
                incomingConfig.skills.disabledModelSkills =
                  incomingConfig.skills.disabledModelSkills.filter(
                    (name) => !runtimeSkillNames.has(name),
                  )
              }
              if (incomingConfig.skills?.disabledUserSkills) {
                incomingConfig.skills.disabledUserSkills =
                  incomingConfig.skills.disabledUserSkills.filter(
                    (name) => !runtimeSkillNames.has(name),
                  )
              }
            } catch {}
            sessionSettingsStore.workspaces[targetWorkspaceId] = incomingConfig
          }
        }

        if (targetSessionId && !isSaveWorkspaceDefault) {
          if (isSaveDefault) {
            delete sessionSettingsStore.sessions[targetSessionId]
          } else {
            const isPureWorkspaceInherit =
              incomingConfig.subagentModel.mode === 'workspace' &&
              incomingConfig.mcp.mode === 'workspace' &&
              incomingConfig.skills.mode === 'workspace'

            if (isPureWorkspaceInherit) {
              delete sessionSettingsStore.sessions[targetSessionId]
            } else {
              sessionSettingsStore.sessions[targetSessionId] = incomingConfig
            }
          }
        }

        saveSessionSettingsStore(sessionSettingsStore)
        setSessionSettingsStore(sessionSettingsStore)

        mcpManager?.syncAll()

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
            sessionConfig: sessionEntry || incomingConfig,
            workspaceConfig: workspaceEntry || {
              subagentModel: { mode: 'global' },
              mcp: { mode: 'global' },
              skills: { mode: 'global' },
            },
            globalConfig: sessionSettingsStore.globalConfig,
          }),
        )
      } catch (err: unknown) {
        res.writeHead(400)
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    },
  })

  const unregisterDeleteSettingsRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.deleteSettings,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
        return
      }

      try {
        const url = new URL(req.url ?? '/', 'http://localhost')
        let targetSessionId =
          url.searchParams.get('sessionId')?.trim() || undefined
        if (!targetSessionId) {
          const bodyStr = await readRequestBody(req)
          const parsed = (bodyStr ? JSON.parse(bodyStr) : {}) as {
            sessionId?: string
          }
          targetSessionId = parsed.sessionId?.trim() || undefined
        }

        if (!targetSessionId) {
          res.writeHead(400)
          res.end(
            JSON.stringify({ ok: false, error: 'Session ID is required' }),
          )
          return
        }

        const sessionSettingsStore = getSessionSettingsStore()
        const targetWorkspaceId = await resolveWorkspaceForSession(
          ctx,
          targetSessionId,
        )

        if (targetSessionId && sessionSettingsStore.sessions[targetSessionId]) {
          delete sessionSettingsStore.sessions[targetSessionId]
          saveSessionSettingsStore(sessionSettingsStore)
          setSessionSettingsStore(sessionSettingsStore)
          mcpManager?.syncAll()
        }

        res.writeHead(200)
        res.end(
          JSON.stringify({
            ok: true,
            sessionId: targetSessionId,
            workspaceId: targetWorkspaceId,
            sessionConfig: {
              subagentModel: {
                mode: 'workspace',
              },
              mcp: {
                mode: 'workspace',
              },
              skills: {
                mode: 'workspace',
              },
            },
            workspaceConfig:
              targetWorkspaceId &&
              sessionSettingsStore.workspaces?.[targetWorkspaceId]
                ? sessionSettingsStore.workspaces[targetWorkspaceId]
                : {
                    subagentModel: { mode: 'global' },
                    mcp: { mode: 'global' },
                    skills: { mode: 'global' },
                  },
            globalConfig: sessionSettingsStore.globalConfig,
          }),
        )
      } catch (err: unknown) {
        res.writeHead(500)
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    },
  })

  return () => {
    unregisterGetSettingsRoute()
    unregisterSaveSettingsRoute()
    unregisterDeleteSettingsRoute()
  }
}
