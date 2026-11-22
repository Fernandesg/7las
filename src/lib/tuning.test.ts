import { describe, expect, it } from "vitest"
import { MODES, pickCodec, stereoOpus } from "@/lib/tuning"
import { parseSessionInvite, sessionInviteCode } from "@/lib/link"

describe("WebRTC tuning", () => {
  it("aplica os tetos de Text e Motion", () => {
    expect(MODES.sharp).toMatchObject({ fps: 30, bitrate: 6_000_000 })
    expect(MODES.smooth).toMatchObject({ fps: 60, bitrate: 8_000_000 })
  })

  it("prioriza hardware e negocia somente codecs disponíveis", () => {
    const codecs = [{ mimeType: "video/H264" }, { mimeType: "video/VP9" }]
    expect(pickCodec(codecs, new Set(["video/VP9"]))?.mimeType).toBe("video/VP9")
    expect(pickCodec(codecs, new Set(["video/AV1"]))?.mimeType).toBe("video/VP9")
  })

  it("configura Opus estéreo a 128 kbps", () => {
    const sdp = "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10\r\n"
    expect(stereoOpus(sdp)).toContain("stereo=1")
    expect(stereoOpus(sdp)).toContain("maxaveragebitrate=128000")
  })
})

describe("session invite", () => {
  it("aceita código ou URL completa", () => {
    const code = `${"a".repeat(22)}~${"B".repeat(22)}`
    expect(parseSessionInvite(code)).toEqual({ secret: "a".repeat(22), hostId: "B".repeat(22) })
    expect(parseSessionInvite(`https://7las.local/#${code}`)).toEqual(parseSessionInvite(code))
    expect(sessionInviteCode(parseSessionInvite(code))).toBe(code)
  })

  it("rejeita convites incompletos", () => {
    expect(() => parseSessionInvite("abc")).toThrow("incompleto")
    expect(() => parseSessionInvite(`${"a".repeat(22)}~${"b".repeat(22)}~extra`)).toThrow()
  })
})
