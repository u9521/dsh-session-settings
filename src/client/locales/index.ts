export * from './zh.ts'
export * from './en.ts'

export function flattenDictionary(
  record: Record<string, unknown>,
  prefix = '',
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      result[nextKey] = value
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenDictionary(value as Record<string, unknown>, nextKey),
      )
    }
  }
  return result
}
