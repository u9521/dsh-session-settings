import type { Context } from '@deepseek-ai/cordis'
import type { SessionSettingsStore } from '../../types.ts'
import { resolveEffectiveSubagentModel } from '../session/storage.ts'
import { resolveWorkspaceForSession } from '../session/routes.ts'

export function registerSubagentModelInterceptor(
  ctx: Context,
  getSessionSettingsStore: () => SessionSettingsStore,
): void {
  ;(ctx as any).on('agent/request', async (payload: any, next: any) => {
    const proposal = await next()
    const session = payload?.agent?.session
    if (!session?.header || session.header.origin !== 'subagent') {
      return proposal
    }

    const parentId = session.header.parentSession
    const workspaceId =
      session.header.workspaceId || resolveWorkspaceForSession(ctx, parentId)

    const sessionSettingsStore = getSessionSettingsStore()
    const effectiveCfg = resolveEffectiveSubagentModel(
      sessionSettingsStore,
      parentId,
      workspaceId,
    )

    if (
      effectiveCfg.mode !== 'custom' ||
      !effectiveCfg.provider ||
      !effectiveCfg.model
    ) {
      return proposal
    }

    return {
      ...proposal,
      provider: effectiveCfg.provider,
      model: effectiveCfg.model,
      ...(effectiveCfg.reasoningEffort
        ? { reasoningEffort: effectiveCfg.reasoningEffort }
        : {}),
    }
  })
}
