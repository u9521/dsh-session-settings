import * as React from 'react'
import { createPortal } from 'react-dom'
import { IconSettingsOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import { SessionSettingsViewPage } from '../session/index.ts'
import {
  LOCALE_NS,
  API_ENDPOINTS,
  type ClientRemoteServiceRef,
  type SessionsState,
  type WorkspacesState,
  type SessionSettingsConfig,
} from '../types/index.ts'
import { isSessionCustomized } from '../utils/config.ts'
import {
  resolveMainSessionId,
  resolvePageWorkspace,
} from '../utils/sessionScope.ts'

const e = React.createElement

/**
 * Stable empty snapshots for the `useSyncExternalStore` fallbacks.
 *
 * These MUST be module-level constants: a fresh object literal returned from
 * `getSnapshot` reads as a changed snapshot every time, which spins the
 * subscription whenever the store is absent.
 */
const EMPTY_SESSIONS: SessionsState = { byId: {}, current: undefined }
const EMPTY_WORKSPACES: WorkspacesState = {
  items: [],
  recentWorkspaceId: undefined,
}

export interface SessionSettingsHeroChipProps {
  remote?: ClientRemoteServiceRef
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
  remote,
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
      : () => EMPTY_SESSIONS,
  )

  // Subscribe to workspaces list state to reactively track workspace
  const workspacesState = React.useSyncExternalStore<WorkspacesState>(
    workspaces?.list?.subscribe
      ? workspaces.list.subscribe.bind(workspaces.list)
      : () => () => {},
    workspaces?.list?.getSnapshot
      ? workspaces.list.getSnapshot.bind(workspaces.list)
      : () => EMPTY_WORKSPACES,
  )

  // The hero page always has a session: picking a workspace connects its blank
  // one, and that session is what the main view retains. Resolving it is what
  // lets a session-scope save land on the conversation about to start, and what
  // makes the workspace follow a switch.
  const currentSessionId = resolveMainSessionId(sessionsState)

  const currentWorkspace = resolvePageWorkspace({
    sessions: sessionsState,
    workspaces: workspacesState,
  })
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
      e(IconSettingsOutlineMedium, {
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
                remote,
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
