import * as React from 'react'
import {
  IconAgentPresetOutlineMedium,
  IconCodeOutlineMedium,
  IconShieldOutlineMedium,
  IconSkillOutlineMedium,
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
  /** Extra writable directories at the effective scope; drives the tab badge. */
  sandboxAllowCount?: number
  t: (key: string, vars?: Record<string, string | number>) => string
}

export function NavigationSidebar({
  activeNav,
  onNavChange,
  modelConfig,
  effectiveActiveMcpCount,
  effectiveActiveSkillsCount,
  availableSkills,
  sandboxAllowCount = 0,
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
        e(IconAgentPresetOutlineMedium, { size: 16 }),
      ),
      e(
        'span',
        { className: 'dsh-view-item-title' },
        t('sessionSettings.nav.modelTitle'),
      ),
      e(
        'span',
        { className: 'dsh-view-item-badge' },
        modelConfig?.mode === 'custom'
          ? modelConfig.inherit
            ? t('sessionSettings.status.inherit')
            : modelConfig.model?.model || t('sessionSettings.status.custom')
          : modelConfig?.mode === 'workspace'
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
        e(IconCodeOutlineMedium, { size: 16 }),
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
        e(IconSkillOutlineMedium, { size: 16 }),
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
        (availableSkills || []).length > 0
          ? `${effectiveActiveSkillsCount}/${availableSkills.length}`
          : t('sessionSettings.status.none'),
      ),
    ),
    // 4. Sandbox Tab
    e(
      'button',
      {
        type: 'button',
        className: `dsh-view-sidebar-item ${activeNav === 'sandbox' ? 'active' : ''}`,
        onClick: () => onNavChange('sandbox'),
      },
      e(
        'div',
        { className: 'dsh-view-item-icon' },
        e(IconShieldOutlineMedium, { size: 16 }),
      ),
      e(
        'span',
        { className: 'dsh-view-item-title' },
        t('sessionSettings.nav.sandboxTitle'),
      ),
      e(
        'span',
        {
          className: `dsh-view-item-badge ${sandboxAllowCount > 0 ? 'highlight' : ''}`,
        },
        sandboxAllowCount > 0
          ? `${sandboxAllowCount}`
          : t('sessionSettings.status.none'),
      ),
    ),
  )
}
