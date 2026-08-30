import type { ToolParamItem } from '../types/index.ts'

export function parseToolParameters(
  schema?: Record<string, unknown>,
): ToolParamItem[] {
  if (!schema || typeof schema !== 'object') return []
  const properties = schema.properties
  if (!properties || typeof properties !== 'object') return []

  const requiredList = Array.isArray(schema.required)
    ? (schema.required as unknown[])
    : []
  const requiredSet = new Set(
    requiredList.filter((k): k is string => typeof k === 'string'),
  )

  const items: ToolParamItem[] = []

  for (const [name, rawProp] of Object.entries(
    properties as Record<string, unknown>,
  )) {
    if (!rawProp || typeof rawProp !== 'object') {
      items.push({
        name,
        type: 'any',
        required: requiredSet.has(name),
      })
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
            (e): e is string => typeof e === 'string',
          )
        : undefined,
    })
  }

  return items
}
