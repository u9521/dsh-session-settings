import * as React from 'react'

const e = React.createElement

export type McpPrimitiveTab = 'tools' | 'resources' | 'prompts'

export interface McpPrimitivesTabItem {
  key: McpPrimitiveTab
  label: string
  /** Rendered after the label; omitted when there is nothing to count. */
  count?: number
}

export interface McpPrimitivesTabsProps {
  active: McpPrimitiveTab
  onChange: (tab: McpPrimitiveTab) => void
  items: McpPrimitivesTabItem[]
}

/**
 * The 工具 / 资源 / 提示词 tab strip shared by both management modals.
 *
 * Reuses the existing `.dsh-session-tools-mode-tab` visuals so the new tabs read
 * as the same control the tools modal already ships, and declares the ARIA tab
 * roles the strip previously lacked.
 */
export function McpPrimitivesTabs({
  active,
  onChange,
  items,
}: McpPrimitivesTabsProps) {
  return e(
    'div',
    {
      className: 'dsh-session-tools-mode-tabs dsh-mcp-primitive-tabs',
      role: 'tablist',
    },
    items.map((item) =>
      e(
        'button',
        {
          key: item.key,
          type: 'button',
          role: 'tab',
          'aria-selected': active === item.key,
          className: `dsh-session-tools-mode-tab ${active === item.key ? 'active' : ''}`,
          onClick: () => onChange(item.key),
        },
        item.label,
        typeof item.count === 'number' && item.count > 0
          ? e(
              'span',
              { className: 'dsh-mcp-primitive-tab-count' },
              String(item.count),
            )
          : null,
      ),
    ),
  )
}
