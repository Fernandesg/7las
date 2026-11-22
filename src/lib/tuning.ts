import type { QualityMode } from "@/types"

export const MODES: Record<QualityMode, { hint: string; fps: number; bitrate: number }> = {
  sharp: { hint: "detail", fps: 30, bitrate: 6_000_000 },
  smooth: { hint: "motion", fps: 60, bitrate: 8_000_000 },
}

export function stereoOpus(sdp: string): string {
  const payloadType = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp)?.[1]
  if (!payloadType) return sdp
  const wanted = { stereo: "1", "sprop-stereo": "1", maxaveragebitrate: "128000" }
  const format = new RegExp(`^a=fmtp:${payloadType} ([^\\r\\n]*)`, "m")
  const line = format.exec(sdp)
  if (!line) {
    const params = Object.entries(wanted).map(([key, value]) => `${key}=${value}`)
    return sdp.replace(new RegExp(`^(a=rtpmap:${payloadType} [^\\r\\n]*)(\\r?\\n)`, "m"), `$1$2a=fmtp:${payloadType} ${params.join(";")}$2`)
  }
  const params = new Map(line[1].split(";").filter(Boolean).map((part) => part.trim().split("=") as [string, string]))
  for (const [key, value] of Object.entries(wanted)) params.set(key, value)
  return sdp.replace(format, `a=fmtp:${payloadType} ${Array.from(params, ([key, value]) => value === undefined ? key : `${key}=${value}`).join(";")}`)
}

type Codec = { mimeType: string }
const qualityOrder = ["video/AV1", "video/VP9", "video/H264"]
const softwareOrder = ["video/VP9", "video/AV1", "video/H264", "video/VP8"]

export function pickCodec<T extends Codec>(negotiated: readonly T[], hardware: ReadonlySet<string>): T | undefined {
  const find = (mime: string) => negotiated.find((codec) => codec.mimeType.toLowerCase() === mime.toLowerCase())
  for (const mime of qualityOrder) if (hardware.has(mime) && find(mime)) return find(mime)
  for (const mime of softwareOrder) if (find(mime)) return find(mime)
  return undefined
}
