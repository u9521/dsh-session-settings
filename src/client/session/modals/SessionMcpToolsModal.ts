import * as React from 'react'
import type {
  GlobalMcpServerConfig,
  McpDiscoveredTool,
} from '../../types/index.ts'
import type { McpPrimitiveTab } from '../../mcp/components/McpPrimitivesTabs.ts'
import { McpToolsModal } from '../../mcp/components/McpToolsModal.ts'
import { Badge, ServerIcon } from '../../components/index.ts'

const e = React.createElement

/**
 * The session-scope tools modal.
 *
 * The body — tab strip, search, bulk actions, tool cards, schema expansion — is
 * the shared `McpToolsModal`; this wrapper only supplies what is genuinely
 * session-specific: the title prefix, the header badges, and the footer that
 * carries the global/custom switch, the reset action, and Apply.
 */
export interface SessionMcpToolsModalProps {
  server: GlobalMcpServerConfig | null
  toolsMode: 'global' | 'custom'
  disabledToolsSet: Set<string>
  fetching: boolean
  error?: string
  toolsList: McpDiscoveredTool[]
  isReadonly?: boolean
  /** Which primitive tab is showing; the modal owns the strip, not the states. */
  activeTab: McpPrimitiveTab
  onTabChange: (tab: McpPrimitiveTab) => void
  tabCounts: { tools: number; resources: number; prompts: number }
  /** Prebuilt bodies for the read-only tabs. */
  resourcePanel?: React.ReactNode
  promptPanel?: React.ReactNode
  onToolsModeChange: (mode: 'global' | 'custom') => void
  onToggleTool: (toolName: string) => void
  onToggleAllTools: (enableAll: boolean) => void
  onResetToDefault: () => void
  onFetchTools: () => void
  onClose: () => void
  onApply: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SessionMcpToolsModal({
  server,
  toolsMode,
  disabledToolsSet,
  fetching,
  error,
  toolsList,
  isReadonly = false,
  activeTab,
  onTabChange,
  tabCounts,
  resourcePanel,
  promptPanel,
  onToolsModeChange,
  onToggleTool,
  onToggleAllTools,
  onResetToDefault,
  onFetchTools,
  onClose,
  onApply,
  t,
}: SessionMcpToolsModalProps) {
  if (!server) return null

  const protoLabel =
    server.transport === 'stdio'
      ? 'STDIO'
      : server.detectedTransport === 'sse'
        ? 'SSE'
        : server.detectedTransport === 'streamable-http'
          ? 'Streamable HTTP'
          : 'HTTP / SSE'

  const protoVariant =
    server.transport === 'stdio'
      ? 'stdio'
      : server.detectedTransport === 'sse'
        ? 'sse'
        : 'streamable-http'

  const title = `${server.name} - ${
    activeTab === 'tools'
      ? t('sessionSettings.toolsModal.title')
      : activeTab === 'resources'
        ? t('mcpServers.primitives.titleResources')
        : t('mcpServers.primitives.titlePrompts')
  }`

  const headerExtra = [
    e(ServerIcon, {
      key: 'icon',
      server,
      transport: server.transport,
      size: 16,
    }),
    server.id && server.id !== server.name
      ? e('span', { key: 'id', className: 'dsh-mcp-card-id' }, server.id)
      : null,
    e(Badge, { key: 'proto', label: protoLabel, variant: protoVariant }),
    toolsList.length > 0
      ? e(Badge, {
          key: 'count',
          label: t('sessionSettings.mcp.toolsCount', {
            count: toolsList.length,
          }),
          variant: 'count',
        })
      : null,
  ].filter(Boolean)

  const footer = [
    e(
      'div',
      { key: 'left', className: 'dsh-mcp-modal-footer-left' },
      // The read-only tabs have no session-scoped state to summarise, so they
      // leave this slot empty rather than restating that they are read-only.
      activeTab !== 'tools'
        ? null
        : toolsMode === 'custom'
          ? disabledToolsSet.size > 0
            ? e(Badge, {
                label: t('sessionSettings.toolsModal.disabledCount', {
                  count: disabledToolsSet.size,
                }),
                variant: 'disabled-tools',
              })
            : e(Badge, {
                label: t('sessionSettings.toolsModal.allEnabledCount', {
                  total: toolsList.length,
                }),
                variant: 'stdio',
              })
          : e(Badge, {
              label: t('sessionSettings.toolsModal.modeDefaultTitle'),
              variant: 'stdio',
            }),
    ),
    e(
      'div',
      { key: 'right', className: 'dsh-mcp-modal-footer-right' },
      isReadonly || activeTab !== 'tools'
        ? e(
            'button',
            {
              type: 'button',
              className: 'dsh-sam-btn primary',
              onClick: onClose,
            },
            t('sessionSettings.skills.modalDoneBtn'),
          )
        : [
            e(
              'button',
              {
                key: 'cancel',
                type: 'button',
                className: 'dsh-sam-btn secondary',
                onClick: onClose,
              },
              t('sessionSettings.toolsModal.cancel'),
            ),
            e(
              'button',
              {
                key: 'apply',
                type: 'button',
                className: 'dsh-sam-btn primary',
                onClick: onApply,
              },
              t('sessionSettings.toolsModal.save'),
            ),
          ],
    ),
  ]

  // The mode switch stays where it was: above the toolbar, on the tools tab
  // only, hidden in read-only mode.
  const toolsHeader =
    isReadonly || activeTab !== 'tools'
      ? null
      : e(
          'div',
          { className: 'dsh-session-tools-mode-tabs' },
          e(
            'button',
            {
              type: 'button',
              className: `dsh-session-tools-mode-tab ${toolsMode === 'global' ? 'active' : ''}`,
              onClick: () => onToolsModeChange('global'),
            },
            t('sessionSettings.toolsModal.modeDefaultTitle'),
          ),
          e(
            'button',
            {
              type: 'button',
              className: `dsh-session-tools-mode-tab ${toolsMode === 'custom' ? 'active' : ''}`,
              onClick: () => onToolsModeChange('custom'),
            },
            t('sessionSettings.toolsModal.modeCustomTitle'),
          ),
          // Resetting only means something once this session owns a list, so the
          // action rides beside the switch instead of the toolbar.
          toolsMode === 'custom'
            ? e(
                'button',
                {
                  key: 'reset',
                  type: 'button',
                  className:
                    'dsh-sam-btn secondary dsh-session-tools-mode-reset',
                  disabled: fetching,
                  onClick: onResetToDefault,
                },
                t('sessionSettings.toolsModal.resetToDefault'),
              )
            : null,
        )

  return e(McpToolsModal, {
    open: true,
    server,
    busy: fetching,
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
    onRefresh: onFetchTools,
    onClose,
    title,
    headerExtra,
    toolsHeader,
    footer,
    t,
  })
}
