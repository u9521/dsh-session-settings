import type { SkillSourceMeta } from '../types/index.ts'

export function getSkillSourceMeta(
  skill: { source?: string; isRuntime?: boolean } | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): SkillSourceMeta {
  if (!skill) {
    return {
      sourceClass: 'source-user',
      sourceLabel: t('sessionSettings.skills.sourceUser'),
    }
  }
  const isRuntime = Boolean(skill.isRuntime)
  const source = (skill.source || '').toLowerCase()
  if (isRuntime) {
    return {
      sourceClass: 'source-runtime',
      sourceLabel: t('sessionSettings.skills.sourceRuntime'),
    }
  }
  if (source.includes('project')) {
    return {
      sourceClass: 'source-project',
      sourceLabel: t('sessionSettings.skills.sourceProject'),
    }
  }
  if (source.includes('user')) {
    return {
      sourceClass: 'source-user',
      sourceLabel: t('sessionSettings.skills.sourceUser'),
    }
  }
  if (source === 'bundled') {
    return {
      sourceClass: 'source-bundled',
      sourceLabel: t('sessionSettings.skills.sourceBundled'),
    }
  }
  return {
    sourceClass: 'source-runtime',
    sourceLabel: t('sessionSettings.skills.sourceRuntime'),
  }
}
