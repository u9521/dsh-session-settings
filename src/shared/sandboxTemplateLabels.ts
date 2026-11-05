/**
 * The built-in preset labels, in both languages.
 *
 * The client bundle owns the presets themselves (paths and descriptions live in
 * `client/session/sandboxTemplates.ts`), but the server has to know what the
 * buttons are called: a user preset may not take a built-in label, because the
 * label is the only thing distinguishing two buttons on the same row.
 *
 * Kept as a plain table with no host imports so it can be read from either
 * half without dragging a runtime dependency across the boundary.
 */
export const BUILTIN_TEMPLATE_LABELS = {
  zh: [
    'Android',
    'Rust',
    'Python',
    'Node / 前端',
    'Go',
    'Java / Kotlin',
    '通用缓存',
  ],
  en: [
    'Android',
    'Rust',
    'Python',
    'Node / frontend',
    'Go',
    'Java / Kotlin',
    'Shared caches',
  ],
} as const

/** Every built-in label in every language, so a rename cannot open a gap. */
export function builtinTemplateNames(): string[] {
  return [...BUILTIN_TEMPLATE_LABELS.zh, ...BUILTIN_TEMPLATE_LABELS.en]
}
