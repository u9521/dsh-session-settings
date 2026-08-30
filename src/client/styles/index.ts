import { BASE_CSS } from './base.ts'
import { HERO_CHIP_CSS } from './heroChip.ts'
import { SESSION_VIEW_CSS } from './sessionView.ts'
import { MODEL_SECTION_CSS } from './modelSection.ts'
import { SET_DEFAULT_MODAL_CSS } from './setDefaultModal.ts'
import { SESSION_MCP_CSS } from './sessionMcp.ts'
import { GLOBAL_MCP_TAB_CSS } from './globalMcpTab.ts'
import { SESSION_SKILLS_CSS } from './sessionSkills.ts'

export * from './base.ts'
export * from './heroChip.ts'
export * from './sessionView.ts'
export * from './modelSection.ts'
export * from './setDefaultModal.ts'
export * from './sessionMcp.ts'
export * from './globalMcpTab.ts'
export * from './sessionSkills.ts'

const CORE_CSS = [
  BASE_CSS,
  SESSION_VIEW_CSS,
  MODEL_SECTION_CSS,
  HERO_CHIP_CSS,
  SET_DEFAULT_MODAL_CSS,
].join('\n\n')

const MCP_CSS = [SESSION_MCP_CSS, GLOBAL_MCP_TAB_CSS].join('\n\n')

const SKILLS_CSS = SESSION_SKILLS_CSS

export const CSS = [CORE_CSS, MCP_CSS, SKILLS_CSS].join('\n\n')
export default CSS
