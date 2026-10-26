import * as React from 'react'
import { ModalDialog } from '../../components/index.ts'
import type { McpImportSkip } from '../../types/index.ts'

const e = React.createElement

export interface McpImportExportModalProps {
  open: boolean
  text: string
  onChange: (text: string) => void
  importing: boolean
  error?: string
  /** Entries the server refused, shown as-is so the user can fix them. */
  skipped?: McpImportSkip[]
  onPickFile: (evt: React.ChangeEvent<HTMLInputElement>) => void
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
  skipped,
  onPickFile,
  onSubmit,
  onClose,
  t,
}: McpImportExportModalProps) {
  if (!open) return null

  const fileInputId = React.useId()

  return e(
    ModalDialog,
    {
      open,
      onClose,
      title: t('mcpServers.importModal.title'),
      subtitle: t('mcpServers.importModal.desc'),
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
            t('mcpServers.actions.cancel'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              disabled: importing || !text.trim(),
              onClick: onSubmit,
            },
            importing
              ? t('mcpServers.importModal.importing')
              : t('mcpServers.importModal.confirm'),
          ),
        ),
      ],
    },
    error ? e('div', { className: 'dsh-sam-notice error' }, error) : null,
    // A file picker beside the textarea: the textarea alone is a paste box, and
    // "import" that cannot open a file is a gap, not a design.
    e(
      'div',
      { className: 'dsh-mcp-import-file-row' },
      e(
        'label',
        {
          className: 'dsh-sam-btn secondary dsh-mcp-import-file-btn',
          htmlFor: fileInputId,
        },
        t('mcpServers.importModal.pickFile'),
      ),
      e('input', {
        id: fileInputId,
        type: 'file',
        accept: '.json,application/json',
        className: 'dsh-mcp-import-file-input',
        onChange: onPickFile,
      }),
      e(
        'span',
        { className: 'dsh-mcp-import-file-hint' },
        t('mcpServers.importModal.pickFileHint'),
      ),
    ),
    e('textarea', {
      className: 'dsh-mcp-import-textarea',
      rows: 10,
      placeholder: t('mcpServers.importModal.placeholder'),
      value: text,
      onChange: (evt: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange(evt.target.value),
    }),
    skipped && skipped.length > 0
      ? e(
          'ul',
          { className: 'dsh-mcp-import-skipped' },
          skipped.map((entry, index) =>
            e(
              'li',
              {
                key: `${entry.key}-${index}`,
                className: 'dsh-mcp-import-skip',
              },
              e('code', null, entry.key),
              e('span', null, entry.reason),
            ),
          ),
        )
      : null,
  )
}
