import * as React from 'react'
import { IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GlobalMcpServerConfig } from '../../types/index.ts'
import { ModalDialog } from '../../components/index.ts'

const e = React.createElement

export interface McpSaveConfirmModalProps {
  confirmState: {
    open: boolean
    message: string
    payload: GlobalMcpServerConfig
  } | null
  onCancel: () => void
  onConfirm: (payload: GlobalMcpServerConfig) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function McpSaveConfirmModal({
  confirmState,
  onCancel,
  onConfirm,
  t,
}: McpSaveConfirmModalProps) {
  if (!confirmState?.open) return null

  return e(
    ModalDialog,
    {
      open: Boolean(confirmState?.open),
      onClose: onCancel,
      title: t('saveConfirmModal.title'),
      icon: e(IconWarningOutline16, { size: 18 }),
      overlayClassName: 'dsh-sam-modal-overlay dsh-mcp-confirm-overlay',
      panelClassName: 'dsh-mcp-confirm-modal',
      footer: [
        e('div', { key: 'left', className: 'dsh-mcp-modal-footer-left' }),
        e(
          'div',
          { key: 'right', className: 'dsh-mcp-modal-footer-right' },
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn secondary',
              onClick: onCancel,
            },
            t('saveConfirmModal.cancel'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              onClick: () => onConfirm(confirmState.payload),
            },
            t('saveConfirmModal.saveAnyway'),
          ),
        ),
      ],
    },
    e('p', { className: 'dsh-mcp-confirm-msg' }, t('saveConfirmModal.message')),
    e('div', { className: 'dsh-mcp-confirm-detail' }, confirmState.message),
    e(
      'p',
      { className: 'dsh-mcp-confirm-prompt' },
      t('saveConfirmModal.prompt'),
    ),
  )
}
