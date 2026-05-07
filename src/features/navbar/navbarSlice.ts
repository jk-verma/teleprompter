export type TeleprompterStatus = "editing" | "started" | "stopped"

export type WorkspaceSettings = {
  fontSize: number
  speed: number
  margin: number
  fontColor: string
  backgroundColor: string
}

export const WORKSPACE_SETTINGS_KEY = "teleprompter-workspace-settings"

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  fontSize: 60,
  speed: 35,
  margin: 16,
  fontColor: "#f8fbff",
  backgroundColor: "#01050b",
}

export const readWorkspaceSettings = (): WorkspaceSettings | null => {
  if (typeof window === "undefined") {
    return null
  }

  const raw = localStorage.getItem(WORKSPACE_SETTINGS_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>
    return {
      ...DEFAULT_WORKSPACE_SETTINGS,
      ...parsed,
    }
  } catch {
    return null
  }
}

export const writeWorkspaceSettings = (settings: WorkspaceSettings) => {
  if (typeof window === "undefined") {
    return
  }

  localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(settings))
}
