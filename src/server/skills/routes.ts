import type { Context } from '@deepseek-ai/cordis'
import { getAvailableSkills, getSkillDetail } from './discovery.ts'
import {
  type ConnectionService,
  type SessionSettingsStore,
  type SettingsSnapshotResponse,
} from '../../types.ts'
import { badRequest, jsonResponse, toFetchRoute } from '../common/http.ts'

export function registerSkillsRoutes(
  ctx: Context,
  connection: ConnectionService,
  getSessionSettingsStore?: () => SessionSettingsStore,
): () => Promise<void> {
  const unregisterSkills = connection.fetch.register(
    toFetchRoute({
      endpoint: 'skills',
      handler: async (request) => {
        const query = new URL(request.url).searchParams
        const reqSessionId = (query.get('sessionId') || '').trim() || undefined

        try {
          const skills = await getAvailableSkills(
            ctx,
            reqSessionId,
            getSessionSettingsStore?.(),
          )
          return jsonResponse({ ok: true, skills })
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

  const unregisterSkillContent = connection.fetch.register(
    toFetchRoute({
      endpoint: 'skillsContent',
      handler: async (request) => {
        const query = new URL(request.url).searchParams
        const skillName = (query.get('name') || '').trim()
        const reqSessionId = (query.get('sessionId') || '').trim() || undefined

        if (!skillName) return badRequest('Skill name is required')

        try {
          const skill = await getSkillDetail(
            ctx,
            skillName,
            reqSessionId,
            getSessionSettingsStore?.(),
          )
          if (!skill) {
            const notFound: SettingsSnapshotResponse = {
              ok: false,
              error: `Skill "${skillName}" not found`,
            }
            return jsonResponse(notFound, 404)
          }
          return jsonResponse({ ok: true, skill })
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

  return async () => {
    await unregisterSkills()
    await unregisterSkillContent()
  }
}
