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
  type UseSessionsHook,
  type UseWorkspacesHook,
} from '../types/index.ts'
import { isSessionCustomized } from '../utils/config.ts'
import { resolvePageWorkspace } from '../utils/sessionScope.ts'

const e = React.createElement

/**
 * Stable empty snapshots for the `useSyncExternalStore` fallbacks.
 *
 * These MUST be module-level constants: a fresh object literal returned from
 * `getSnapshot` reads as a changed snapshot every time, which spins the
 * subscription whenever the store is absent. They also keep the chip renderable
 * from a slot registration that has not resolved the stores yet.
 */
const EMPTY_SESSIONS: SessionsState = { byId: {} }
const EMPTY_WORKSPACES: WorkspacesState = { items: [] }

/**
 * The selector that asks a standard slot hook for the whole snapshot.
 *
 * The framework's selector hooks always take a selector function; there is no
 * zero-argument overload. Passing this is what makes "give me the raw state"
 * explicit instead of a silent `selector is not a function` throw.
 */
const identity = <T>(state: T): T => state

/**
 * Props the chip receives.
 *
 * `conversation.hero.options` is a session-scoped list slot, so the framework
 * delivers the live session identity and the session/workspace selector hooks.
 * Reading them from here is what keeps the chip on the same identity the
 * surrounding conversation shows; the previous version reached into
 * `ctx.get('sessions')` and re-derived the "current session" rule itself.
 */
export interface SessionSettingsHeroChipProps {
  remote?: ClientRemoteServiceRef
  /**
   * Translator namespace source.
   *
   * Locale is a process-wide service, not session identity, so it is still
   * resolved once at registration and handed down; only the session/workspace
   * identity moved to the slot's standard props.
   */
  locale?: {
    bind?: (
      ns: string,
    ) => (key: string, vars?: Record<string, string | number>) => string
  }
  /** The slot's own session — the conversation this chip sits in. */
  sessionId?: string
  useSessions?: UseSessionsHook
  useWorkspaces?: UseWorkspacesHook
  /** Legacy fallback: a directly supplied store, used when no slot props exist. */
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
  sessionId,
  useSessions,
  useWorkspaces,
}: SessionSettingsHeroChipProps) {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false)
  const [hasOverride, setHasOverride] = React.useState<boolean>(false)

  const t = React.useMemo(
    () => (locale?.bind ? locale.bind(LOCALE_NS) : (k: string) => k),
    [locale],
  )

  // The framework's own selectors, handed to every session-scoped slot. There
  // is deliberately no direct-store fallback: the seat always provides them,
  // and a second identity path is what let the chip disagree with the
  // conversation it sits in.
  //
  // The selector argument is REQUIRED: the framework synthesizes these as
  // `useSyncExternalStoreWithSelector(subscribe, getSnapshot, undefined, sel)`,
  // which calls `sel(state)` on every render. Calling one with no argument
  // throws "selector is not a function" and takes the whole chip down with it.
  // `identity` is what reads the bare snapshot.
  const sessionsState = useSessions?.(identity) as SessionsState | undefined
  const workspacesState = useWorkspaces?.(identity) as
    WorkspacesState | undefined

  // The slot's own session is the identity. Deriving it from the store instead
  // re-implemented the host's "current session" rule next to the framework's.
  const currentSessionId = sessionId

  const currentWorkspace = resolvePageWorkspace({
    sessions: sessionsState,
    workspaces: workspacesState,
    sessionId: currentSessionId,
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
                // The page reads through the same contract as the host
                // hooks: a selector is always supplied. The chip already holds
                // the snapshot, so this applies it directly instead of opening a
                // second subscription.
                useSessions: (selector) =>
                  selector(sessionsState ?? EMPTY_SESSIONS),
                useWorkspaces: (selector) =>
                  selector(workspacesState ?? EMPTY_WORKSPACES),
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
