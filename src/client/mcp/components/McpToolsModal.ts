import * as React from 'react'
import {
  IconRefreshOutlineMedium,
  IconLoadingOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
  McpServerInfo,
} from '../../types/index.ts'
import {
  ModalDialog,
  SchemaViewer,
  ServerIcon,
  SearchToolbar,
} from '../../components/index.ts'
import { formatProtocolTitle } from '../../utils/string.ts'
import { McpPrimitivesTabs, type McpPrimitiveTab } from './McpPrimitivesTabs.ts'

const e = React.createElement

export interface McpToolsModalProps {
  open: boolean
  server: Partial<GlobalMcpServerConfig> | null
  loading: boolean
  error?: string
  toolsList: McpDiscoveredTool[]
  disabledToolsSet: Set<string>
  serverInfo?: McpServerInfo | null
  detectedTransport?: string | null
  saving: boolean
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
  onSave: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function McpToolsModal({
  open,
  server,
  loading,
  error,
  toolsList,
  disabledToolsSet,
  serverInfo,
  detectedTransport,
  saving,
  activeTab,
  onTabChange,
  tabCounts,
  resourcePanel,
  promptPanel,
  onToggleTool,
  onToggleAllTools,
  onRefresh,
  onClose,
  onSave,
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

  const effectiveInfo = serverInfo || server.serverInfo
  const headerMeta = e(
    'div',
    { className: 'dsh-mcp-tools-header-meta' },
    e(ServerIcon, {
      server,
      serverInfo: effectiveInfo,
      transport: server.transport,
      size: 16,
    }),
    e('span', { className: 'dsh-mcp-card-name' }, server.name || server.id),
    server.id && server.id !== server.name
      ? e('span', { className: 'dsh-mcp-card-id' }, server.id)
      : null,
    e(
      'span',
      {
        className: `dsh-mcp-proto-badge ${server.transport === 'stdio' ? 'stdio' : (detectedTransport ?? server.transport ?? 'streamable-http')}`,
      },
      server.transport === 'stdio'
        ? 'STDIO'
        : detectedTransport === 'sse'
          ? 'SSE'
          : detectedTransport === 'streamable-http'
            ? 'Streamable HTTP'
            : 'HTTP / SSE',
    ),
    effectiveInfo?.websiteUrl
      ? e(
          'a',
          {
            key: 'website',
            href: effectiveInfo.websiteUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'dsh-mcp-proto-badge website',
            title: effectiveInfo.websiteUrl,
          },
          '🔗 ' + t('mcpServers.table.website'),
        )
      : null,
    effectiveInfo?.version
      ? e(
          'span',
          {
            className: 'dsh-mcp-proto-badge server-version',
            title: formatProtocolTitle(effectiveInfo, t),
          },
          effectiveInfo.name &&
            effectiveInfo.name !== server.id &&
            effectiveInfo.name !== server.name
            ? `${effectiveInfo.name} ${effectiveInfo.version}`
            : effectiveInfo.version,
        )
      : effectiveInfo?.protocolVersion
        ? e(
            'span',
            {
              className: 'dsh-mcp-proto-badge server-version',
              title: formatProtocolTitle(effectiveInfo, t),
            },
            `MCP ${effectiveInfo.protocolVersion}`,
          )
        : null,
  )

  return e(
    ModalDialog,
    {
      open: Boolean(server),
      onClose,
      // The title states what the panel is showing, so it tracks the active
      // tab instead of always naming the tools list.
      title: t(
        activeTab === 'tools'
          ? 'mcpServers.toolsModal.title'
          : activeTab === 'resources'
            ? 'mcpServers.primitives.titleResources'
            : 'mcpServers.primitives.titlePrompts',
      ),
      headerExtra: headerMeta,
      panelClassName: 'dsh-mcp-tools-modal',
      footer: [
        e(
          'div',
          { key: 'left', className: 'dsh-mcp-modal-footer-left' },
          // Only the tools tab has a counter worth showing; the read-only tabs
          // deliberately contribute nothing here.
          activeTab === 'tools'
            ? e(
                'span',
                {
                  style: {
                    fontSize: 12,
                    color: 'var(--dsw-alias-label-secondary)',
                  },
                },
                t('sessionSettings.mcp.toolsEnabledCount', {
                  enabled: toolsList.length - disabledToolsSet.size,
                  total: toolsList.length,
                }),
              )
            : null,
        ),
        e(
          'div',
          { key: 'right', className: 'dsh-mcp-modal-footer-right' },
          activeTab === 'tools'
            ? e(
                React.Fragment,
                null,
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
                    disabled: saving,
                    onClick: onSave,
                  },
                  saving
                    ? t('mcpServers.toolsModal.saving')
                    : t('mcpServers.toolsModal.save'),
                ),
              )
            : e(
                'button',
                {
                  type: 'button',
                  className: 'dsh-sam-btn primary',
                  onClick: onClose,
                },
                t('mcpServers.primitives.close'),
              ),
        ),
      ],
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
          // Toolbar
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
                  disabled: loading || toolsList.length === 0,
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
                  disabled: loading || toolsList.length === 0,
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
                  disabled: loading,
                  onClick: onRefresh,
                  // One shared label for all three tabs: the probe refreshes
                  // every primitive at once, so no tab should name only its own.
                  title: t('mcpServers.actions.refresh'),
                },
                loading
                  ? e(IconLoadingOutlineMedium, {
                      size: 14,
                      className: 'dsh-spin',
                    })
                  : e(IconRefreshOutlineMedium, { size: 14 }),
                loading
                  ? t('mcpServers.actions.toolsFetching')
                  : t('mcpServers.actions.refresh'),
              ),
            ],
          }),
          // Tools list / States
          loading
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
