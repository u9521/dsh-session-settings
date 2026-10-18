import type {
  SessionSettingsConfig,
  SubagentModelConfig,
  SessionMcpConfig,
  SessionSandboxConfig,
  SessionSkillsConfig,
} from '../types/index.ts'
import {
  isSessionCustomized as isSessionCustomizedShared,
  resolveEffectiveMcp as resolveMcpLayers,
  resolveEffectiveSandbox as resolveSandboxLayers,
  resolveEffectiveSessionConfig as resolveSessionConfigLayers,
  resolveEffectiveSkills as resolveSkillsLayers,
  resolveEffectiveSubagentModel as resolveSubagentModelLayers,
  type SettingsLayers,
} from '../../shared/settings.ts'

export {
  isSourceReadonly,
  sourceModeFor,
  type SettingsScopeId,
  type SourceMode,
} from '../../shared/settings.ts'

/**
 * Client adapters over the shared ladder.
 *
 * The ladder itself — which scope wins for each domain, and what an absent
 * field means — lives in `src/shared/settings.ts` and is the same code the
 * server enforces. These functions only assemble its three-layer input from
 * the three snapshots this half already holds, and keep the argument order the
 * existing call sites use.
 */

/** Whether a session entry states anything of its own. */
export const isSessionCustomized = isSessionCustomizedShared

/** Assemble the three layers from the snapshots a panel holds. */
export function settingsLayers(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SettingsLayers {
  return {
    session: sessionConfig,
    workspace: workspaceConfig,
    global: globalConfig,
  }
}

export function resolveEffectiveSubagentModel(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SubagentModelConfig {
  return resolveSubagentModelLayers(
    settingsLayers(sessionConfig, workspaceConfig, globalConfig),
  )
}

export function resolveEffectiveMcp(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SessionMcpConfig {
  const effective = resolveMcpLayers(
    settingsLayers(sessionConfig, workspaceConfig, globalConfig),
  )
  return {
    mode: effective.mode,
    enabledServerIds: effective.enabledServerIds,
    toolsMode: effective.toolsMode,
    disabledTools: effective.disabledTools,
  }
}

export function resolveEffectiveSkills(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SessionSkillsConfig {
  const effective = resolveSkillsLayers(
    settingsLayers(sessionConfig, workspaceConfig, globalConfig),
  )
  return {
    mode: effective.mode,
    disabledModelSkills: [...effective.disabledModelSkills],
    disabledUserSkills: [...effective.disabledUserSkills],
  }
}

export function resolveEffectiveSandbox(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SessionSandboxConfig {
  const effective = resolveSandboxLayers(
    settingsLayers(sessionConfig, workspaceConfig, globalConfig),
  )
  return { mode: effective.mode, allow: [...effective.allow] }
}

export function resolveEffectiveSessionConfig(
  sessionConfig?: SessionSettingsConfig,
  workspaceConfig?: SessionSettingsConfig,
  globalConfig?: SessionSettingsConfig,
): SessionSettingsConfig {
  return resolveSessionConfigLayers(
    settingsLayers(sessionConfig, workspaceConfig, globalConfig),
  )
}
