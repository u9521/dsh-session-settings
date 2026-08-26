import * as React from 'react'
import {
  IconCodeOutline16,
  IconLinkOutline16,
  IconChecklistOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionMcpConfig,
  SessionMcpMode,
  GlobalMcpServerConfig,
  SessionSettingsConfig,
} from '../../types/index.ts'
import { ModeSelector, EmptyState, Badge } from '../../components/index.ts'

const e = React.createElement

export interface SessionMcpSectionProps {
  sessionId?: string
  mcpConfig: SessionMcpConfig
  availableMcpServers: GlobalMcpServerConfig[]
  currentWorkspaceId?: string
  workspaceSettings?: SessionSettingsConfig
  defaultSettings: SessionSettingsConfig
  onMcpModeChange: (mode: SessionMcpMode) => void
  onToggleMcpServer: (serverId: string) => void
  onToggleSelectAllMcp: () => void
  onOpenSessionToolsModal: (server: GlobalMcpServerConfig) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SessionMcpSection({
  sessionId,
  mcpConfig,
  availableMcpServers,
  currentWorkspaceId,
  workspaceSettings,
  defaultSettings,
  onMcpModeChange,
  onToggleMcpServer,
  onToggleSelectAllMcp,
  onOpenSessionToolsModal,
  t,
}: SessionMcpSectionProps) {
  const isAllMcpSelected =
    availableMcpServers.length > 0 &&
    availableMcpServers.every((s) =>
      (mcpConfig.enabledServerIds || []).includes(s.id),
    )

  return e(
    'div',
    { className: 'dsh-view-content-inner' },
    // Section Header
    e(
      'div',
      { className: 'dsh-section-header' },
      e(
        'h3',
        { className: 'dsh-section-title' },
        t('sessionSettings.section.mcpTitle'),
      ),
      e(
        'p',
        { className: 'dsh-section-desc' },
        t('sessionSettings.section.mcpDesc'),
      ),
    ),

    // Mode Selector
    e(ModeSelector, {
      name: 'sessionMcpMode',
      value: mcpConfig.mode,
      onChange: onMcpModeChange,
      options: [
        {
          value: 'workspace',
          visible: Boolean(currentWorkspaceId),
          title: t('sessionSettings.mcpMode.workspace.title'),
          badges: [
            workspaceSettings?.mcp?.mode === 'custom'
              ? {
                  label: `工作区: ${(workspaceSettings?.mcp?.enabledServerIds || []).length}个启用`,
                  variant: 'custom',
                }
              : { label: '继承全局', variant: 'inherit' },
          ],
          desc: t('sessionSettings.mcpMode.workspace.desc'),
        },
        {
          value: 'default',
          title: t('sessionSettings.mcpMode.default.title'),
          badges: [
            {
              label: `${(defaultSettings?.mcp?.enabledServerIds || []).length} 个服务器`,
              variant: 'custom',
            },
          ],
          desc: t('sessionSettings.mcpMode.default.desc'),
        },
        {
          value: 'custom',
          title: t('sessionSettings.mcpMode.custom.title'),
          desc: t('sessionSettings.mcpMode.custom.desc'),
        },
      ],
    }),

    availableMcpServers.length === 0
      ? e(EmptyState, { message: t('sessionSettings.mcp.empty') })
      : e(
          'div',
          { className: 'dsh-session-mcp-box' },
          mcpConfig.mode === 'custom' || !sessionId
            ? e(
                'div',
                { className: 'dsh-mcp-quick-bar' },
                e(
                  'button',
                  {
                    type: 'button',
                    className: `dsh-mcp-select-btn ${isAllMcpSelected ? 'active' : ''}`,
                    onClick: onToggleSelectAllMcp,
                  },
                  isAllMcpSelected
                    ? t('sessionSettings.mcp.deselectAll')
                    : t('sessionSettings.mcp.selectAll'),
                ),
              )
            : null,

          e(
            'div',
            { className: 'dsh-session-mcp-list' },
            availableMcpServers.map((server) => {
              const isChecked =
                mcpConfig.mode === 'custom' || !sessionId
                  ? (mcpConfig.enabledServerIds || []).includes(server.id)
                  : mcpConfig.mode === 'workspace'
                    ? workspaceSettings?.mcp?.mode === 'custom'
                      ? (workspaceSettings.mcp.enabledServerIds || []).includes(
                          server.id,
                        )
                      : defaultSettings?.mcp?.mode === 'custom'
                        ? (defaultSettings.mcp.enabledServerIds || []).includes(
                            server.id,
                          )
                        : Boolean(server.enabledByDefault)
                    : defaultSettings?.mcp?.mode === 'custom'
                      ? (defaultSettings.mcp.enabledServerIds || []).includes(
                          server.id,
                        )
                      : Boolean(server.enabledByDefault)

              const isReadonly = Boolean(
                sessionId && mcpConfig.mode !== 'custom',
              )
              const protoLabel =
                server.transport === 'stdio'
                  ? 'STDIO'
                  : server.detectedTransport === 'sse'
                    ? 'SSE'
                    : server.detectedTransport === 'streamable-http'
                      ? 'Streamable HTTP'
                      : 'HTTP / SSE'
              const protoClass =
                server.transport === 'stdio'
                  ? 'stdio'
                  : server.detectedTransport === 'sse'
                    ? 'sse'
                    : server.detectedTransport === 'streamable-http'
                      ? 'streamable-http'
                      : 'streamable-http-or-sse'

              const isCustomTools =
                mcpConfig.toolsMode?.[server.id] === 'custom'
              const customDisabledCount = (
                mcpConfig.disabledTools?.[server.id] || []
              ).length

              const badges: React.ReactNode[] = [
                e(Badge, {
                  key: 'proto',
                  label: protoLabel,
                  variant: protoClass,
                }),
                server.serverInfo?.version
                  ? e(Badge, {
                      key: 'version',
                      label:
                        server.serverInfo.name &&
                        server.serverInfo.name !== server.id &&
                        server.serverInfo.name !== server.name
                          ? `${server.serverInfo.name} ${server.serverInfo.version}`
                          : server.serverInfo.version,
                      variant: 'server-version',
                      title: server.serverInfo.protocolVersion
                        ? `MCP Protocol: ${server.serverInfo.protocolVersion}`
                        : server.serverInfo.name || undefined,
                    })
                  : server.serverInfo?.protocolVersion
                    ? e(Badge, {
                        key: 'protocol-version',
                        label: `MCP ${server.serverInfo.protocolVersion}`,
                        variant: 'server-version',
                        title: server.serverInfo.name || undefined,
                      })
                    : null,
                isChecked
                  ? e(Badge, {
                      key: 'tools-status',
                      label: isCustomTools
                        ? customDisabledCount > 0
                          ? t('sessionSettings.mcp.toolsModeCustomBadge', {
                              count: customDisabledCount,
                            })
                          : t('sessionSettings.mcp.toolsAllActiveBadge')
                        : t('sessionSettings.mcp.toolsModeDefaultBadge'),
                      className: `dsh-session-tools-mode-badge ${
                        isCustomTools
                          ? customDisabledCount > 0
                            ? 'custom'
                            : 'all-active'
                          : 'default'
                      }`,
                    })
                  : null,
                server.toolCallTimeoutMs
                  ? e(Badge, {
                      key: 'timeout',
                      label: `${server.toolCallTimeoutMs / 1000}s 超时`,
                      variant: 'timeout',
                    })
                  : null,
                server.compatibility?.status === 'incompatible-2026-07-28' ||
                server.compatibility?.canEnable === false
                  ? e(Badge, {
                      key: 'incompatible',
                      label: t('compatibility.incompatibleBadge'),
                      variant: 'incompatible',
                      title:
                        server.compatibility.warning ||
                        t('compatibility.incompatibleDesc'),
                    })
                  : server.compatibility?.status === 'downgrade-supported'
                    ? e(Badge, {
                        key: 'downgrade',
                        label: t('compatibility.downgradedBadge', {
                          version:
                            server.compatibility.negotiatedVersion ||
                            '2025-11-25',
                        }),
                        variant: 'downgrade',
                        title:
                          server.compatibility.warning ||
                          t('compatibility.downgradedDesc'),
                      })
                    : null,
              ].filter(Boolean)

              const handleSwitchClick = (evt: React.MouseEvent) => {
                evt.stopPropagation()
                if (!isReadonly) {
                  onToggleMcpServer(server.id)
                }
              }

              return e(
                'div',
                {
                  key: server.id,
                  className: `dsh-session-mcp-card ${isChecked ? 'active' : ''} ${
                    isReadonly ? 'readonly' : ''
                  }`,
                },
                // Top Row
                e(
                  'div',
                  { className: 'dsh-session-mcp-header' },
                  e(
                    'div',
                    { className: 'dsh-session-mcp-identity' },
                    e(
                      'div',
                      { className: 'dsh-session-mcp-icon' },
                      server.transport === 'stdio'
                        ? e(IconCodeOutline16, { size: 16 })
                        : e(IconLinkOutline16, { size: 16 }),
                    ),
                    e(
                      'div',
                      { className: 'dsh-session-mcp-title-wrap' },
                      e(
                        'span',
                        { className: 'dsh-session-mcp-name' },
                        server.name,
                      ),
                      server.id && server.id !== server.name
                        ? e(
                            'span',
                            { className: 'dsh-session-mcp-id' },
                            server.id,
                          )
                        : null,
                    ),
                  ),
                  e(
                    'div',
                    { className: 'dsh-session-mcp-switch-wrap' },
                    !isReadonly
                      ? e(
                          'button',
                          {
                            type: 'button',
                            role: 'switch',
                            'aria-checked': isChecked,
                            className: `dsh-mcp-switch-btn ${
                              isChecked ? 'active' : ''
                            }`,
                            onClick: handleSwitchClick,
                          },
                          e('span', { className: 'dsh-mcp-switch-thumb' }),
                        )
                      : e(
                          'div',
                          {
                            className: `dsh-mcp-switch-btn ${
                              isChecked ? 'active' : ''
                            }`,
                            style: { opacity: 0.6, cursor: 'default' },
                          },
                          e('span', { className: 'dsh-mcp-switch-thumb' }),
                        ),
                  ),
                ),

                // Badges Row
                badges.length > 0
                  ? e(
                      'div',
                      { className: 'dsh-session-mcp-badges-row' },
                      badges,
                    )
                  : null,

                // Description
                server.description
                  ? e(
                      'p',
                      { className: 'dsh-session-mcp-desc' },
                      server.description,
                    )
                  : null,

                // Target Box
                e(
                  'div',
                  { className: 'dsh-session-mcp-target-box' },
                  e(
                    'code',
                    { className: 'dsh-session-mcp-target' },
                    server.transport === 'stdio'
                      ? `${server.command || ''} ${(server.args || []).join(' ')}`
                      : server.url || '',
                  ),
                ),

                // Footer Actions (Configure Tools)
                isChecked
                  ? e(
                      'div',
                      { className: 'dsh-session-mcp-footer' },
                      e(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-mcp-mini-btn dsh-session-tools-btn',
                          onClick: (evt: React.MouseEvent) => {
                            evt.stopPropagation()
                            onOpenSessionToolsModal(server)
                          },
                        },
                        e(IconChecklistOutline14, { size: 14 }),
                        t('sessionSettings.mcp.toolsBtn'),
                      ),
                    )
                  : null,
              )
            }),
          ),
        ),
  )
}
