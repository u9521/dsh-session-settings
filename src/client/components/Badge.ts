import * as React from 'react'

const e = React.createElement

export type BadgeVariant =
  | 'inherit'
  | 'custom'
  | 'default'
  | 'workspace'
  | 'source-project'
  | 'source-user'
  | 'source-bundled'
  | 'source-runtime'
  | 'status-enabled'
  | 'status-disabled'
  | 'stdio'
  | 'sse'
  | 'streamable-http'
  | 'streamable-http-or-sse'
  | 'http'
  | 'timeout'
  | 'disabled-tools'
  | 'server-version'
  | 'count'
  | 'tool-active'
  | 'tool-disabled'
  | string

export interface BadgeProps {
  label: React.ReactNode
  variant?: BadgeVariant
  title?: string
  className?: string
  style?: React.CSSProperties
  icon?: React.ReactNode
}

export function Badge({
  label,
  variant = 'default',
  title,
  className = '',
  style,
  icon,
}: BadgeProps): React.ReactElement {
  let baseClass = 'dsh-sam-title-badge'

  if (variant.startsWith('source-') || variant.startsWith('status-')) {
    baseClass = 'dsh-skill-badge'
  } else if (
    variant === 'stdio' ||
    variant === 'sse' ||
    variant === 'streamable-http' ||
    variant === 'streamable-http-or-sse' ||
    variant === 'http' ||
    variant === 'timeout' ||
    variant === 'disabled-tools' ||
    variant === 'server-version' ||
    variant === 'count'
  ) {
    baseClass = 'dsh-mcp-proto-badge'
  } else if (variant === 'tool-active') {
    baseClass = 'dsh-mcp-tool-status-pill active'
    variant = ''
  } else if (variant === 'tool-disabled') {
    baseClass = 'dsh-mcp-tool-status-pill disabled'
    variant = ''
  }

  const fullClassName = [baseClass, variant, className]
    .filter(Boolean)
    .join(' ')

  return e(
    'span',
    {
      className: fullClassName,
      title,
      style,
    },
    icon
      ? e(
          'span',
          {
            style: {
              marginRight: 4,
              display: 'inline-flex',
              alignItems: 'center',
            },
          },
          icon,
        )
      : null,
    label,
  )
}
