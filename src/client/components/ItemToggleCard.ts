import * as React from 'react'
import { Badge, type BadgeProps } from './Badge.ts'

const e = React.createElement

export interface ItemToggleCardProps {
  id: string
  checked?: boolean
  readonly?: boolean
  disabled?: boolean
  onToggle?: () => void
  icon?: React.ReactNode
  title: React.ReactNode
  titleClassName?: string
  badges?: Array<
    | BadgeProps
    | { label: string; variant?: string; className?: string; title?: string }
  >
  description?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  expanded?: boolean
  expandedContent?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: (evt: React.MouseEvent) => void
}

export function ItemToggleCard({
  id: _id,
  checked,
  readonly = false,
  disabled = false,
  onToggle,
  icon,
  title,
  titleClassName = 'dsh-mcp-tool-name',
  badges = [],
  description,
  meta,
  actions,
  expanded = false,
  expandedContent,
  className = '',
  style,
  onClick,
}: ItemToggleCardProps): React.ReactElement {
  const hasSwitch =
    typeof checked === 'boolean' || typeof onToggle === 'function'
  const isCardDisabled = Boolean(disabled) || (hasSwitch && checked === false)

  const handleSwitchClick = (evt: React.MouseEvent) => {
    evt.stopPropagation()
    if (!readonly && onToggle) {
      onToggle()
    }
  }

  return e(
    'div',
    {
      className:
        `dsh-mcp-tool-card ${isCardDisabled ? 'disabled' : ''} ${className}`.trim(),
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
        hasSwitch
          ? !readonly
            ? e(
                'button',
                {
                  type: 'button',
                  role: 'switch',
                  'aria-checked': checked,
                  className: `dsh-mcp-switch-btn ${checked ? 'active' : ''}`,
                  onClick: handleSwitchClick,
                },
                e('span', { className: 'dsh-mcp-switch-thumb' }),
              )
            : e(
                'div',
                {
                  className: `dsh-mcp-switch-btn ${checked ? 'active' : ''}`,
                  style: { opacity: 0.6, cursor: 'default' },
                },
                e('span', { className: 'dsh-mcp-switch-thumb' }),
              )
          : null,
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
              ? e('span', { className: titleClassName }, title)
              : title,
            badges.map((b, idx) =>
              e(Badge, {
                key: idx,
                label: b.label,
                variant: (b as any).variant,
                className: (b as any).className,
                title: b.title,
              }),
            ),
          ),
          description
            ? typeof description === 'string'
              ? e('p', { className: 'dsh-mcp-tool-desc' }, description)
              : description
            : null,
          meta
            ? typeof meta === 'string'
              ? e('code', { className: 'dsh-session-mcp-target' }, meta)
              : meta
            : null,
        ),
      ),
      actions
        ? e('div', { className: 'dsh-mcp-tool-card-right' }, actions)
        : null,
    ),
    expanded && expandedContent ? expandedContent : null,
  )
}
