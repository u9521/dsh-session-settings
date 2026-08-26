import * as React from 'react'
import { IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'

const e = React.createElement

export interface ModalDialogProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  headerExtra?: React.ReactNode
  panelClassName?: string
  overlayClassName?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  role?: string
  ariaLabel?: string
  closeTitle?: string
}

export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  headerExtra,
  panelClassName = '',
  overlayClassName = 'dsh-sam-modal-overlay',
  children,
  footer,
  role = 'dialog',
  ariaLabel,
  closeTitle = '关闭',
}: ModalDialogProps) {
  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const resolvedPanelClassName = Array.from(
    new Set([
      'dsh-sam-modal-panel',
      ...(panelClassName ? panelClassName.trim().split(/\s+/) : []),
    ]),
  ).join(' ')

  return e(
    'div',
    {
      className: overlayClassName,
      onClick: (evt: React.MouseEvent) => {
        if (evt.target === evt.currentTarget) {
          onClose()
        }
      },
    },
    e(
      'div',
      {
        className: resolvedPanelClassName,
        role,
        'aria-modal': true,
        'aria-label':
          ariaLabel || (typeof title === 'string' ? title : undefined),
      },
      e(
        'div',
        { className: 'dsh-sam-header-row' },
        e(
          'div',
          { className: 'dsh-mcp-tools-header-info' },
          e(
            'h3',
            {
              className: 'dsh-sam-title',
              style: { display: 'flex', alignItems: 'center', gap: 8 },
            },
            icon,
            title,
          ),
          headerExtra
            ? e('div', { className: 'dsh-mcp-tools-header-meta' }, headerExtra)
            : null,
        ),
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-sam-close-btn',
            onClick: onClose,
            title: closeTitle,
          },
          e(IconCloseOutline16, { size: 16 }),
        ),
      ),
      subtitle
        ? e(
            'p',
            { className: 'dsh-sam-desc', style: { margin: '4px 24px 0' } },
            subtitle,
          )
        : null,
      e('div', { className: 'dsh-sam-modal-body' }, children),
      footer
        ? e(
            'div',
            { className: 'dsh-sam-actions dsh-mcp-modal-footer' },
            footer,
          )
        : null,
    ),
  )
}
