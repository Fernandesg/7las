const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const ID = /^[0-9A-Za-z]{22}$/

export type SessionInvite = { secret: string; hostId: string }

export function newSecret(): string {
  let output = ""
  while (output.length < 22) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < 248 && output.length < 22) output += BASE62[byte % 62]
    }
  }
  return output
}

export async function roomName(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`7las:${secret}`)
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data))
  return Array.from(hash.subarray(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function parseSessionInvite(value: string): SessionInvite {
  const hash = value.trim().includes("#") ? value.trim().slice(value.trim().indexOf("#") + 1) : value.trim()
  const [secret, hostId, ...rest] = hash.split("~")
  if (rest.length || !ID.test(secret ?? "") || !ID.test(hostId ?? "")) {
    throw new Error("O convite está incompleto ou inválido.")
  }
  return { secret, hostId }
}

export function sessionInviteCode(invite: SessionInvite): string {
  return `${invite.secret}~${invite.hostId}`
}
