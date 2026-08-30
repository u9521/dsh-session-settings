import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { getAvailableSkills, getSkillDetail } from './discovery.ts'
import { API_ENDPOINTS, type WebServer } from '../../types.ts'

export function registerSkillsRoutes(
  ctx: Context,
  webServer: WebServer,
): () => void {
  const unregisterSkillsListRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.skills,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const reqSessionId =
        (url.searchParams.get('sessionId') || '').trim() || undefined

      try {
        const skills = await getAvailableSkills(ctx, reqSessionId)
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true, skills }))
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

  const unregisterSkillContentRoute = webServer.register({
    kind: 'exact',
    path: API_ENDPOINTS.skillsContent,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const skillName = (url.searchParams.get('name') || '').trim()
      const reqSessionId =
        (url.searchParams.get('sessionId') || '').trim() || undefined

      if (!skillName) {
        res.writeHead(400)
        res.end(JSON.stringify({ ok: false, error: 'Skill name is required' }))
        return
      }

      try {
        const skill = await getSkillDetail(ctx, skillName, reqSessionId)
        if (!skill) {
          res.writeHead(404)
          res.end(
            JSON.stringify({
              ok: false,
              error: `Skill "${skillName}" not found`,
            }),
          )
          return
        }

        res.writeHead(200)
        res.end(JSON.stringify({ ok: true, skill }))
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
    unregisterSkillsListRoute()
    unregisterSkillContentRoute()
  }
}
