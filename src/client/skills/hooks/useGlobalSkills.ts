import * as React from 'react'
import type { SkillItem, SessionSettingsConfig } from '../../types/index.ts'

export function useGlobalSkills(
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const [skills, setSkills] = React.useState<SkillItem[]>([])
  const [defaultSettings, setDefaultSettings] =
    React.useState<SessionSettingsConfig>({
      subagentModel: { mode: 'inherit' },
      mcp: { mode: 'default', enabledServerIds: [] },
      skills: {
        mode: 'default',
        disabledSkills: [],
        disabledModelSkills: [],
        disabledUserSkills: [],
      },
    })
  const [defaultDisabledModelList, setDefaultDisabledModelList] =
    React.useState<string[]>([])
  const [defaultDisabledUserList, setDefaultDisabledUserList] = React.useState<
    string[]
  >([])

  const [loading, setLoading] = React.useState<boolean>(true)
  const [saving, setSaving] = React.useState<boolean>(false)
  const [search, setSearch] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')
  const [successMsg, setSuccessMsg] = React.useState<string>('')

  // Modal State
  const [selectedSkillForModal, setSelectedSkillForModal] =
    React.useState<SkillItem | null>(null)
  const [skillsContentMap, setSkillsContentMap] = React.useState<
    Record<string, SkillItem>
  >({})
  const [skillsLoadingMap, setSkillsLoadingMap] = React.useState<
    Record<string, boolean>
  >({})

  const defaultDisabledModelSet = React.useMemo(
    () => new Set(defaultDisabledModelList),
    [defaultDisabledModelList],
  )
  const defaultDisabledUserSet = React.useMemo(
    () => new Set(defaultDisabledUserList),
    [defaultDisabledUserList],
  )

  const nonRuntimeSkills = React.useMemo(
    () => skills.filter((s) => !s.isRuntime),
    [skills],
  )

  const enabledCount = React.useMemo(
    () =>
      nonRuntimeSkills.filter((s) => !defaultDisabledModelSet.has(s.name))
        .length,
    [nonRuntimeSkills, defaultDisabledModelSet],
  )

  const loadSkills = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/session-settings')
      if (res.ok) {
        const data = await res.json()
        if (data?.ok) {
          if (Array.isArray(data.availableSkills)) {
            setSkills(data.availableSkills)
          }
          if (data.defaultConfig) {
            setDefaultSettings(data.defaultConfig)
            if (data.defaultConfig.skills) {
              const mList =
                data.defaultConfig.skills.disabledModelSkills ||
                data.defaultConfig.skills.disabledSkills ||
                []
              const uList = data.defaultConfig.skills.disabledUserSkills || []
              setDefaultDisabledModelList(mList)
              setDefaultDisabledUserList(uList)
            }
          }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(
          t('notices.saveError') + ' ' + (data?.error || `HTTP ${res.status}`),
        )
      }
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadSkills()
  }, [])

  const handleToggleModelInvocable = (skillName: string) => {
    setSuccessMsg('')
    setError('')
    setDefaultDisabledModelList((prev) =>
      prev.includes(skillName)
        ? prev.filter((n) => n !== skillName)
        : [...prev, skillName],
    )
  }

  const handleToggleUserInvocable = (skillName: string) => {
    setSuccessMsg('')
    setError('')
    setDefaultDisabledUserList((prev) =>
      prev.includes(skillName)
        ? prev.filter((n) => n !== skillName)
        : [...prev, skillName],
    )
  }

  const handleSaveDefault = async () => {
    setSaving(true)
    setError('')
    setSuccessMsg('')

    const payloadConfig: SessionSettingsConfig = {
      subagentModel: defaultSettings.subagentModel || { mode: 'inherit' },
      mcp: defaultSettings.mcp || { mode: 'default', enabledServerIds: [] },
      skills: {
        mode: 'default',
        disabledSkills: defaultDisabledModelList,
        disabledModelSkills: defaultDisabledModelList,
        disabledUserSkills: defaultDisabledUserList,
      },
    }

    try {
      const res = await fetch('/api/session-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: payloadConfig,
          isDefault: true,
        }),
      })

      const data = await res.json()
      if (res.ok && data?.ok) {
        setDefaultSettings(payloadConfig)
        setSuccessMsg(t('notices.saved'))
        setTimeout(() => setSuccessMsg(''), 3500)
      } else {
        setError(t('notices.saveError') + (data?.error || 'Unknown error'))
      }
    } catch (err: any) {
      setError(t('notices.saveError') + (err?.message || String(err)))
    } finally {
      setSaving(false)
    }
  }

  const handleOpenSkillModal = async (skill: SkillItem) => {
    setSelectedSkillForModal(skill)
    const skillName = skill.name
    if (!skillsContentMap[skillName] && !skill.content) {
      setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: true }))
      try {
        const res = await fetch(
          `/api/session-settings/skills/content?name=${encodeURIComponent(skillName)}`,
        )
        if (res.ok) {
          const data = await res.json()
          if (data?.ok && data.skill) {
            setSkillsContentMap((prev) => ({
              ...prev,
              [skillName]: data.skill,
            }))
          }
        }
      } catch {
        // ignore
      } finally {
        setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: false }))
      }
    }
  }

  const filteredSkills = skills.filter((s) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.source || '').toLowerCase().includes(q) ||
      (s.provider || '').toLowerCase().includes(q)
    )
  })

  return {
    skills,
    filteredSkills,
    nonRuntimeSkills,
    enabledCount,
    defaultDisabledModelSet,
    defaultDisabledUserSet,
    loading,
    saving,
    search,
    setSearch,
    error,
    successMsg,
    selectedSkillForModal,
    setSelectedSkillForModal,
    skillsContentMap,
    skillsLoadingMap,
    loadSkills,
    handleToggleModelInvocable,
    handleToggleUserInvocable,
    handleSaveDefault,
    handleOpenSkillModal,
  }
}
