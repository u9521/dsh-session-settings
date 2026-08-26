import type { SkillSourceMeta } from '../types/index.ts'

export function getSkillSourceMeta(
  skill: { source?: string; isRuntime?: boolean } | null | undefined,
  t: (key: string, params?: any) => string,
): SkillSourceMeta {
  if (!skill) {
    return {
      sourceClass: 'source-user',
      sourceLabel: t('sessionSettings.skills.sourceUser') || '用户技能',
    }
  }
  const isRuntime = Boolean(skill.isRuntime)
  const source = (skill.source || '').toLowerCase()
  if (isRuntime) {
    return {
      sourceClass: 'source-runtime',
      sourceLabel:
        t('sessionSettings.skills.sourceRuntime') ||
        t('sessionSettings.skills.runtimeBadge') ||
        '运行时预设',
    }
  }
  if (source.includes('project')) {
    return {
      sourceClass: 'source-project',
      sourceLabel: t('sessionSettings.skills.sourceProject') || '项目技能',
    }
  }
  if (source.includes('user')) {
    return {
      sourceClass: 'source-user',
      sourceLabel: t('sessionSettings.skills.sourceUser') || '用户技能',
    }
  }
  if (source === 'bundled') {
    return {
      sourceClass: 'source-bundled',
      sourceLabel: t('sessionSettings.skills.sourceBundled') || '内置技能',
    }
  }
  return {
    sourceClass: 'source-runtime',
    sourceLabel:
      t('sessionSettings.skills.sourceRuntime') ||
      t('sessionSettings.skills.runtimeBadge') ||
      '运行时预设',
  }
}
