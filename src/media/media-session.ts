import { applyContentHint, captureScreen, newCaptureController } from "@/lib/capture"
import { newSecret, parseSessionInvite, sessionInviteCode, type SessionInvite } from "@/lib/link"
import { detectHardware, setPeerMode } from "@/lib/peer"
import { enterRoom, type RoomSession } from "@/lib/room"
import type { AppSettings, QualityMode } from "@/types"
import { IncomingStream } from "@/media/incoming-stream"
import { collectMetrics } from "@/media/metrics"
import { OutgoingStream } from "@/media/outgoing-stream"
import { acceptsStream, isTreeAssignment, type TreeAssignment } from "@/media/protocol"
import { RelayNode } from "@/media/relay-node"
import { TreeCoordinator, type NodeMetrics } from "@/media/tree-coordinator"

export type SessionStatus = "connecting" | "live" | "reconnecting" | "ended"
export type ViewerInfo = {
  id: string
  name: string
  parentId: string | null
  relayEnabled: boolean
  children: string[]
  bitrate: number | null
  route: "direct" | "turn" | "unknown"
}

export class MediaSession {
  readonly role: "host" | "viewer"
  readonly hostId: string
  readonly selfId: string
  readonly invite: SessionInvite
  readonly out: MediaStream | null
  status: SessionStatus = "connecting"
  error: string | null = null

  private screen: MediaStream | null = null
  private incoming = new IncomingStream()
  private assignment: TreeAssignment | null = null
  private coordinator: TreeCoordinator | null = null
  private outputs = new Map<string, OutgoingStream>()
  private relay: RelayNode | null = null
  private offs: (() => void)[] = []
  private stopped = false
  private lastEpoch = -1
  private metricsTimer: number | undefined
  private session: RoomSession
  private settings: AppSettings
  private onChange: () => void
  private onEnd: () => void

  private constructor(
    session: RoomSession,
    role: "host" | "viewer",
    hostId: string,
    selfId: string,
    invite: SessionInvite,
    settings: AppSettings,
    onChange: () => void,
    onEnd: () => void,
    screen: MediaStream | null,
  ) {
    this.session = session
    this.settings = settings
    this.onChange = onChange
    this.onEnd = onEnd
    this.role = role
    this.hostId = hostId
    this.selfId = selfId
    this.invite = invite
    this.screen = screen
    this.out = screen ? new MediaStream(screen.getTracks()) : null
  }

  static async startHost(settings: AppSettings, onChange: () => void, onEnd: () => void): Promise<MediaSession> {
    const controller = newCaptureController()
    const screen = await captureScreen(controller?.controller)
    controller?.stayHere()
    applyContentHint(screen.getVideoTracks()[0], settings.mode)
    setPeerMode(settings.mode)
    await detectHardware()
    const secret = newSecret()
    let session: RoomSession | null = null
    try {
      session = await enterRoom(secret, undefined, settings)
      const { userId } = await session.room.getSelf()
      const media = new MediaSession(session, "host", userId, userId, { secret, hostId: userId }, settings, onChange, onEnd, screen)
      media.sessionId = crypto.randomUUID()
      media.coordinator = new TreeCoordinator(userId, media.sessionId, settings.maxDirectSlots, settings.mode === "sharp" ? 6_000_000 : 8_000_000)
      media.setup()
      media.status = "live"
      await media.publishLive(true)
      media.watchCaptureEnd()
      media.onChange()
      return media
    } catch (error) {
      for (const track of screen.getTracks()) track.stop()
      await session?.room.leave().catch(() => undefined)
      throw error
    }
  }

  static async watch(code: string, settings: AppSettings, onChange: () => void, onEnd: () => void): Promise<MediaSession> {
    const invite = parseSessionInvite(code)
    setPeerMode(settings.mode)
    const session = await enterRoom(invite.secret, invite.hostId, settings)
    try {
      const { userId } = await session.room.getSelf()
      const media = new MediaSession(session, "viewer", invite.hostId, userId, invite, settings, onChange, onEnd, null)
      media.relay = new RelayNode(session, invite.hostId, "")
      media.setup()
      await session.profiles.set({ name: settings.displayName, avatar: 0, relayEnabled: settings.relayEnabled, relaySlots: settings.relaySlots })
      media.startMetrics()
      media.onChange()
      return media
    } catch (error) {
      await session.room.leave().catch(() => undefined)
      throw error
    }
  }

  private sessionId = ""

  get id(): string {
    return this.sessionId
  }

  get inviteCode(): string {
    return sessionInviteCode(this.invite)
  }

  get stream(): MediaStream | null {
    return this.role === "host" ? this.out : this.incoming.stream
  }

  get parentId(): string | null {
    return this.assignment?.parentId ?? null
  }

  get parentName(): string | null {
    if (!this.parentId) return null
    if (this.parentId === this.hostId) return this.session.live.get().hostName || "Host"
    return this.session.profiles.get(this.parentId).name || "Relay"
  }

  get childIds(): string[] {
    return this.relay?.activeChildren ?? []
  }

  get viewers(): ViewerInfo[] {
    if (!this.coordinator) return []
    return Array.from(this.coordinator.nodes.values()).filter((node) => node.nodeId !== this.hostId).map((node) => ({
      id: node.nodeId,
      name: this.session.profiles.has(node.nodeId) ? this.session.profiles.get(node.nodeId).name : "Conectando…",
      parentId: node.parentId,
      relayEnabled: node.relayEnabled,
      children: Array.from(this.coordinator!.nodes.values()).filter((child) => child.parentId === node.nodeId).map((child) => child.nodeId),
      bitrate: node.metrics?.incomingBitrate ?? null,
      route: node.metrics?.route ?? "unknown",
    }))
  }

  get directOutputs(): number {
    return this.role === "host" ? this.outputs.size : this.childIds.length
  }

  get uploadBitrate(): number | null {
    const values = this.viewers.map((viewer) => viewer.bitrate).filter((value): value is number => value !== null)
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null
  }

  get mode(): QualityMode {
    return this.settings.mode
  }

  setMode(mode: QualityMode): void {
    this.settings = { ...this.settings, mode }
    if (this.screen) applyContentHint(this.screen.getVideoTracks()[0], mode)
    setPeerMode(mode)
    this.onChange()
  }

  async changeSource(): Promise<void> {
    if (this.role !== "host" || !this.out) return
    const controller = newCaptureController()
    const next = await captureScreen(controller?.controller)
    controller?.stayHere()
    const oldVideo = this.out.getVideoTracks()[0]
    const newVideo = next.getVideoTracks()[0]
    if (!oldVideo || !newVideo) {
      for (const track of next.getTracks()) track.stop()
      throw new Error("A nova fonte não contém vídeo.")
    }
    applyContentHint(newVideo, this.settings.mode)
    await this.session.room.replaceTrack(oldVideo, newVideo)
    this.out.removeTrack(oldVideo)
    this.out.addTrack(newVideo)
    oldVideo.stop()
    this.screen = next
    this.watchCaptureEnd()
    this.onChange()
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    if (this.metricsTimer !== undefined) window.clearInterval(this.metricsTimer)
    for (const off of this.offs) off()
    for (const output of this.outputs.values()) output.close()
    this.outputs.clear()
    this.relay?.close()
    if (this.role === "host") await this.publishLive(false).catch(() => undefined)
    if (this.out) for (const track of this.out.getTracks()) track.stop()
    await this.session.room.leave().catch(() => undefined)
    this.status = "ended"
    this.incoming.clear()
    this.onChange()
  }

  async getConnections(): Promise<RTCPeerConnection[]> {
    return Object.values(this.session.room.getPeers()).flatMap((peer) => peer.connection ? [peer.connection] : [])
  }

  private setup(): void {
    const assignments = this.session.room.makeAction<TreeAssignment>("tree")
    const metrics = this.session.room.makeAction<NodeMetrics>("metrics")
    this.offs.push(
      assignments.onMessage((assignment, context) => void this.handleAssignment(assignment, context.userId)),
      metrics.onMessage((report, context) => this.handleMetrics(report, context.userId)),
      this.session.room.onPeerStream((stream, context) => void this.receiveStream(stream, context.userId, context.metadata)),
      this.session.live.onChange((state, context) => {
        if (this.role === "host" || context.userId !== this.hostId || state.originHostId !== this.hostId) return
        this.sessionId = state.sessionId
        if (this.relay) this.relay = new RelayNode(this.session, this.hostId, state.sessionId)
        if (!state.live) {
          this.status = "ended"
          this.incoming.clear()
          this.relay?.close()
          this.onEnd()
        }
        this.onChange()
      }, { replay: true }),
      this.session.profiles.onChange(() => {
        if (this.role === "host") this.syncHostTree()
        this.onChange()
      }),
      this.session.room.onUserJoin(() => {
        if (this.role === "host") this.syncHostTree()
        this.onChange()
      }),
      this.session.room.onUserLeave(({ userId }) => {
        if (this.role === "host" && this.coordinator) {
          const next = this.coordinator.removeNode(userId)
          for (const assignment of next) this.applyHostAssignment(assignment)
          this.outputs.get(userId)?.close()
          this.outputs.delete(userId)
        } else if (userId === this.parentId || userId === this.hostId) {
          this.status = "reconnecting"
        }
        this.onChange()
      }),
      this.session.room.onError((error) => {
        if (error.code === "peer-connect-failed") this.error = "A conexão direta falhou. Verifique a configuração TURN nas duas redes."
        if (error.code === "banned") this.status = "ended"
        this.onChange()
      }),
    )
  }

  private syncHostTree(): void {
    if (!this.coordinator) return
    const users = Object.keys(this.session.room.getUsers()).filter((id) => id !== this.hostId).sort()
    if (users.length > 4) {
      this.error = "A sala atingiu o limite de quatro espectadores."
      return
    }
    for (const nodeId of users) {
      const profile = this.session.profiles.has(nodeId) ? this.session.profiles.get(nodeId) : { relayEnabled: false, relaySlots: 0 }
      if (!this.coordinator.nodes.has(nodeId)) {
        const assignment = this.coordinator.addNode({ nodeId, relayEnabled: profile.relayEnabled, relaySlots: profile.relaySlots }) ?? this.coordinator.recoverNode(nodeId)
        if (assignment) this.applyHostAssignment(assignment)
      } else {
        const assignments = this.coordinator.setRelay(nodeId, profile.relayEnabled, profile.relaySlots)
        for (const assignment of assignments) this.applyHostAssignment(assignment)
      }
    }
    for (const assignment of this.coordinator.rebalance()) this.applyHostAssignment(assignment)
  }

  private applyHostAssignment(assignment: TreeAssignment): void {
    if (!this.out) return
    void this.session.room.makeAction<TreeAssignment>("tree").send(assignment).catch(() => undefined)
    if (assignment.parentId === this.hostId) {
      const output = new OutgoingStream(this.session, this.out, assignment.childId, {
        kind: "screen",
        sessionId: this.sessionId,
        originHostId: this.hostId,
        parentId: this.hostId,
        treeEpoch: assignment.treeEpoch,
      })
      this.outputs.set(assignment.childId, output)
      void output.publish().catch(() => {
        this.error = "Não foi possível publicar mídia para um espectador."
        this.onChange()
      })
    } else {
      const previous = this.outputs.get(assignment.childId)
      if (previous) window.setTimeout(() => {
        const current = this.coordinator?.nodes.get(assignment.childId)
        if (current?.parentId !== this.hostId) {
          previous.close()
          this.outputs.delete(assignment.childId)
          this.onChange()
        }
      }, 10_000)
    }
    this.onChange()
  }

  private async handleAssignment(assignment: TreeAssignment, senderId: string): Promise<void> {
    if (this.role !== "viewer" || senderId !== this.hostId || !isTreeAssignment(assignment) || assignment.sessionId !== this.sessionId || assignment.treeEpoch < this.lastEpoch || assignment.expiresAt < Date.now()) return
    if (assignment.parentId !== this.selfId) this.relay?.remove(assignment.childId)
    if (assignment.parentId === this.selfId && this.settings.relayEnabled) await this.relay?.assign(assignment.childId, assignment.treeEpoch)
    if (assignment.childId !== this.selfId) return
    if (assignment.parentTrysteroId !== assignment.parentId || assignment.childId === assignment.parentId) return
    this.assignment = assignment
    this.lastEpoch = assignment.treeEpoch
    this.status = this.incoming.stream ? "reconnecting" : "connecting"
    this.onChange()
  }

  private async receiveStream(stream: MediaStream, senderId: string, metadata: unknown): Promise<void> {
    if (this.role !== "viewer" || !this.assignment || senderId !== this.assignment.parentId) return
    const expected = { sessionId: this.sessionId, originHostId: this.hostId, parentId: this.assignment.parentId }
    if (!acceptsStream(metadata, expected, this.lastEpoch)) return
    if (!(await this.firstFrame(stream))) return
    this.incoming.transition(stream)
    this.relay?.setIncoming(stream)
    this.status = "live"
    this.error = null
    this.onChange()
  }

  private handleMetrics(report: NodeMetrics, senderId: string): void {
    if (this.role !== "host" || !this.coordinator || senderId !== report.nodeId || report.sessionId !== this.sessionId) return
    this.coordinator.updateMetrics(senderId, report, (report.framesPerSecond ?? 0) > 0)
    this.coordinator.completeMigration(senderId)
    for (const assignment of this.coordinator.rebalance()) this.applyHostAssignment(assignment)
    this.onChange()
  }

  private startMetrics(): void {
    this.metricsTimer = window.setInterval(() => void this.reportMetrics(), 5_000)
    window.setTimeout(() => void this.reportMetrics(), 1_500)
  }

  private async reportMetrics(): Promise<void> {
    if (!this.assignment || this.stopped) return
    const peer = Object.values(this.session.room.getPeers()).find((item) => item.userId === this.assignment?.parentId)?.connection
    if (!peer) return
    const report = await collectMetrics(peer, {
      nodeId: this.selfId,
      sessionId: this.sessionId,
      treeEpoch: this.lastEpoch,
      activeChildren: this.childIds.length,
      relayEnabled: this.settings.relayEnabled,
      relaySlots: this.settings.relaySlots,
    })
    await this.session.room.makeAction<NodeMetrics>("metrics").send(report, { target: this.hostId }).catch(() => undefined)
  }

  private async publishLive(live: boolean): Promise<void> {
    await this.session.live.set({ live, sessionId: this.sessionId, originHostId: this.hostId, hostName: this.settings.displayName })
  }

  private watchCaptureEnd(): void {
    const video = this.screen?.getVideoTracks()[0]
    video?.addEventListener("ended", () => {
      if (this.screen?.getVideoTracks()[0] !== video) return
      void this.stop().then(this.onEnd)
    }, { once: true })
  }

  private firstFrame(stream: MediaStream): Promise<boolean> {
    const track = stream.getVideoTracks()[0]
    if (!track || track.readyState !== "live") return Promise.resolve(false)
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      const timeout = window.setTimeout(() => {
        cleanup()
        resolve(false)
      }, 10_000)
      const cleanup = () => {
        window.clearTimeout(timeout)
        video.pause()
        video.srcObject = null
      }
      video.onloadeddata = () => {
        cleanup()
        resolve(true)
      }
      void video.play().catch(() => {
        cleanup()
        resolve(false)
      })
    })
  }
}
