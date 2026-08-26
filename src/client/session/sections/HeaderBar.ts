import * as React from 'react'
import {
  IconCloseOutline16,
  IconCopyOutline16,
  IconCheckOutline16,
  IconBranchOutline16,
  IconLoadingOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'

const e = React.createElement

export interface HeaderBarProps {
  sessionId?: string
  copiedId: boolean
  currentWorkspaceId?: string
  currentWorkspaceTitle?: string
  currentWorkspace?: any
  hasSessionOverride: boolean
  cloneSourceId: string
  cloning: boolean
  onCloneSourceIdChange: (val: string) => void
  onCopySessionId: () => void
  onClonePreset: () => void
  onClose?: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function HeaderBar({
  sessionId,
  copiedId,
  currentWorkspaceId,
  currentWorkspaceTitle,
  currentWorkspace,
  hasSessionOverride,
  cloneSourceId,
  cloning,
  onCloneSourceIdChange,
  onCopySessionId,
  onClonePreset,
  onClose,
  t,
}: HeaderBarProps) {
  const hasMeta = Boolean(sessionId || currentWorkspaceTitle)

  return e(
    'div',
    { className: 'dsh-session-view-header' },
    // Row 1: Title ("会话设置") + Top-right Close Button ("✕")
    e(
      'div',
      { className: 'dsh-session-view-header-top' },
      e(
        'h2',
        { className: 'dsh-session-view-title' },
        t('sessionSettings.title'),
      ),
      onClose
        ? e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-close-btn',
              onClick: onClose,
              title: t('sessionSettings.action.close'),
            },
            e(IconCloseOutline16, { size: 16 }),
          )
        : null,
    ),
    // Row 2: Clone Preset Row ("克隆预设: [输入框] [克隆配置]")
    sessionId
      ? e(
          'div',
          { className: 'dsh-clone-toolbar' },
          e(
            'span',
            { className: 'dsh-clone-label' },
            t('sessionSettings.clone.toolbarTitle'),
          ),
          e('input', {
            type: 'text',
            className: 'dsh-clone-input',
            placeholder: t('sessionSettings.clone.inputPlaceholder'),
            value: cloneSourceId,
            onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
              onCloneSourceIdChange(evt.target.value),
            onKeyDown: (evt: React.KeyboardEvent<HTMLInputElement>) => {
              if (evt.key === 'Enter') onClonePreset()
            },
          }),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary dsh-clone-btn',
              disabled: cloning || !cloneSourceId.trim(),
              onClick: onClonePreset,
            },
            cloning
              ? e(IconLoadingOutline16, {
                  size: 13,
                  className: 'dsh-spin',
                })
              : e(IconBranchOutline16, {
                  size: 13,
                  className: 'dsh-btn-icon-left',
                }),
            cloning
              ? t('sessionSettings.clone.loading')
              : t('sessionSettings.clone.applyBtn'),
          ),
        )
      : null,
    // Row 3: Metadata Badge Row ([Session ID chip] [Workspace chip] [Status badge])
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
                  ? e(IconCheckOutline16, { size: 13 })
                  : e(IconCopyOutline16, { size: 13 }),
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
          sessionId
            ? e(
                'span',
                {
                  className: `dsh-sam-status-badge badge-${hasSessionOverride ? 'custom' : currentWorkspaceId ? 'workspace' : 'default'}`,
                },
                hasSessionOverride
                  ? t('sessionSettings.scope.sessionCustom')
                  : currentWorkspaceId
                    ? t('sessionSettings.scope.sessionWorkspace')
                    : t('sessionSettings.scope.sessionDefault'),
              )
            : null,
        )
      : null,
  )
}
