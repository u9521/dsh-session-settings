export function capitalize(s: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function effortLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  effortId: string,
): string {
  const key = `sessionSettings.field.reasoning${capitalize(effortId)}`
  const translated = t(key)
  return translated && !translated.startsWith('sessionSettings.field.')
    ? translated
    : effortId
}
