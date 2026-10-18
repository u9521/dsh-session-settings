import * as React from 'react'
import {
  IconRefreshOutlineMedium,
  IconLoadingOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
} from '../../types/index.ts'
import {
  ModalDialog,
  SchemaViewer,
  SearchToolbar,
} from '../../components/index.ts'
import { McpPrimitivesTabs, type McpPrimitiveTab } from './McpPrimitivesTabs.ts'

const e = React.createElement

export interface McpToolsModalProps {
  open: boolean
  server: Partial<GlobalMcpServerConfig> | null
  /** True while the probe or save is in flight. */
  busy?: boolean
  error?: string
  toolsList: McpDiscoveredTool[]
  disabledToolsSet: Set<string>
  /**
   * Which of the three primitive tabs is showing. The modal owns the strip while
   * the resource and prompt bodies are injected, so this component stays free of
   * their fetch and read state.
   */
  activeTab: McpPrimitiveTab
  onTabChange: (tab: McpPrimitiveTab) => void
  tabCounts: { tools: number; resources: number; prompts: number }
  /** Prebuilt bodies for the non-tools tabs. */
  resourcePanel?: React.ReactNode
  promptPanel?: React.ReactNode
  onToggleTool: (toolName: string) => void
  onToggleAllTools: (enableAll: boolean) => void
  onRefresh: () => void
  onClose: () => void
  /**
   * Dialog title. The session page prefixes the server name; the global page
   * names only the active tab.
   */
  title: string
  /** Extra header content beside the title (icon, badges, protocol pill). */
  headerExtra?: React.ReactNode
  /**
   * Content above the toolbar on the tools tab.
   *
   * The session page puts its global/custom switch here; the global page has no
   * equivalent, so it omits the share.
   */
  toolsHeader?: React.ReactNode
  /**
   * The action row.
   *
   * Injected rather than owned: the global page ends with Save/Cancel while the
   * session page ends with a mode selector plus Apply, and neither difference
   * belongs in the shared body. Everything above the footer — search, schema
   * expansion, tool cards, the tab strip — is one implementation.
   */
  footer: React.ReactNode
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function McpToolsModal({
  open,
  server,
  busy = false,
  error,
  toolsList,
  disabledToolsSet,
  activeTab,
  onTabChange,
  tabCounts,
  resourcePanel,
  promptPanel,
  onToggleTool,
  onToggleAllTools,
  onRefresh,
  onClose,
  title,
  headerExtra,
  toolsHeader,
  footer,
  t,
}: McpToolsModalProps) {
  const [search, setSearch] = React.useState<string>('')
  const [expandedSchemas, setExpandedSchemas] = React.useState<Set<string>>(
    new Set(),
  )
  const [schemaModes, setSchemaModes] = React.useState<
    Record<string, 'list' | 'raw'>
  >({})

  if (!open || !server) return null

  const handleToggleSchema = (toolName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev)
      if (next.has(toolName)) next.delete(toolName)
      else next.add(toolName)
      return next
    })
  }

  const filteredTools = toolsList.filter((tool) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      tool.name.toLowerCase().includes(q) ||
      (tool.description && tool.description.toLowerCase().includes(q))
    )
  })

  const headerMeta = headerExtra ?? null

  return e(
    ModalDialog,
    {
      open: Boolean(server),
      onClose,
      title,
      headerExtra: headerMeta,
      panelClassName: 'dsh-mcp-tools-modal',
      footer,
    },
    e(McpPrimitivesTabs, {
      active: activeTab,
      onChange: onTabChange,
      items: [
        {
          key: 'tools',
          label: t('mcpServers.primitives.tabTools'),
          count: tabCounts.tools,
        },
        {
          key: 'resources',
          label: t('mcpServers.primitives.tabResources'),
          count: tabCounts.resources,
        },
        {
          key: 'prompts',
          label: t('mcpServers.primitives.tabPrompts'),
          count: tabCounts.prompts,
        },
      ],
    }),
    activeTab === 'tools'
      ? e(
          React.Fragment,
          null,
          toolsHeader ?? null,
          e(SearchToolbar, {
            value: search,
            onChange: setSearch,
            placeholder: t('mcpServers.toolsModal.searchPlaceholder'),
            actions: [
              e(
                'button',
                {
                  key: 'enableAll',
                  type: 'button',
                  className: 'dsh-sam-btn secondary',
                  disabled: busy || toolsList.length === 0,
                  onClick: () => onToggleAllTools(true),
                },
                t('mcpServers.toolsModal.enableAll'),
              ),
              e(
                'button',
                {
                  key: 'disableAll',
                  type: 'button',
                  className: 'dsh-sam-btn secondary',
                  disabled: busy || toolsList.length === 0,
                  onClick: () => onToggleAllTools(false),
                },
                t('mcpServers.toolsModal.disableAll'),
              ),
              e(
                'button',
                {
                  key: 'retry',
                  type: 'button',
                  className: 'dsh-sam-btn secondary',
                  disabled: busy,
                  onClick: onRefresh,
                  // One shared label for all three tabs: the probe refreshes
                  // every primitive at once, so no tab should name only its own.
                  title: t('mcpServers.actions.refresh'),
                },
                busy
                  ? e(IconLoadingOutlineMedium, {
                      size: 14,
                      className: 'dsh-spin',
                    })
                  : e(IconRefreshOutlineMedium, { size: 14 }),
                busy
                  ? t('mcpServers.actions.toolsFetching')
                  : t('mcpServers.actions.refresh'),
              ),
            ],
          }),
          // Tools list / States
          busy
            ? e(
                'div',
                {
                  className: 'dsh-sam-desc',
                  style: { padding: '32px 0', textAlign: 'center' },
                },
                t('mcpServers.actions.toolsFetching'),
              )
            : error
              ? e(
                  'div',
                  {
                    className: 'dsh-sam-notice error',
                    style: { margin: '14px 0' },
                  },
                  t('mcpServers.toolsModal.fetchFailed') + error,
                )
              : toolsList.length === 0
                ? e(
                    'div',
                    {
                      className: 'dsh-sam-desc',
                      style: { padding: '32px 0', textAlign: 'center' },
                    },
                    t('mcpServers.toolsModal.serverNoTools'),
                  )
                : filteredTools.length === 0
                  ? e(
                      'div',
                      {
                        className: 'dsh-sam-desc',
                        style: { padding: '32px 0', textAlign: 'center' },
                      },
                      t('mcpServers.toolsModal.empty'),
                    )
                  : e(
                      'div',
                      { className: 'dsh-mcp-tools-list' },
                      filteredTools.map((tool) => {
                        const isDisabled = disabledToolsSet.has(tool.name)
                        const isSchemaExpanded = expandedSchemas.has(tool.name)
                        const hasSchema =
                          tool.inputSchema &&
                          Object.keys(tool.inputSchema).length > 0

                        return e(
                          'div',
                          {
                            key: tool.name,
                            className: `dsh-mcp-tool-card ${isDisabled ? 'disabled' : ''}`,
                          },
                          e(
                            'div',
                            { className: 'dsh-mcp-tool-card-main' },
                            e(
                              'div',
                              { className: 'dsh-mcp-tool-card-left' },
                              e(
                                'div',
                                {
                                  className: `dsh-mcp-switch-btn ${!isDisabled ? 'active' : ''}`,
                                  role: 'button',
                                  tabIndex: 0,
                                  style: { marginTop: 2, cursor: 'pointer' },
                                  onClick: () => onToggleTool(tool.name),
                                  onKeyDown: (evt: React.KeyboardEvent) => {
                                    if (
                                      evt.key === 'Enter' ||
                                      evt.key === ' '
                                    ) {
                                      evt.preventDefault()
                                      onToggleTool(tool.name)
                                    }
                                  },
                                  title: !isDisabled
                                    ? t('mcpServers.toolsModal.statusEnabled')
                                    : t('mcpServers.toolsModal.statusDisabled'),
                                },
                                e('span', {
                                  className: 'dsh-mcp-switch-thumb',
                                }),
                              ),
                              e(
                                'div',
                                { className: 'dsh-mcp-tool-info' },
                                e(
                                  'div',
                                  { className: 'dsh-mcp-tool-title-row' },
                                  e(
                                    'span',
                                    { className: 'dsh-mcp-tool-name' },
                                    tool.name,
                                  ),
                                  e(
                                    'span',
                                    {
                                      className: `dsh-mcp-tool-status-pill ${!isDisabled ? 'active' : 'disabled'}`,
                                    },
                                    !isDisabled
                                      ? t('mcpServers.toolsModal.statusEnabled')
                                      : t(
                                          'mcpServers.toolsModal.statusDisabled',
                                        ),
                                  ),
                                ),
                                tool.description
                                  ? e(
                                      'div',
                                      { className: 'dsh-mcp-tool-desc' },
                                      tool.description,
                                    )
                                  : null,
                              ),
                            ),
                            hasSchema
                              ? e(
                                  'button',
                                  {
                                    type: 'button',
                                    className: `dsh-mcp-tool-schema-btn ${isSchemaExpanded ? 'active' : ''}`,
                                    onClick: () =>
                                      handleToggleSchema(tool.name),
                                  },
                                  isSchemaExpanded
                                    ? t('mcpServers.toolsModal.hideParameters')
                                    : t('mcpServers.toolsModal.parameters'),
                                )
                              : null,
                          ),
                          isSchemaExpanded && hasSchema
                            ? e(SchemaViewer, {
                                schema: tool.inputSchema,
                                mode: schemaModes[tool.name] || 'list',
                                onModeChange: (m) =>
                                  setSchemaModes((prev) => ({
                                    ...prev,
                                    [tool.name]: m,
                                  })),
                                t,
                              })
                            : null,
                        )
                      }),
                    ),
        )
      : activeTab === 'resources'
        ? resourcePanel
        : promptPanel,
  )
}
