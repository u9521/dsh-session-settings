import type { Context } from '@deepseek-ai/cordis'
import type { Agent, Session } from '../../types.ts'

interface WorkspaceRegistryService {
  list?: () => Array<{ sessionIds?: string[]; id?: string }>
  resolveByPath?: (path: string) => Promise<{ id?: string } | undefined>
}

/**
 * Resolves the effective session ID from an Agent.
 * If the agent belongs to a subagent session, returns the parent session ID so that
 * the subagent inherits the root/parent session's configured overrides.
 * Otherwise, returns the session ID or agent ID directly.
 */
export function resolveAgentSessionId(
  agent?: Agent,
  ctx?: Context,
): string | undefined {
  if (!agent) return undefined
  const session = agent.session
  if (session?.header?.origin === 'subagent' && session.header.parentSession) {
    let parentId: string | undefined = session.header.parentSession
    if (ctx) {
      try {
        const sessionsService = ctx.get('sessions')
        while (parentId) {
          const parentSession: Session | undefined =
            sessionsService?.get?.(parentId)
          if (
            parentSession?.header?.origin === 'subagent' &&
            parentSession.header.parentSession
          ) {
            parentId = parentSession.header.parentSession
          } else {
            break
          }
        }
      } catch {
        // Ignore resolution error
      }
    }
    return parentId
  }
  return session?.id ?? agent.id
}

/**
 * Resolves the working directory (cwd) for a given session ID,
 * checking live sessions first, then inspecting persistent session storage.
 */
export async function resolveSessionCwd(
  ctx: Context,
  sessionId?: string,
): Promise<string | undefined> {
  if (!sessionId) return undefined
  try {
    const sessionsService = ctx.get('sessions')
    const liveSession = sessionsService?.get?.(sessionId)
    if (liveSession?.header?.cwd) {
      return liveSession.header.cwd
    }

    const persistence = ctx.get('sessionPersistence')
    if (persistence && typeof persistence.inspect === 'function') {
      const inspected = await persistence.inspect(sessionId)
      if (inspected?.meta?.cwd) {
        return inspected.meta.cwd
      }
    }
  } catch {
    // Ignore resolution errors
  }
  return undefined
}

/**
 * Resolves the workspace ID associated with a given session ID.
 */
export async function resolveWorkspaceForSession(
  ctx: Context,
  sessionId?: string,
): Promise<string | undefined> {
  if (!sessionId) return undefined
  try {
    const workspaceRegistry = ctx.get('workspaceRegistry') as
      WorkspaceRegistryService | undefined

    // 1. Fast check: search indexed workspace sessionIds
    if (workspaceRegistry && typeof workspaceRegistry.list === 'function') {
      const workspaces = workspaceRegistry.list()
      const matched = workspaces.find(
        (w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(sessionId),
      )
      if (matched?.id) return matched.id
    }

    // 2. Resolve via session cwd if not yet indexed in sessionIds
    const rawCwd = await resolveSessionCwd(ctx, sessionId)
    if (
      rawCwd &&
      workspaceRegistry &&
      typeof workspaceRegistry.resolveByPath === 'function'
    ) {
      const matchedWorkspace = await workspaceRegistry.resolveByPath(rawCwd)
      if (matchedWorkspace?.id) return matchedWorkspace.id
    }
  } catch {
    // Ignore resolution errors
  }
  return undefined
}
