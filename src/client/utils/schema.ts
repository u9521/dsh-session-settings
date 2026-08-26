import type { ToolParamItem } from '../types/index.ts'

export function parseToolParameters(
  schema?: Record<string, any>,
): ToolParamItem[] {
  if (!schema || typeof schema !== 'object') return []
  const properties = schema.properties
  if (!properties || typeof properties !== 'object') return []

  const requiredSet = new Set(
    Array.isArray(schema.required) ? schema.required : [],
  )

  const items: ToolParamItem[] = []

  for (const [name, rawProp] of Object.entries(properties)) {
    if (!rawProp || typeof rawProp !== 'object') {
      items.push({
        name,
        type: 'any',
        required: requiredSet.has(name),
      })
      continue
    }
    const prop = rawProp as Record<string, any>
    const typeStr =
      prop.type ||
      (prop.enum ? 'enum' : prop.oneOf || prop.anyOf ? 'union' : 'any')
    items.push({
      name,
      type: String(typeStr),
      required: requiredSet.has(name),
      description: prop.description,
      default: prop.default,
      enum: Array.isArray(prop.enum) ? prop.enum : undefined,
    })
  }

  return items
}
