import type { NodeMetrics } from "@/media/tree-coordinator"

type Sample = { bytes: number; packets: number; lost: number; at: number }
type Stat = { type: string; [key: string]: unknown }
const samples = new WeakMap<RTCPeerConnection, Sample>()

export async function collectMetrics(peer: RTCPeerConnection, base: Pick<NodeMetrics, "nodeId" | "sessionId" | "treeEpoch" | "activeChildren" | "relayEnabled" | "relaySlots">): Promise<NodeMetrics> {
  const report = await peer.getStats()
  let video: Stat | undefined
  let pair: Stat | undefined
  for (const value of report.values()) {
    const stat = value as Stat
    if ((stat.type === "inbound-rtp" || stat.type === "outbound-rtp") && stat.kind === "video") video = stat
    if (stat.type === "candidate-pair" && stat.state === "succeeded" && stat.nominated) pair = stat
  }
  const bytes = Number(video?.bytesReceived ?? video?.bytesSent ?? 0)
  const packets = Number(video?.packetsReceived ?? video?.packetsSent ?? 0)
  const lost = Number(video?.packetsLost ?? 0)
  const now = Date.now()
  const previous = samples.get(peer)
  samples.set(peer, { bytes, packets, lost, at: now })
  const elapsed = previous ? Math.max(now - previous.at, 1) : 0
  const bitrate = previous ? Math.max(0, ((bytes - previous.bytes) * 8 * 1000) / elapsed) : null
  const packetDelta = previous ? Math.max(0, packets - previous.packets) : 0
  const lossDelta = previous ? Math.max(0, lost - previous.lost) : 0
  const local = pair ? report.get(pair.localCandidateId as string) as Stat | undefined : undefined
  const remote = pair ? report.get(pair.remoteCandidateId as string) as Stat | undefined : undefined
  return {
    ...base,
    at: now,
    rttMs: pair?.currentRoundTripTime === undefined ? null : Number(pair.currentRoundTripTime) * 1000,
    jitterMs: video?.jitter === undefined ? null : Number(video.jitter) * 1000,
    packetLossPct: previous && packetDelta + lossDelta > 0 ? (lossDelta / (packetDelta + lossDelta)) * 100 : null,
    incomingBitrate: video?.type === "inbound-rtp" ? bitrate : null,
    outgoingBitrate: video?.type === "outbound-rtp" ? bitrate : null,
    availableOutgoingBitrate: pair?.availableOutgoingBitrate === undefined ? null : Number(pair.availableOutgoingBitrate),
    framesPerSecond: video?.framesPerSecond === undefined ? null : Number(video.framesPerSecond),
    freezeCount: Number(video?.freezeCount ?? 0),
    qualityLimitationReason: video?.qualityLimitationReason && video.qualityLimitationReason !== "none" ? String(video.qualityLimitationReason) : null,
    route: local?.candidateType === "relay" || remote?.candidateType === "relay" ? "turn" : pair ? "direct" : "unknown",
  }
}
