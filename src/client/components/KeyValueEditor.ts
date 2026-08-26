import * as React from 'react'
import { IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EnvEntry } from '../types/index.ts'

const e = React.createElement

export interface KeyValueEditorProps {
  entries: EnvEntry[]
  onChange: (entries: EnvEntry[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  addLabel?: string
}

export function KeyValueEditor({
  entries,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addLabel = 'Add Item',
}: KeyValueEditorProps) {
  const handleKeyChange = (index: number, nextKey: string) => {
    const next = [...entries]
    next[index] = { ...next[index], key: nextKey }
    onChange(next)
  }

  const handleValueChange = (index: number, nextVal: string) => {
    const next = [...entries]
    next[index] = { ...next[index], value: nextVal }
    onChange(next)
  }

  const handleDelete = (index: number) => {
    const next = entries.filter((_, i) => i !== index)
    onChange(next)
  }

  const handleAdd = () => {
    onChange([...entries, { key: '', value: '' }])
  }

  return e(
    'div',
    { className: 'dsh-mcp-kv-list' },
    entries.map((entry, idx) =>
      e(
        'div',
        { key: idx, className: 'dsh-mcp-kv-row' },
        e('input', {
          type: 'text',
          className: 'dsh-sam-select',
          placeholder: keyPlaceholder,
          value: entry.key,
          onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
            handleKeyChange(idx, evt.target.value),
        }),
        e('input', {
          type: 'text',
          className: 'dsh-sam-select',
          placeholder: valuePlaceholder,
          value: entry.value,
          onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
            handleValueChange(idx, evt.target.value),
        }),
        e(
          'button',
          {
            type: 'button',
            className: 'dsh-mcp-kv-del-btn',
            onClick: () => handleDelete(idx),
            title: 'Delete',
          },
          e(IconCloseOutline16),
        ),
      ),
    ),
    e(
      'button',
      {
        type: 'button',
        className: 'dsh-mcp-add-btn',
        onClick: handleAdd,
      },
      `+ ${addLabel}`,
    ),
  )
}
