import * as React from 'react'
import { ModalDialog } from '../../components/index.ts'

const e = React.createElement

export interface McpImportExportModalProps {
  open: boolean
  text: string
  onChange: (text: string) => void
  importing: boolean
  error?: string
  onSubmit: () => void
  onClose: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function McpImportExportModal({
  open,
  text,
  onChange,
  importing,
  error,
  onSubmit,
  onClose,
  t,
}: McpImportExportModalProps) {
  if (!open) return null

  return e(
    ModalDialog,
    {
      open,
      onClose,
      title: t('importModal.title'),
      subtitle: t('importModal.desc'),
      panelClassName: 'dsh-mcp-import-modal',
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
              onClick: onClose,
            },
            t('actions.cancel'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: importing || !text.trim(),
              onClick: onSubmit,
            },
            importing ? t('importModal.importing') : t('importModal.confirm'),
          ),
        ),
      ],
    },
    error ? e('div', { className: 'dsh-sam-notice error' }, error) : null,
    e('textarea', {
      className: 'dsh-mcp-import-textarea',
      rows: 10,
      placeholder: t('importModal.placeholder'),
      value: text,
      onChange: (evt: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange(evt.target.value),
    }),
  )
}
