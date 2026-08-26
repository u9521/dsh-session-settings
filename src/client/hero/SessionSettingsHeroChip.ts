import * as React from 'react'
import { createPortal } from 'react-dom'
import { IconSettingsOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { SessionSettingsViewPage } from '../session/index.ts'
import { LOCALE_NS } from '../types/index.ts'
import {
  getLocalSessionSettingsStore,
  getSessionRawSettings,
} from '../storage/index.ts'

const e = React.createElement

export interface SessionSettingsHeroChipProps {
  api: any
  locale?: any
  sessions?: any
  workspaces?: any
}

export function SessionSettingsHeroChip({
  api,
  locale,
  sessions,
  workspaces,
}: SessionSettingsHeroChipProps) {
  const [modalOpen, setModalOpen] = React.useState<boolean>(false)
  const [storeVer, setStoreVer] = React.useState<number>(0)
  const [localeVer, setLocaleVer] = React.useState<number>(0)

  // Subscribe to locale updates for dynamic re-translation
  React.useEffect(() => {
    if (!locale?.subscribe) return
    return locale.subscribe(() => setLocaleVer((v) => v + 1))
  }, [locale])

  const translator = React.useMemo(
    () => (locale?.bind ? locale.bind(LOCALE_NS) : (k: string) => k),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, localeVer],
  )

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let res = translator(key, vars)
      if (res && res !== key) return res
      if (!key.startsWith('sessionSettings.')) {
        res = translator(`sessionSettings.${key}`, vars)
        if (res && res !== `sessionSettings.${key}`) return res
      }
      return res || key
    },
    [translator],
  )

  // Subscribe to sessions list state to reactively track current session
  const sessionsState = React.useSyncExternalStore(
    sessions?.list?.subscribe
      ? sessions.list.subscribe.bind(sessions.list)
      : () => () => {},
    sessions?.list?.getSnapshot
      ? sessions.list.getSnapshot.bind(sessions.list)
      : () => ({ current: undefined, byId: {} }),
  )

  // Subscribe to workspaces list state to reactively track workspace
  const workspacesState = React.useSyncExternalStore(
    workspaces?.list?.subscribe
      ? workspaces.list.subscribe.bind(workspaces.list)
      : () => () => {},
    workspaces?.list?.getSnapshot
      ? workspaces.list.getSnapshot.bind(workspaces.list)
      : () => ({ items: [], recentWorkspaceId: undefined }),
  )

  const currentSessionId = (sessionsState as any)?.current

  const workspaceItems = Array.isArray((workspacesState as any)?.items)
    ? (workspacesState as any).items
    : []
  const currentWorkspace =
    workspaceItems.find(
      (w: any) =>
        (currentSessionId &&
          w.sessionIds &&
          Array.isArray(w.sessionIds) &&
          w.sessionIds.includes(currentSessionId)) ||
        w.isCurrent ||
        w.active,
    ) || workspaceItems[0]
  const currentWorkspaceId =
    currentWorkspace?.workspaceId || currentWorkspace?.id
  const currentWorkspaceTitle =
    currentWorkspace?.title || currentWorkspace?.name || currentWorkspace?.path

  // Check if current session has custom override
  const hasOverride = React.useMemo(() => {
    // Reference storeVer to trigger re-computation on save
    void storeVer
    const localStore = getLocalSessionSettingsStore()
    const raw = getSessionRawSettings(
      localStore,
      currentSessionId,
      currentWorkspaceId,
    )
    return raw.hasOverride
  }, [currentSessionId, currentWorkspaceId, storeVer])

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
        title: t('sessionSettings.heroChipHint') || t('sessionSettings.desc'),
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
                useSessions: (selector?: any) =>
                  typeof selector === 'function'
                    ? selector(sessionsState)
                    : sessionsState,
                useWorkspaces: (selector?: any) =>
                  typeof selector === 'function'
                    ? selector(workspacesState)
                    : workspacesState,
                onClose: () => setModalOpen(false),
                onSave: () => {
                  setStoreVer((v) => v + 1)
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
