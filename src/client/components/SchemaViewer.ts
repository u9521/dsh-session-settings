import * as React from 'react'
import type { ToolParamItem } from '../types/index.ts'

const e = React.createElement

/**
 * Parse a tool's JSON Schema into the parameter rows this viewer renders.
 *
 * Local to the viewer because it has no other consumer: a schema-shape helper
 * with one call site is a module boundary that only adds a hop.
 */
function parseToolParameters(
  schema?: Record<string, unknown>,
): ToolParamItem[] {
  if (!schema || typeof schema !== 'object') return []
  const properties = schema.properties
  if (!properties || typeof properties !== 'object') return []

  const requiredSet = new Set(
    (Array.isArray(schema.required) ? schema.required : []).filter(
      (key): key is string => typeof key === 'string',
    ),
  )

  const items: ToolParamItem[] = []
  for (const [name, rawProp] of Object.entries(
    properties as Record<string, unknown>,
  )) {
    if (!rawProp || typeof rawProp !== 'object') {
      items.push({ name, type: 'any', required: requiredSet.has(name) })
      continue
    }
    const prop = rawProp as {
      type?: unknown
      enum?: unknown
      oneOf?: unknown
      anyOf?: unknown
      description?: unknown
      default?: unknown
    }
    const typeStr =
      typeof prop.type === 'string'
        ? prop.type
        : prop.enum
          ? 'enum'
          : prop.oneOf || prop.anyOf
            ? 'union'
            : 'any'
    items.push({
      name,
      type: String(typeStr),
      required: requiredSet.has(name),
      description:
        typeof prop.description === 'string' ? prop.description : undefined,
      default: prop.default,
      enum: Array.isArray(prop.enum)
        ? (prop.enum as unknown[]).filter(
            (entry): entry is string => typeof entry === 'string',
          )
        : undefined,
    })
  }
  return items
}

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
