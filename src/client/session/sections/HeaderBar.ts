import * as React from 'react'
import {
  IconCloseOutlineMedium,
  IconCopyOutlineMedium,
  IconCheckOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceInfo } from '../../types/index.ts'

const e = React.createElement

export type SettingsScope = 'session' | 'workspace' | 'global'

export interface HeaderBarProps {
  activeScope: SettingsScope
  sessionId?: string
  copiedId: boolean
  currentWorkspaceId?: string
  currentWorkspaceTitle?: string
  currentWorkspace?: WorkspaceInfo
  onCopySessionId: () => void
  onClose?: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function HeaderBar({
  activeScope,
  sessionId,
  copiedId,
  currentWorkspaceTitle,
  currentWorkspace,
  onCopySessionId,
  onClose,
  t,
}: HeaderBarProps) {
  const hasMeta = Boolean(sessionId || currentWorkspaceTitle)

  const titleText =
    activeScope === 'workspace'
      ? t('sessionSettings.titles.workspace')
      : activeScope === 'global'
        ? t('sessionSettings.titles.global')
        : t('sessionSettings.titles.session')

  return e(
    'div',
    { className: 'dsh-session-view-header' },
    // Left group: Dynamic Page Title ("会话设置" / "工作区设置" / "全局设置") + Metadata Chips
    e(
      'div',
      { className: 'dsh-session-view-header-left' },
      e('h2', { className: 'dsh-session-view-title' }, titleText),
      hasMeta
        ? e(
            'div',
            { className: 'dsh-session-view-header-meta' },
            sessionId
              ? e(
                  'button',
                  {
                    type: 'button',
                    className: `dsh-session-id-chip ${copiedId ? 'copied' : ''}`,
                    onClick: onCopySessionId,
                    title: t('sessionSettings.action.copyId'),
                  },
                  copiedId
                    ? e(IconCheckOutlineMedium, { size: 13 })
                    : e(IconCopyOutlineMedium, { size: 13 }),
                  e(
                    'span',
                    null,
                    copiedId ? t('sessionSettings.idCopied') : sessionId,
                  ),
                )
              : null,
            currentWorkspaceTitle
              ? e(
                  'span',
                  {
                    className: 'dsh-session-id-chip dsh-header-workspace-chip',
                    title: currentWorkspace?.path || currentWorkspaceTitle,
                  },
                  `${t('sessionSettings.scope.workspaceLabel')}: ${currentWorkspaceTitle}`,
                )
              : null,
          )
        : null,
    ),

    // Right group: Close Button
    onClose
      ? e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-close-btn',
            onClick: onClose,
            title: t('sessionSettings.action.close'),
          },
          e(IconCloseOutlineMedium, { size: 16 }),
        )
      : null,
  )
}
