import * as React from 'react'
import {
  IconAgentPresetOutline16,
  IconCodeOutline16,
  IconSkillOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  NavSection,
  SubagentModelConfig,
  SkillItem,
} from '../../types/index.ts'

const e = React.createElement

export interface NavigationSidebarProps {
  activeNav: NavSection
  onNavChange: (nav: NavSection) => void
  modelConfig: SubagentModelConfig
  effectiveActiveMcpCount: number
  effectiveActiveSkillsCount: number
  availableSkills: SkillItem[]
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function NavigationSidebar({
  activeNav,
  onNavChange,
  modelConfig,
  effectiveActiveMcpCount,
  effectiveActiveSkillsCount,
  availableSkills,
  t,
}: NavigationSidebarProps) {
  return e(
    'div',
    { className: 'dsh-session-view-sidebar' },
    // 1. Model Tab
    e(
      'button',
      {
        type: 'button',
        className: `dsh-view-sidebar-item ${activeNav === 'model' ? 'active' : ''}`,
        onClick: () => onNavChange('model'),
      },
      e(
        'div',
        { className: 'dsh-view-item-icon' },
        e(IconAgentPresetOutline16, { size: 16 }),
      ),
      e(
        'span',
        { className: 'dsh-view-item-title' },
        t('sessionSettings.nav.modelTitle'),
      ),
      e(
        'span',
        { className: 'dsh-view-item-badge' },
        modelConfig.mode === 'custom'
          ? modelConfig.inherit
            ? t('sessionSettings.status.inherit')
            : modelConfig.model?.model || t('sessionSettings.status.custom')
          : modelConfig.mode === 'workspace'
            ? t('sessionSettings.status.workspace')
            : t('sessionSettings.status.default'),
      ),
    ),
    // 2. MCP Tab
    e(
      'button',
      {
        type: 'button',
        className: `dsh-view-sidebar-item ${activeNav === 'mcp' ? 'active' : ''}`,
        onClick: () => onNavChange('mcp'),
      },
      e(
        'div',
        { className: 'dsh-view-item-icon' },
        e(IconCodeOutline16, { size: 16 }),
      ),
      e(
        'span',
        { className: 'dsh-view-item-title' },
        t('sessionSettings.nav.mcpTitle'),
      ),
      e(
        'span',
        {
          className: `dsh-view-item-badge ${effectiveActiveMcpCount > 0 ? 'highlight' : ''}`,
        },
        effectiveActiveMcpCount > 0
          ? `${effectiveActiveMcpCount} MCP`
          : t('sessionSettings.status.none'),
      ),
    ),
    // 3. Skills Tab
    e(
      'button',
      {
        type: 'button',
        className: `dsh-view-sidebar-item ${activeNav === 'skills' ? 'active' : ''}`,
        onClick: () => onNavChange('skills'),
      },
      e(
        'div',
        { className: 'dsh-view-item-icon' },
        e(IconSkillOutline16, { size: 16 }),
      ),
      e(
        'span',
        { className: 'dsh-view-item-title' },
        t('sessionSettings.nav.skillsTitle'),
      ),
      e(
        'span',
        {
          className: `dsh-view-item-badge ${effectiveActiveSkillsCount > 0 ? 'highlight' : ''}`,
        },
        availableSkills.length > 0
          ? `${effectiveActiveSkillsCount}/${availableSkills.length}`
          : t('sessionSettings.status.none'),
      ),
    ),
  )
}
