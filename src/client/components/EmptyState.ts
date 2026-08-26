import * as React from 'react'

const e = React.createElement

export interface EmptyStateProps {
  message: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function EmptyState({
  message,
  icon,
  action,
  className = 'dsh-mcp-empty-card',
  style,
}: EmptyStateProps) {
  return e(
    'div',
    { className, style },
    icon ? e('div', { className: 'dsh-mcp-empty-icon' }, icon) : null,
    typeof message === 'string'
      ? e('p', { className: 'dsh-mcp-empty-text' }, message)
      : message,
    action,
  )
}
