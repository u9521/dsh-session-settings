import * as React from 'react'
import { IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'

const e = React.createElement

export interface SearchToolbarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  statsText?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  inputClassName?: string
}

export function SearchToolbar({
  value,
  onChange,
  placeholder = '搜索...',
  statsText,
  actions,
  className = 'dsh-mcp-tools-toolbar',
  inputClassName = 'dsh-sam-input dsh-mcp-search-input',
}: SearchToolbarProps) {
  return e(
    'div',
    { className },
    e(
      'div',
      { className: 'dsh-mcp-search-wrap dsh-mcp-tools-search-box' },
      e(IconSearchOutline16, {
        size: 14,
        className: 'dsh-mcp-search-icon',
      }),
      e('input', {
        type: 'text',
        className: inputClassName,
        placeholder,
        value,
        onChange: (evt: React.ChangeEvent<HTMLInputElement>) =>
          onChange(evt.target.value),
      }),
    ),
    statsText
      ? e('div', { className: 'dsh-mcp-tools-stats-bar' }, statsText)
      : null,
    actions
      ? e('div', { className: 'dsh-mcp-tools-toolbar-actions' }, actions)
      : null,
  )
}
