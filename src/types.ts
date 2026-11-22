export type AppView = "home" | "room" | "settings"
export type QualityMode = "sharp" | "smooth"
export type AudioMode = "none" | "process" | "system_except_discord" | "system"

export type AppSettings = {
  displayName: string
  roomName: string
  startWithWindows: boolean
  closeToTray: boolean
  globalShortcut: string
  mode: QualityMode
  audioMode: AudioMode
  audioTargetExecutable: string | null
  audioTargetWindowTitle: string | null
  relayEnabled: boolean
  relaySlots: number
  maxDirectSlots: number
  turnUrl: string
  turnUsername: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  displayName: "Você",
  roomName: "Sala dos amigos",
  startWithWindows: false,
  closeToTray: true,
  globalShortcut: "Ctrl+Shift+S",
  mode: "smooth",
  audioMode: "none",
  audioTargetExecutable: null,
  audioTargetWindowTitle: null,
  relayEnabled: false,
  relaySlots: 1,
  maxDirectSlots: 2,
  turnUrl: "",
  turnUsername: "",
}

export type Friend = {
  friendId: string
  displayName: string
  avatarSeed: number
  publicKey: string
  createdAt: number
}

export type SharingState = {
  live: boolean
  sessionId: string | null
  viewerCount: number
  directOutputs: number
}

export type SessionNotice = {
  tone: "info" | "error" | "success"
  title: string
  description?: string
} | null
