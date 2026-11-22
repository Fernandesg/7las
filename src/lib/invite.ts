import type { Friend } from "@/types"

type InvitePayload = {
  version: 1
  friendId: string
  displayName: string
  publicKey: string
  expiresAt: number
}

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function decode(value: string): unknown {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function createFriendInvite(displayName: string, publicKey: string): string {
  const friendId = crypto.randomUUID()
  return encode({
    version: 1,
    friendId,
    displayName: displayName.trim(),
    publicKey,
    expiresAt: Date.now() + 15 * 60 * 1000,
  } satisfies InvitePayload)
}

export function parseFriendInvite(code: string): Friend {
  const payload = decode(code.trim()) as Partial<InvitePayload>
  if (
    payload.version !== 1 ||
    typeof payload.friendId !== "string" ||
    payload.friendId.length > 64 ||
    typeof payload.displayName !== "string" ||
    !payload.displayName.trim() ||
    payload.displayName.length > 40 ||
    typeof payload.publicKey !== "string" ||
    payload.publicKey.length > 128 ||
    typeof payload.expiresAt !== "number"
  ) {
    throw new Error("Este convite não tem um formato válido.")
  }
  if (payload.expiresAt < Date.now()) throw new Error("Este convite expirou. Peça um novo ao seu amigo.")
  return {
    friendId: payload.friendId,
    displayName: payload.displayName.trim(),
    avatarSeed: Array.from(payload.friendId).reduce((sum, char) => sum + char.charCodeAt(0), 0),
    publicKey: payload.publicKey,
    createdAt: Date.now(),
  }
}
