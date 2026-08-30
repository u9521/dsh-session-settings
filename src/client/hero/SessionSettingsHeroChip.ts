import * as React from 'react'
import { createPortal } from 'react-dom'
import { IconSettingsOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { SessionSettingsViewPage } from '../session/index.ts'
import {
  LOCALE_NS,
  API_ENDPOINTS,
  type ClientRemoteApi,
  type SessionsState,
  type WorkspacesState,
  type WorkspaceInfo,
  type SessionSettingsConfig,
} from '../types/index.ts'
import { isSessionCustomized } from '../utils/config.ts'

const e = React.createElement

export interface SessionSettingsHeroChipProps {
  api: ClientRemoteApi
  locale?: {
    bind?: (
      ns: string,
    ) => (key: string, vars?: Record<string, string | number>) => string
  }
  sessions?: {
    list?: {
      subscribe: (cb: () => void) => () => void
      getSnapshot: () => SessionsState
    }
  }
  workspaces?: {
    list?: {
      subscribe: (cb: () => void) => () => void
      getSnapshot: () => WorkspacesState
    }
  }
}

export function SessionSettingsHeroChip({
  api,
  locale,
  sessions,
  workspaces,
}: SessionSettingsHeroChipProps) {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false)
  const [hasOverride, setHasOverride] = React.useState<boolean>(false)

  const t = React.useMemo(
    () => (locale?.bind ? locale.bind(LOCALE_NS) : (k: string) => k),
    [locale],
  )

  // Subscribe to sessions list state to reactively track current session
  const sessionsState = React.useSyncExternalStore<SessionsState>(
    sessions?.list?.subscribe
      ? sessions.list.subscribe.bind(sessions.list)
      : () => () => {},
    sessions?.list?.getSnapshot
      ? sessions.list.getSnapshot.bind(sessions.list)
      : () => ({ current: undefined, byId: {} }),
  )

  // Subscribe to workspaces list state to reactively track workspace
  const workspacesState = React.useSyncExternalStore<WorkspacesState>(
    workspaces?.list?.subscribe
      ? workspaces.list.subscribe.bind(workspaces.list)
      : () => () => {},
    workspaces?.list?.getSnapshot
      ? workspaces.list.getSnapshot.bind(workspaces.list)
      : () => ({ items: [], recentWorkspaceId: undefined }),
  )

  const currentSessionId = sessionsState?.current
  const currentSession =
    currentSessionId && sessionsState?.byId
      ? sessionsState.byId[currentSessionId]
      : currentSessionId && Array.isArray(sessionsState?.items)
        ? sessionsState.items.find((s) => s?.id === currentSessionId)
        : undefined

  const workspaceItems: WorkspaceInfo[] = Array.isArray(workspacesState?.items)
    ? workspacesState.items
    : []
  const currentWorkspace =
    workspaceItems.find(
      (w) =>
        (currentSessionId &&
          Array.isArray(w?.sessionIds) &&
          w.sessionIds.includes(currentSessionId)) ||
        (currentSession?.cwd &&
          (w?.path === currentSession.cwd || w?.cwd === currentSession.cwd)),
    ) ??
    (!currentSessionId && workspacesState?.recentWorkspaceId
      ? workspaceItems.find(
          (w) =>
            w.workspaceId === workspacesState.recentWorkspaceId ||
            w.id === workspacesState.recentWorkspaceId,
        )
      : workspaceItems[0])
  const currentWorkspaceId =
    currentWorkspace?.workspaceId ?? currentWorkspace?.id
  const currentWorkspaceTitle =
    currentWorkspace?.title ?? currentWorkspace?.name ?? currentWorkspace?.path

  // Fetch whether current session has an override
  const checkOverride = React.useCallback(() => {
    if (!currentSessionId) {
      setHasOverride(false)
      return
    }
    fetch(
      `${API_ENDPOINTS.getSettings}?sessionId=${encodeURIComponent(currentSessionId)}`,
    )
      .then((res) => res.json())
      .then((data: { ok?: boolean; sessionConfig?: unknown }) => {
        if (data?.ok) {
          setHasOverride(
            isSessionCustomized(
              data.sessionConfig as SessionSettingsConfig | undefined,
            ),
          )
        }
      })
      .catch(() => {})
  }, [currentSessionId])

  React.useEffect(() => {
    checkOverride()
  }, [checkOverride])

  // ESC key listener to close modal
  React.useEffect(() => {
    if (!modalOpen) return
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  return e(
    React.Fragment,
    null,
    e(
      'button',
      {
        type: 'button',
        className: `dsh-hero-session-settings-chip ${modalOpen ? 'active' : ''} ${hasOverride ? 'customized' : ''}`,
        title: t('sessionSettings.heroChipHint'),
        onClick: () => setModalOpen(true),
        'aria-haspopup': 'dialog',
        'aria-expanded': modalOpen,
      },
      e(IconSettingsOutline16, {
        size: 16,
        className: 'dsh-hero-session-settings-icon',
      }),
      e(
        'span',
        { className: 'dsh-hero-session-settings-label' },
        t('sessionSettings.title'),
      ),
      hasOverride
        ? e(
            'span',
            { className: 'dsh-hero-session-settings-badge highlight' },
            t('sessionSettings.scope.sessionCustom'),
          )
        : null,
    ),
    modalOpen
      ? createPortal(
          e(
            'div',
            {
              className: 'dsh-sam-modal-overlay',
              onClick: (evt: React.MouseEvent) => {
                if (evt.target === evt.currentTarget) {
                  setModalOpen(false)
                }
              },
            },
            e(
              'div',
              {
                className: 'dsh-session-settings-modal-panel',
                role: 'dialog',
                'aria-modal': true,
                'aria-label': t('sessionSettings.title'),
              },
              e(SessionSettingsViewPage, {
                api,
                t,
                sessionId: currentSessionId,
                workspaceId: currentWorkspaceId,
                workspaceTitle: currentWorkspaceTitle,
                useSessions: (selector) =>
                  selector ? selector(sessionsState) : sessionsState,
                useWorkspaces: (selector) =>
                  selector ? selector(workspacesState) : workspacesState,
                onClose: () => setModalOpen(false),
                onSave: () => {
                  checkOverride()
                },
              }),
            ),
          ),
          document.body,
        )
      : null,
  )
}

export default SessionSettingsHeroChip
