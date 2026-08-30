import * as React from 'react'
import { Badge, type BadgeProps } from './Badge.ts'

const e = React.createElement

export interface ModeOption<T extends string = string> {
  value: T
  title: React.ReactNode
  desc?: React.ReactNode
  badges?: BadgeProps[]
  disabled?: boolean
  visible?: boolean
}

export interface ModeSelectorProps<T extends string = string> {
  name: string
  value: T
  onChange: (value: T) => void
  options: ModeOption<T>[]
  className?: string
}

export function ModeSelector<T extends string = string>({
  name,
  value,
  onChange,
  options,
  className = 'dsh-sam-mode-list',
}: ModeSelectorProps<T>) {
  const visibleOptions = options.filter((opt) => opt.visible !== false)

  return e(
    'div',
    { className },
    visibleOptions.map((opt) => {
      const isSelected = opt.value === value
      return e(
        'label',
        {
          key: opt.value,
          className: `dsh-sam-mode-item ${isSelected ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''}`,
          style: opt.disabled
            ? { opacity: 0.6, cursor: 'not-allowed' }
            : undefined,
        },
        e('input', {
          type: 'radio',
          name,
          value: opt.value,
          checked: isSelected,
          disabled: opt.disabled,
          onChange: () => {
            if (!opt.disabled) {
              onChange(opt.value)
            }
          },
        }),
        e(
          'div',
          { className: 'dsh-sam-mode-text' },
          e(
            'div',
            { className: 'dsh-sam-mode-title-row' },
            typeof opt.title === 'string'
              ? e('span', { className: 'dsh-sam-mode-title' }, opt.title)
              : opt.title,
            (opt.badges || []).map((b, idx) =>
              e(Badge, {
                key: idx,
                label: b.label,
                variant: b.variant,
                className: b.className,
              }),
            ),
          ),
          opt.desc
            ? typeof opt.desc === 'string'
              ? e('div', { className: 'dsh-sam-mode-desc' }, opt.desc)
              : opt.desc
            : null,
        ),
      )
    }),
  )
}
