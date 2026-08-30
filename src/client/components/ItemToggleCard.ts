import * as React from 'react'
import { Badge, type BadgeProps } from './Badge.ts'

const e = React.createElement

export interface ItemToggleCardProps {
  id?: string
  icon?: React.ReactNode
  title: React.ReactNode
  badges?: BadgeProps[]
  description?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: (evt: React.MouseEvent) => void
}

export function ItemToggleCard({
  id,
  icon,
  title,
  badges = [],
  description,
  className = '',
  style,
  onClick,
}: ItemToggleCardProps): React.ReactElement {
  return e(
    'div',
    {
      id,
      'data-id': id,
      className: `dsh-mcp-tool-card ${className}`.trim(),
      style: {
        ...(onClick ? { cursor: 'pointer' } : {}),
        ...style,
      },
      onClick,
    },
    e(
      'div',
      { className: 'dsh-mcp-tool-card-main' },
      e(
        'div',
        { className: 'dsh-mcp-tool-card-left' },
        e(
          'div',
          { className: 'dsh-mcp-tool-info' },
          e(
            'div',
            { className: 'dsh-mcp-tool-title-row' },
            icon
              ? e(
                  'span',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginRight: 2,
                    },
                  },
                  icon,
                )
              : null,
            typeof title === 'string'
              ? e('span', { className: 'dsh-mcp-tool-name' }, title)
              : title,
            badges.map((b, idx) =>
              e(Badge, {
                key: idx,
                label: b.label,
                variant: b.variant,
                className: b.className,
                title: b.title,
              }),
            ),
          ),
          description
            ? typeof description === 'string'
              ? e('p', { className: 'dsh-mcp-tool-desc' }, description)
              : description
            : null,
        ),
      ),
    ),
  )
}
