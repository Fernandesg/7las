import { invoke } from "@tauri-apps/api/core"
import type { AppSettings, Friend, SharingState } from "@/types"

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

const fallbackSettingsKey = "7las:settings"
const fallbackFriendsKey = "7las:friends"

export async function getSettings(): Promise<AppSettings> {
  if (isTauri) return invoke<AppSettings>("settings_get")
  const { DEFAULT_SETTINGS } = await import("@/types")
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(fallbackSettingsKey) ?? "{}") }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  if (isTauri) return invoke<AppSettings>("settings_update", { patch: settings })
  localStorage.setItem(fallbackSettingsKey, JSON.stringify(settings))
  return settings
}

export async function listFriends(): Promise<Friend[]> {
  if (isTauri) return invoke<Friend[]>("friends_list")
  try {
    return JSON.parse(localStorage.getItem(fallbackFriendsKey) ?? "[]") as Friend[]
  } catch {
    return []
  }
}

export async function addFriend(friend: Friend): Promise<Friend[]> {
  if (isTauri) return invoke<Friend[]>("friend_add", { friend })
  const friends = [...(await listFriends()).filter((item) => item.friendId !== friend.friendId), friend]
  localStorage.setItem(fallbackFriendsKey, JSON.stringify(friends))
  return friends
}

export async function removeFriend(friendId: string): Promise<Friend[]> {
  if (isTauri) return invoke<Friend[]>("friend_remove", { friendId })
  const friends = (await listFriends()).filter((friend) => friend.friendId !== friendId)
  localStorage.setItem(fallbackFriendsKey, JSON.stringify(friends))
  return friends
}

export async function getPublicKey(): Promise<string> {
  if (isTauri) return invoke<string>("identity_get_public_key")
  const key = "7las:browser-public-key"
  const saved = localStorage.getItem(key)
  if (saved) return saved
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const value = btoa(String.fromCharCode(...bytes))
  localStorage.setItem(key, value)
  return value
}

export async function updateSharingState(state: SharingState): Promise<void> {
  if (isTauri) await invoke("sharing_set_state", { state })
}

export async function hideToTray(): Promise<void> {
  if (isTauri) await invoke("window_hide_to_tray")
}

export async function showWindow(): Promise<void> {
  if (isTauri) await invoke("window_show")
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (isTauri) await invoke("autostart_set", { enabled })
}

export async function updateShortcut(shortcut: string): Promise<void> {
  if (isTauri) await invoke("shortcut_update", { shortcut })
}
