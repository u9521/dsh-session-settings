import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { createRoot, type Root } from 'react-dom/client'
import * as locales from './locales/index.ts'
import {
  LOCALE_NS,
  type ClientRemoteApi,
  type SessionsState,
  type WorkspacesState,
} from './types/index.ts'
import { SessionSettingsViewPage } from './session/index.ts'
import { McpServersSettingsTab } from './mcp/index.ts'
import { SkillsSettingsTab } from './skills/index.ts'
import { SessionSettingsHeroChip } from './hero/index.ts'
import { CSS } from './styles/index.ts'

const e = React.createElement

export const inject = [
  'slots',
  'connection',
  'locale',
  'sessions',
  'workspaces',
]

interface ClientSlotsService {
  inject: (name: string, callback: () => void) => void
  register: (
    meta: {
      name: string
      id: string
      order?: number
      label?: () => string
    },
    component: React.ComponentType<Record<string, unknown>>,
  ) => void
}

interface ClientConnectionService {
  api: ClientRemoteApi
}

interface ClientLocaleService {
  register: (ns: string, dicts: Record<string, Record<string, string>>) => void
  bind: (
    ns: string,
  ) => (key: string, vars?: Record<string, string | number>) => string
  subscribe: (callback: () => void) => () => void
}

interface ClientStoreService<T> {
  list?: {
    subscribe?: (cb: () => void) => () => void
    getSnapshot?: () => T
  }
}

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as ClientSlotsService | undefined
  const connection = ctx.get('connection') as
    ClientConnectionService | undefined
  const locale = ctx.get('locale') as ClientLocaleService | undefined

  if (!slots || !connection || !locale) return

  // 1. Register Locale
  ctx.effect(() => {
    locale.register(LOCALE_NS, {
      zh: locales.flattenDictionary(locales.zh),
      en: locales.flattenDictionary(locales.en),
    })
    return () => {}
  }, 'session-settings: locale')

  let translator = locale.bind(LOCALE_NS)
  ctx.effect(() => {
    const unsub = locale.subscribe(() => {
      translator = locale.bind(LOCALE_NS)
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, 'session-settings: locale updates')

  // 2. Inject CSS
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = '@local/dsh-session-settings'
    style.textContent = CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, 'session-settings: styles')

  // 3. Register Settings Section for MCP Servers (id: 'mcp-servers', order: 25)
  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'mcp-servers',
        order: 25,
        label: () => translator('mcpServers.tabLabel'),
      },
      function McpSettingsSection(props: Record<string, unknown>) {
        return e(McpServersSettingsTab, {
          ...props,
          api: connection.api,
          t: translator,
        })
      },
    ),
  )

  // 4. Register Settings Section for Skills (id: 'skills', order: 26)
  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'skills',
        order: 26,
        label: () => translator('skillsSettings.tabLabel'),
      },
      function SkillsSettingsSection(props: Record<string, unknown>) {
        return e(SkillsSettingsTab, {
          ...props,
          api: connection.api,
          t: translator,
        })
      },
    ),
  )

  // 5. Register conversation.view tab slot (Independent tab right after 轨迹, order: 20)
  slots.inject('conversation.view', () =>
    slots.register(
      {
        name: 'conversation.view',
        id: 'session-settings',
        order: 20,
        label: () => translator('sessionSettings.title'),
      },
      function SessionSettingsTabSlot(props: Record<string, unknown>) {
        const sessionsService = ctx.get('sessions') as unknown as
          ClientStoreService<SessionsState> | undefined
        const workspacesService = ctx.get('workspaces') as unknown as
          ClientStoreService<WorkspacesState> | undefined
        return e(SessionSettingsViewPage, {
          ...props,
          api: connection.api,
          t: translator,
          useSessions: (selector) => {
            const snap = sessionsService?.list?.getSnapshot?.() || {}
            return selector ? selector(snap) : snap
          },
          useWorkspaces: (selector) => {
            const snap = workspacesService?.list?.getSnapshot?.() || {}
            return selector ? selector(snap) : snap
          },
        })
      },
    ),
  )

  // 6. Decorate Settings sidebar nav icons for MCP Servers and Skills using official icons
  ctx.effect(() => {
    let frame = 0
    const updateNavIcons = () => {
      // Only execute when a dialog is open (e.g. Settings dialog)
      if (document.querySelector('[role="dialog"]') === null) return

      const navButtons = document.querySelectorAll('button[class*="navCell"]')
      for (const btn of Array.from(navButtons)) {
        const label = btn.querySelector('span[class*="navLabel"]')
        if (!label) continue

        // MCP Servers icon: IconCodeOutline16
        if (
          label.textContent === 'MCP 服务器' ||
          label.textContent === 'MCP Servers'
        ) {
          const iconSvg = btn.querySelector('svg[class*="navIcon"]')
          if (iconSvg && !iconSvg.getAttribute('data-mcp-official-icon')) {
            iconSvg.setAttribute('data-mcp-official-icon', 'true')
            iconSvg.setAttribute('viewBox', '0 0 16 16')
            iconSvg.innerHTML = `
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12.3368 1.53569L11.931 4.43172H14.8086V5.79673H11.7404L11.1962 9.67859H14.2839V11.0436H11.0056L10.4994 14.6529L9.14873 14.4643L9.62731 11.0436H5.75876L5.25252 14.6529L3.90186 14.4643L4.38043 11.0436H1.69141V9.67859H4.57104L5.11417 5.79673H2.21609V4.43172H5.30581L5.73724 1.34713L7.08995 1.53569L6.68414 4.43172H10.5527L10.9841 1.34713L12.3368 1.53569ZM5.94937 9.67859H9.81791L10.361 5.79673H6.49353L5.94937 9.67859Z" />
            `
          }
        }

        // Skills icon: IconSkillOutline16
        if (label.textContent === '技能' || label.textContent === 'Skills') {
          const iconSvg = btn.querySelector('svg[class*="navIcon"]')
          if (iconSvg && !iconSvg.getAttribute('data-skills-official-icon')) {
            iconSvg.setAttribute('data-skills-official-icon', 'true')
            iconSvg.setAttribute('viewBox', '0 0 16 16')
            iconSvg.innerHTML = `
            <path fill="currentColor" d="M12.5113 15.4067C12.4395 15.6249 12.1308 15.6249 12.059 15.4067L11.643 14.1416C11.454 13.567 11.0033 13.1164 10.4288 12.9274L9.16369 12.5113C8.94544 12.4395 8.94544 12.1308 9.16369 12.059L10.4288 11.643C11.0033 11.454 11.454 11.0033 11.643 10.4288L12.059 9.16369C12.1308 8.94544 12.4395 8.94544 12.5113 9.16369L12.9274 10.4288C13.1164 11.0033 13.567 11.454 14.1416 11.643L15.4067 12.059C15.6249 12.1308 15.6249 12.4395 15.4067 12.5113L14.1416 12.9274C13.567 13.1164 13.1164 13.567 12.9274 14.1416L12.5113 15.4067Z" />
            <path fill="currentColor" d="M9.02246 0.546878C9.9822 0.546878 10.7564 0.545403 11.374 0.612307C12.0042 0.680586 12.5515 0.826244 13.0273 1.17188C13.3052 1.37376 13.5501 1.61868 13.752 1.89649C14.0975 2.37225 14.2432 2.91984 14.3115 3.54981C14.3784 4.16727 14.377 4.94206 14.377 5.90137V8.51367C13.9611 8.29533 13.5071 8.13985 13.0273 8.06055V5.90137C13.0273 4.9121 13.0259 4.22322 12.9688 3.69532C12.9129 3.18044 12.8098 2.89782 12.6592 2.69043C12.5406 2.52724 12.3966 2.38326 12.2334 2.26465C12.026 2.11404 11.7437 2.0109 11.2285 1.95508C10.7005 1.89789 10.0122 1.89649 9.02246 1.89649H6.55371C5.56395 1.89649 4.87569 1.89787 4.34766 1.95508C3.83242 2.01092 3.55022 2.11398 3.34278 2.26465C3.17953 2.38329 3.03564 2.52719 2.91699 2.69043C2.76642 2.89782 2.66325 3.18042 2.60742 3.69532C2.55027 4.22322 2.54883 4.9121 2.54883 5.90137V10.0986C2.54883 11.0878 2.55031 11.7768 2.60742 12.3047C2.66326 12.8196 2.76642 13.1032 2.91699 13.3105C3.03558 13.4736 3.17966 13.6178 3.34278 13.7363C3.5502 13.8869 3.83265 13.9901 4.34766 14.0459C4.87568 14.1031 5.56398 14.1035 6.55371 14.1035H8.08399C8.27443 14.6025 8.55077 15.0585 8.89551 15.4541H6.55371C5.59402 15.4541 4.81976 15.4546 4.20215 15.3877C3.57204 15.3194 3.02468 15.1738 2.54883 14.8281C2.27111 14.6263 2.02606 14.3813 1.82422 14.1035C1.47883 13.6278 1.33293 13.08 1.26465 12.4502C1.19783 11.8327 1.19922 11.0579 1.19922 10.0986V5.90137C1.19922 4.94206 1.1978 4.16727 1.26465 3.54981C1.33295 2.91984 1.47867 2.37225 1.82422 1.89649C2.02613 1.61864 2.27098 1.37379 2.54883 1.17188C3.02472 0.826181 3.57197 0.6806 4.20215 0.612307C4.81976 0.545393 5.594 0.546877 6.55371 0.546878H9.02246ZM9.19629 9.14649H4.5459V7.84571H9.19629V9.14649ZM11.0303 6.10645H4.5459V4.80567H11.0303V6.10645Z" />
            `
          }
        }
      }
    }

    const scheduleUpdate = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        updateNavIcons()
      })
    }

    const observer = new MutationObserver(scheduleUpdate)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, 'session-settings: official sidebar nav icons')

  // 7. Mount Hero Session Settings Chip (in New Conversation Hero right after agent preset selector)
  ctx.effect(() => {
    let unmounted = false
    let currentRoot: Root | null = null
    let currentContainer: HTMLElement | null = null
    let frame = 0

    const checkMount = () => {
      if (unmounted) return
      const heroRow = document.querySelector(
        'div[class*="heroWorkspaceRow"], div[class*="workspaceRow"]',
      )
      if (!heroRow) {
        if (currentRoot) {
          currentRoot.unmount()
          currentRoot = null
          currentContainer = null
        }
        return
      }

      // If container already mounted in this row and still in DOM
      if (currentContainer && heroRow.contains(currentContainer)) {
        // Ensure it stays after the agent preset selector button if agent preset loaded later
        const seatBtn = heroRow.querySelector(
          'button[class*="seat"], div[class*="seat"], [class*="agentPreset"]',
        )
        if (
          seatBtn &&
          seatBtn.parentNode === heroRow &&
          currentContainer.previousElementSibling !== seatBtn
        ) {
          seatBtn.after(currentContainer)
        }
        return
      }

      if (currentRoot) {
        currentRoot.unmount()
        currentRoot = null
        currentContainer = null
      }

      const container = document.createElement('div')
      container.setAttribute('data-dsh-hero-session-settings', '')
      container.className = 'dsh-hero-session-settings-seat'

      // Insert directly after Agent Preset selector (button[class*="seat"]) if present, else append
      const seatBtn = heroRow.querySelector(
        'button[class*="seat"], div[class*="seat"], [class*="agentPreset"]',
      )
      if (seatBtn && seatBtn.parentNode === heroRow) {
        seatBtn.after(container)
      } else {
        heroRow.appendChild(container)
      }

      currentContainer = container
      currentRoot = createRoot(container)

      currentRoot.render(
        e(SessionSettingsHeroChip, {
          api: connection.api,
          locale: ctx.get('locale') as unknown as {
            bind?: (
              ns: string,
            ) => (key: string, vars?: Record<string, string | number>) => string
          },
          sessions: ctx.get('sessions') as unknown as {
            list?: {
              subscribe: (cb: () => void) => () => void
              getSnapshot: () => SessionsState
            }
          },
          workspaces: ctx.get('workspaces') as unknown as {
            list?: {
              subscribe: (cb: () => void) => () => void
              getSnapshot: () => WorkspacesState
            }
          },
        }),
      )
    }

    const scheduleCheck = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        checkMount()
      })
    }

    const observer = new MutationObserver(scheduleCheck)
    observer.observe(document.body, { childList: true, subtree: true })
    scheduleCheck()

    return () => {
      unmounted = true
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
      if (currentRoot) {
        currentRoot.unmount()
        currentRoot = null
        currentContainer = null
      }
    }
  }, 'session-settings: hero chip')
}
