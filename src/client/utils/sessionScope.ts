import type {
  SessionsState,
  SessionInfo,
  WorkspacesState,
  WorkspaceInfo,
} from '../types/index.ts'

/**
 * Identity resolution for the page a Session-settings surface is rendering.
 *
 * DSH 0.2.0 removed both fields the surfaces used to read: `SessionListState`
 * carries no `current` and `WorkspaceListState` carries no `recentWorkspaceId`.
 * Reading them is not an error — it silently yields `undefined` — so a page
 * that keyed its workspace off them collapsed to a constant (the first
 * workspace in host order) and stopped following a workspace switch.
 *
 * The two 0.2.0 equivalents are recovered here, in one place, so the hero chip
 * and the view page cannot drift apart:
 *
 * - "current session" is the row the main view retains (`retainedBy.mainView`),
 *   which is exactly how the official `dsh-client-ui-session` picks it.
 * - "recent workspace" is derived from member-session recency, which is exactly
 *   the host's own `recentWorkspace()` rule.
 *
 * Both legacy fields are still consulted LAST, so an older host (or a test
 * double) that does provide them keeps working.
 */

/** The row the main view currently retains, or the legacy `current` fallback. */
export function resolveMainSessionId(
  sessions?: SessionsState,
): string | undefined {
  const byId = sessions?.byId
  if (byId) {
    // Exactly the official `dsh-client-ui-session` fallback: the first row the
    // main view retains, in host list order. A switch retains the incoming
    // session and releases the outgoing one in the same synchronous step, so
    // this never observes two holders and needs no remembered preference.
    for (const id of Object.keys(byId)) {
      if ((byId[id]?.retainedBy?.mainView ?? 0) > 0) return id
    }
  }
  // Legacy (pre-0.2.0) shape, kept as a graceful degradation only.
  return sessions?.current
}

/**
 * Most recently active workspace, mirroring the host's own tie-breaking:
 * latest member-session `updatedAt`, or the workspace's `createdAt` when it
 * holds none, with host order deciding ties.
 *
 * @returns the workspace id, or `undefined` when there is nothing to rank.
 */
export function resolveRecentWorkspaceId(
  workspaces?: WorkspacesState,
  sessions?: SessionsState,
): string | undefined {
  const items = workspaces?.items
  if (!Array.isArray(items) || items.length === 0) return undefined

  const byId = sessions?.byId ?? {}
  let selected: string | undefined
  let selectedTime = Number.NEGATIVE_INFINITY

  for (const workspace of items) {
    const id = workspace?.workspaceId ?? workspace?.id
    if (!id) continue

    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of workspace.sessionIds ?? []) {
      const updatedAt = byId[sessionId]?.updatedAt
      if (typeof updatedAt === 'number') latest = Math.max(latest, updatedAt)
    }
    if (latest === Number.NEGATIVE_INFINITY) {
      const created = Date.parse(workspace.createdAt ?? '')
      latest = Number.isNaN(created) ? Number.NEGATIVE_INFINITY : created
    }

    // Strictly greater: host order wins ties, so an equal timestamp must not
    // displace the earlier workspace.
    if (selected === undefined || latest > selectedTime) {
      selected = id
      selectedTime = latest
    }
  }

  // Legacy (pre-0.2.0) field, consulted only when recency ranked nothing.
  if (selected === undefined && workspaces?.recentWorkspaceId) {
    return workspaces.recentWorkspaceId
  }
  return selected
}

/** The inputs one page's workspace resolution depends on. */
export interface PageWorkspaceInput {
  sessions?: SessionsState
  workspaces?: WorkspacesState
  /** Explicit session identity (the slot's `sessionId` prop). */
  sessionId?: string
  /** Explicit workspace identity (the page's `workspaceId` prop). */
  workspaceId?: string
}

/**
 * Resolve the workspace a Session-settings page belongs to.
 *
 * Priority: an explicitly named workspace, then an explicitly named session's
 * membership, then the main-view session's membership (by `sessionIds`, then by
 * `cwd`), then workspace recency.
 *
 * There is deliberately NO "first workspace in the list" fallback. A page that
 * cannot establish a workspace must say so — the workspace tab disables itself
 * and no workspace chip renders — because naming an arbitrary workspace is how
 * a switch came to look like it had been ignored.
 *
 * @returns the owning workspace, or `undefined` when none can be established.
 */
export function resolvePageWorkspace({
  sessions,
  workspaces,
  sessionId,
  workspaceId,
}: PageWorkspaceInput): WorkspaceInfo | undefined {
  const items = workspaces?.items
  if (!Array.isArray(items) || items.length === 0) return undefined

  const byWorkspaceId = (id?: string): WorkspaceInfo | undefined =>
    id ? items.find((w) => w?.workspaceId === id || w?.id === id) : undefined

  const bySession = (id?: string): WorkspaceInfo | undefined => {
    if (!id) return undefined
    const member = items.find(
      (w) => Array.isArray(w?.sessionIds) && w.sessionIds.includes(id),
    )
    if (member) return member
    // A freshly created session can be attached a beat after it is listed, so
    // fall back to the cwd it was created against.
    const cwd = sessions?.byId?.[id]?.cwd
    if (!cwd) return undefined
    return items.find((w) => w?.path === cwd || w?.cwd === cwd)
  }

  const explicit = byWorkspaceId(workspaceId) ?? bySession(sessionId)
  if (explicit) return explicit

  const mainId = resolveMainSessionId(sessions)
  const fromMain = bySession(mainId)
  if (fromMain) return fromMain

  return byWorkspaceId(resolveRecentWorkspaceId(workspaces, sessions))
}

/** A session row's main-view retention count, or 0 when unknown. */
export function mainViewRetention(session?: SessionInfo): number {
  return session?.retainedBy?.mainView ?? 0
}
