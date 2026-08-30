import * as React from 'react'
import { parseToolParameters } from '../utils/index.ts'

const e = React.createElement

export interface SchemaViewerProps {
  schema?: Record<string, unknown>
  mode?: 'list' | 'raw'
  onModeChange?: (mode: 'list' | 'raw') => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function SchemaViewer({
  schema,
  mode = 'list',
  onModeChange,
  t,
}: SchemaViewerProps) {
  const [internalMode, setInternalMode] = React.useState<'list' | 'raw'>(mode)
  const currentMode = onModeChange ? mode : internalMode
  const setMode = onModeChange || setInternalMode

  if (!schema || Object.keys(schema).length === 0) {
    return e(
      'div',
      { className: 'dsh-mcp-tool-expanded-box' },
      e(
        'div',
        { className: 'dsh-mcp-param-desc' },
        t('mcpServers.toolsModal.noParams'),
      ),
    )
  }

  const params = parseToolParameters(schema)
  const requiredCount = params.filter((p) => p.required).length

  return e(
    'div',
    { className: 'dsh-mcp-tool-expanded-box' },
    // Header with stats & mode switcher
    e(
      'div',
      { className: 'dsh-mcp-tool-expanded-header' },
      e(
        'span',
        { className: 'dsh-mcp-tool-param-stats' },
        t('mcpServers.toolsModal.paramsCount', {
          total: params.length,
          required: requiredCount,
        }),
      ),
      e(
        'div',
        { className: 'dsh-mcp-tool-view-switch' },
        e(
          'button',
          {
            type: 'button',
            className: `dsh-mcp-seg-btn ${currentMode === 'list' ? 'active' : ''}`,
            onClick: (evt: React.MouseEvent) => {
              evt.stopPropagation()
              setMode('list')
            },
          },
          t('mcpServers.toolsModal.viewList'),
        ),
        e(
          'button',
          {
            type: 'button',
            className: `dsh-mcp-seg-btn ${currentMode === 'raw' ? 'active' : ''}`,
            onClick: (evt: React.MouseEvent) => {
              evt.stopPropagation()
              setMode('raw')
            },
          },
          t('mcpServers.toolsModal.viewRaw'),
        ),
      ),
    ),
    // Content body
    currentMode === 'raw'
      ? e(
          'pre',
          { className: 'dsh-mcp-tool-schema-preview' },
          JSON.stringify(schema, null, 2),
        )
      : e(
          'div',
          { className: 'dsh-mcp-tool-params-list' },
          params.length === 0
            ? e(
                'div',
                { className: 'dsh-mcp-param-desc' },
                t('mcpServers.toolsModal.noParameters'),
              )
            : params.map((param) =>
                e(
                  'div',
                  { key: param.name, className: 'dsh-mcp-param-row' },
                  e(
                    'div',
                    { className: 'dsh-mcp-param-top' },
                    e('span', { className: 'dsh-mcp-param-name' }, param.name),
                    e('span', { className: 'dsh-mcp-param-type' }, param.type),
                    param.required
                      ? e(
                          'span',
                          { className: 'dsh-mcp-param-badge required' },
                          t('mcpServers.toolsModal.required'),
                        )
                      : e(
                          'span',
                          { className: 'dsh-mcp-param-badge optional' },
                          t('mcpServers.toolsModal.optional'),
                        ),
                    param.default !== undefined &&
                      e(
                        'span',
                        { className: 'dsh-mcp-param-default' },
                        `${t('mcpServers.toolsModal.defaultVal')}${JSON.stringify(param.default)}`,
                      ),
                  ),
                  param.description &&
                    e(
                      'div',
                      { className: 'dsh-mcp-param-desc' },
                      param.description,
                    ),
                  Array.isArray(param.enum) &&
                    param.enum.length > 0 &&
                    e(
                      'div',
                      { className: 'dsh-mcp-param-enum' },
                      `${t('mcpServers.toolsModal.enumVal')}${param.enum.join(' | ')}`,
                    ),
                ),
              ),
        ),
  )
}
