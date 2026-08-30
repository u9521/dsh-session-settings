import * as React from 'react'
import {
  type SkillItem,
  type SessionSettingsConfig,
  API_ENDPOINTS,
} from '../../types/index.ts'

export function useGlobalSkills(
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const [skills, setSkills] = React.useState<SkillItem[]>([])
  const [globalConfig, setGlobalConfig] = React.useState<SessionSettingsConfig>(
    {
      subagentModel: { inherit: true },
      mcp: { enabledServerIds: [] },
      skills: {
        disabledModelSkills: [],
        disabledUserSkills: [],
      },
    },
  )
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

  const filteredSkills = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)),
    )
  }, [skills, search])

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
      const [skillsRes, settingsRes] = await Promise.all([
        fetch(API_ENDPOINTS.skills),
        fetch(API_ENDPOINTS.getSettings),
      ])

      if (skillsRes.ok) {
        const skillsData = (await skillsRes.json()) as {
          ok?: boolean
          skills?: SkillItem[]
        }
        if (skillsData?.ok && Array.isArray(skillsData.skills)) {
          setSkills(skillsData.skills)
        }
      }

      if (settingsRes.ok) {
        const settingsData = (await settingsRes.json()) as {
          ok?: boolean
          globalConfig?: SessionSettingsConfig
        }
        if (settingsData?.ok && settingsData.globalConfig) {
          setGlobalConfig(settingsData.globalConfig)
          if (settingsData.globalConfig.skills) {
            const mList =
              settingsData.globalConfig.skills.disabledModelSkills || []
            const uList =
              settingsData.globalConfig.skills.disabledUserSkills || []
            setDefaultDisabledModelList(mList)
            setDefaultDisabledUserList(uList)
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
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

  const handleSaveSkillModal = async (
    skillName: string,
    modelDisabled: boolean,
    userDisabled: boolean,
  ) => {
    setSaving(true)
    setError('')
    setSuccessMsg('')

    const nextModelList = modelDisabled
      ? Array.from(new Set([...defaultDisabledModelList, skillName]))
      : defaultDisabledModelList.filter((n) => n !== skillName)

    const nextUserList = userDisabled
      ? Array.from(new Set([...defaultDisabledUserList, skillName]))
      : defaultDisabledUserList.filter((n) => n !== skillName)

    const payloadGlobalConfig: SessionSettingsConfig = {
      subagentModel: globalConfig.subagentModel || { inherit: true },
      mcp: globalConfig.mcp || { enabledServerIds: [] },
      skills: {
        disabledModelSkills: nextModelList,
        disabledUserSkills: nextUserList,
      },
    }

    try {
      const res = await fetch(API_ENDPOINTS.saveSettings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalConfig: payloadGlobalConfig,
          isDefault: true,
        }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (res.ok && data?.ok) {
        setGlobalConfig(payloadGlobalConfig)
        setDefaultDisabledModelList(nextModelList)
        setDefaultDisabledUserList(nextUserList)
        setSelectedSkillForModal(null)
        setSuccessMsg(t('skillsSettings.notices.saved'))
        setTimeout(() => setSuccessMsg(''), 3500)
      } else {
        setError(
          t('skillsSettings.notices.saveError') +
            (data?.error || 'Unknown error'),
        )
      }
    } catch (err: unknown) {
      setError(
        t('skillsSettings.notices.saveError') +
          (err instanceof Error ? err.message : String(err)),
      )
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
          `${API_ENDPOINTS.skillsContent}?name=${encodeURIComponent(skillName)}`,
        )
        if (res.ok) {
          const data = (await res.json()) as {
            ok?: boolean
            skill?: SkillItem
          }
          if (data?.ok && data.skill) {
            setSkillsContentMap((prev) => ({
              ...prev,
              [skillName]: data.skill as SkillItem,
            }))
          } else {
            setSkillsContentMap((prev) => ({
              ...prev,
              [skillName]: {
                ...skill,
                content: t('sessionSettings.skills.loadError'),
              },
            }))
          }
        }
      } catch (err: unknown) {
        setSkillsContentMap((prev) => ({
          ...prev,
          [skillName]: {
            ...skill,
            content: t('sessionSettings.skills.loadErrorWithReason', {
              reason: err instanceof Error ? err.message : String(err),
            }),
          },
        }))
      } finally {
        setSkillsLoadingMap((prev) => ({ ...prev, [skillName]: false }))
      }
    }
  }

  const handleCloseSkillModal = () => {
    setSelectedSkillForModal(null)
  }

  return {
    skills,
    filteredSkills,
    globalConfig,
    defaultDisabledModelList,
    defaultDisabledUserList,
    defaultDisabledModelSet,
    defaultDisabledUserSet,
    nonRuntimeSkills,
    enabledCount,
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
    handleToggleModelInvocable,
    handleToggleUserInvocable,
    handleSaveSkillModal,
    handleOpenSkillModal,
    handleCloseSkillModal,
    loadSkills,
  }
}
